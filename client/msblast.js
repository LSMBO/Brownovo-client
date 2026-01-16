// MS-Blast workflow handler

async function handleMsblast(fastaFiles, denovoFastaSelect, dbFastaSelect) {
  const selectedDenovoIndices = Array.from(denovoFastaSelect.selectedOptions).map(opt => parseInt(opt.value));
  const selectedDenovoFiles = selectedDenovoIndices.map(idx => fastaFiles[idx]);
  
  const dbIndex = dbFastaSelect.value;
  const dbFile = dbIndex !== '' ? fastaFiles[parseInt(dbIndex)] : null;
  
  if (selectedDenovoFiles.length === 0 || !dbFile) {
    alert('Please select De novo files and a database');
    return null;
  }
  
  const jobId = `msblast_${Date.now()}`;
  const timeouts = await window.electronAPI.getJobTimeouts();
  
  try {
    const localDenovoFiles = selectedDenovoFiles.filter(f => !f.isServerFile);
    const serverDenovoFiles = selectedDenovoFiles.filter(f => f.isServerFile).map(f => f.path);
    
    const localDbFile = dbFile.isServerFile ? null : dbFile;
    const serverDbFile = dbFile.isServerFile ? dbFile.path : null;

    // Upload local files if necessary
    const allLocalFiles = [...localDenovoFiles];
    if (localDbFile) allLocalFiles.push(localDbFile);
    
    let uploadedDenovoPaths = [];
    let uploadedDbPath = null;
    
    if (allLocalFiles.length > 0) {
      addJob(`${jobId}_upload`, 'upload', `Uploading ${allLocalFiles.length} file(s)`);
      
      const filePaths = allLocalFiles.map(f => f.path);
      
      const uploadResults = await window.electronAPI.sendFiles(
        filePaths,
        'brownovo/data',
      );
      
      const failed = uploadResults.filter(r => !r.success);
      if (failed.length > 0) {
        updateJob(`${jobId}_upload`, 'failed', `Failed to upload ${failed.length} file(s)`);
        setTimeout(() => removeJob(`${jobId}_upload`), timeouts.upload);
        alert(`Error uploading ${failed.length} file(s)`);
        return null;
      }
      
      updateJob(`${jobId}_upload`, 'completed', `${allLocalFiles.length} file(s) uploaded`);
      setTimeout(() => removeJob(`${jobId}_upload`), timeouts.upload);
      
      const uploadedPaths = uploadResults.map(r => r.filePath);
      
      // First files are de novo files, last one is the database
      uploadedDenovoPaths = uploadedPaths.slice(0, localDenovoFiles.length);
      if (localDbFile) {
        uploadedDbPath = uploadedPaths[uploadedPaths.length - 1];
      }
    }
    
    // Build final lists for Flask server
    const finalDenovoFiles = [...serverDenovoFiles, ...uploadedDenovoPaths];
    const finalDbFile = serverDbFile || uploadedDbPath;
    
    // Start MS-Blast processing
    addJob(jobId, 'msblast', `MS-Blast on ${finalDenovoFiles.length} file(s)`);

    const msblastResult = await window.electronAPI.msblast(finalDenovoFiles, {
      database: finalDbFile
    });
    
    if (msblastResult.success) {
      updateJob(jobId, 'completed', `${msblastResult.output_files.length} file(s) generated`);
      setTimeout(() => removeJob(jobId), timeouts.msblast);
      
      // Display results in visualization section
      await displayMsblastResults(msblastResult.output_files);
      
      alert(`MS-Blast completed!\nGenerated files: ${msblastResult.output_files.length}`);
      
      return msblastResult.output_files;
    } else {
      updateJob(jobId, 'failed', 'MS-Blast failed');
      setTimeout(() => removeJob(jobId), timeouts.msblast);
      alert('Error during MS-Blast processing');
      return null;
    }
    
  } catch (error) {
    console.error('Error:', error);
    updateJob(jobId, 'failed', error.message);
    setTimeout(() => removeJob(jobId), timeouts.msblast);
    alert('Error: ' + error.message);
    return null;
  }
}

async function displayMsblastResults(outputFiles) {
  console.log('displayMsblastResults()');
  const visualizationSection = document.getElementById('msblast-visualization');
  const resultsContainer = document.getElementById('msblast-results');
  const template = document.getElementById('msblast-result-template');
  
  resultsContainer.innerHTML = '';
  visualizationSection.style.display = 'block';
  
  // Clone the template once
  const card = template.content.cloneNode(true);
  
  // Get elements
  const sampleSelect = card.querySelector('[data-field="sampleSelect"]');
  const downloadBtn = card.querySelector('[data-field="downloadBtn"]');
  
  // Store all samples data
  const samplesData = outputFiles.map((fileInfo, index) => {
    const tsvFile = fileInfo.tsv_file;
    const fileName = tsvFile.path.split('/').pop();
    return {
      index,
      name: fileName.replace('.tsv', ''),
      tsvPath: tsvFile.path,
      proteinIndexPath: fileInfo.protein_index.path
    };
  });
  
  // Populate sample select
  samplesData.forEach((sample, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = sample.name;
    sampleSelect.appendChild(option);
  });
  
  // Store reference to current sample
  let currentSampleIndex = 0;
  
  // Download button handler
  downloadBtn.addEventListener('click', async () => {
    const currentSample = samplesData[currentSampleIndex];
    try {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Downloading...';
      
      const result = await window.electronAPI.downloadFile(currentSample.tsvPath);
      
      if (result.success) {
        alert(`File saved to: ${result.savePath}`);
      } else {
        alert('Download canceled');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading file: ' + error.message);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '<span class="download-icon">↓</span> Download TSV';
    }
  });
  
  // Append card to container
  resultsContainer.appendChild(card);
  
  // Get the actual DOM elements (after appending)
  const cardElement = resultsContainer.querySelector('.result-card');
  const sampleSelectElement = cardElement.querySelector('[data-field="sampleSelect"]');
  
  // Store current protein index path
  let currentProteinIndexPath = samplesData[0].proteinIndexPath;
  
  // Setup protein search for first sample
  setupProteinSearch(cardElement, currentProteinIndexPath);
  
  // Auto-load protein with highest coverage (allowing_one_pos_or_one_minus = 7)
  loadBestProtein(cardElement, currentProteinIndexPath);
  
  // Sample select change handler
  sampleSelectElement.addEventListener('change', () => {
    const selectedIndex = parseInt(sampleSelectElement.value);
    currentSampleIndex = selectedIndex;
    currentProteinIndexPath = samplesData[selectedIndex].proteinIndexPath;
    setupProteinSearch(cardElement, currentProteinIndexPath);
    loadBestProtein(cardElement, currentProteinIndexPath);
  });
}

async function loadBestProtein(cardElement, proteinIndexPath) {
  try {
    // Search with empty query to get all proteins sorted by coverage
    const proteins = await window.electronAPI.searchProtein(proteinIndexPath, '');
    
    if (proteins && proteins.length > 0) {
      // First protein is the one with highest coverage
      const bestProtein = proteins[0];
      
      // Get filter elements to read their default values
      const filterMinScore = cardElement.querySelector('[data-field="filterMinScore"]');
      const filterIncludingPos = cardElement.querySelector('[data-field="filterIncludingPos"]');
      const filterExcludingPos = cardElement.querySelector('[data-field="filterExcludingPos"]');
      const filterOnePosOrMinus = cardElement.querySelector('[data-field="filterOnePosOrMinus"]');
      const filterOneMinus = cardElement.querySelector('[data-field="filterOneMinus"]');
      const searchInput = cardElement.querySelector('[data-field="proteinSearchInput"]');
      
      // Set filters from current input values
      const filters = {
        min_score: parseInt(filterMinScore.value),
        including_pos: parseInt(filterIncludingPos.value),
        excluding_pos: parseInt(filterExcludingPos.value),
        allowing_one_pos_or_one_minus: parseInt(filterOnePosOrMinus.value),
        allowing_one_minus: parseInt(filterOneMinus.value)
      };
      
      // Load protein details
      const proteinData = await window.electronAPI.getProteinDetails(
        proteinIndexPath,
        bestProtein.accession,
        filters
      );
      
      if (proteinData) {
        // Fill the search input with the protein accession
        searchInput.value = bestProtein.accession;
        displayProteinDetails(cardElement, proteinData, filters);
      }
    }
  } catch (error) {
    console.error('Error loading best protein:', error);
  }
}

function setupProteinSearch(cardElement, proteinIndexPath) {
  const searchInput = cardElement.querySelector('[data-field="proteinSearchInput"]');
  const searchSuggestions = cardElement.querySelector('[data-field="searchSuggestions"]');
  const searchBtn = cardElement.querySelector('[data-field="searchProteinBtn"]');
  const proteinDisplay = cardElement.querySelector('[data-field="proteinDisplay"]');
  
  const filterMinScore = cardElement.querySelector('[data-field="filterMinScore"]');
  const filterIncludingPos = cardElement.querySelector('[data-field="filterIncludingPos"]');
  const filterExcludingPos = cardElement.querySelector('[data-field="filterExcludingPos"]');
  const filterOnePosOrMinus = cardElement.querySelector('[data-field="filterOnePosOrMinus"]');
  const filterOneMinus = cardElement.querySelector('[data-field="filterOneMinus"]');
  
  // Setup expandable filter
  const filterHeader = cardElement.querySelector('[data-field="filterHeader"]');
  const filterContent = cardElement.querySelector('[data-field="filterContent"]');
  const expandIcon = filterHeader.querySelector('.expand-icon');
  
  filterHeader.onclick = () => {
    const isExpanded = filterContent.style.display !== 'none';
    filterContent.style.display = isExpanded ? 'none' : 'block';
    expandIcon.classList.toggle('expanded', !isExpanded);
  };
  
  searchInput.value = '';
  searchSuggestions.innerHTML = '';
  searchSuggestions.style.display = 'none';
  proteinDisplay.style.display = 'none';
  
  let debounceTimer;
  let selectedProtein = null;
  
  // Search suggestions on input
  searchInput.oninput = async (e) => {
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      searchSuggestions.style.display = 'none';
      searchSuggestions.innerHTML = '';
      return;
    }
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const suggestions = await window.electronAPI.searchProtein(proteinIndexPath, query);
        
        if (suggestions && suggestions.length > 0) {
          searchSuggestions.innerHTML = suggestions.map(protein => 
            `<div class="suggestion-item" data-accession="${protein.accession}">
              <strong>${protein.accession}</strong>
              <span class="suggestion-desc">${protein.description || ''}</span>
            </div>`
          ).join('');
          
          searchSuggestions.style.display = 'block';
          
          // Add click handlers to suggestions
          searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
              const accession = item.dataset.accession;
              searchInput.value = accession;
              selectedProtein = accession;
              searchSuggestions.style.display = 'none';
            });
          });
        } else {
          searchSuggestions.innerHTML = '<div class="suggestion-item no-results">No proteins found</div>';
          searchSuggestions.style.display = 'block';
        }
      } catch (error) {
        console.error('Error searching proteins:', error);
      }
    }, 300);
  };
  
  // Hide suggestions when clicking outside
  const hideHandler = (e) => {
    if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
      searchSuggestions.style.display = 'none';
    }
  };
  
  // Remove old handler if exists
  document.removeEventListener('click', hideHandler);
  document.addEventListener('click', hideHandler);
  
  // Search button click
  searchBtn.onclick = async () => {
    const accession = searchInput.value.trim();
    
    if (!accession) {
      alert('Please enter a protein accession');
      return;
    }
    
    const filters = {
      min_score: parseInt(filterMinScore.value),
      including_pos: parseInt(filterIncludingPos.value),
      excluding_pos: parseInt(filterExcludingPos.value),
      allowing_one_pos_or_one_minus: parseInt(filterOnePosOrMinus.value),
      allowing_one_minus: parseInt(filterOneMinus.value)
    };
    
    try {
      searchBtn.disabled = true;
      searchBtn.textContent = 'Loading...';
      
      const proteinData = await window.electronAPI.getProteinDetails(
        proteinIndexPath, 
        accession, 
        filters
      );
      
      if (proteinData) {
        displayProteinDetails(cardElement, proteinData, filters);
      } else {
        alert('Protein not found');
      }
    } catch (error) {
      console.error('Error loading protein:', error);
      alert('Error loading protein: ' + error.message);
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search Protein';
    }
  };
}

function displayProteinDetails(cardElement, proteinData, filters) {
  const proteinDisplay = cardElement.querySelector('[data-field="proteinDisplay"]');
  const proteinAccession = cardElement.querySelector('[data-field="proteinAccession"]');
  const proteinDescription = cardElement.querySelector('[data-field="proteinDescription"]');
  const proteinLength = cardElement.querySelector('[data-field="proteinLength"]');
  const proteinCoverage = cardElement.querySelector('[data-field="proteinCoverage"]');
  const proteinPeptideCount = cardElement.querySelector('[data-field="proteinPeptideCount"]');
  const sequenceContainer = cardElement.querySelector('[data-field="sequenceContainer"]');
  
  // Populate protein header
  proteinAccession.textContent = proteinData.accession;
  proteinDescription.textContent = proteinData.description || 'No description';
  proteinLength.textContent = proteinData.sequence_length;
  
  // Filter peptides based on min score and min consecutive AA filters
  const filteredPeptides = proteinData.peptides.filter(peptide => {
    return (
      peptide.global_score >= filters.min_score &&
      peptide.max_consecutive_aa_including_pos >= filters.including_pos &&
      peptide.max_consecutive_aa_excluding_pos >= filters.excluding_pos &&
      peptide.max_consecutive_aa_allowing_one_pos_or_one_minus >= filters.allowing_one_pos_or_one_minus &&
      peptide.max_consecutive_aa_allowing_one_minus >= filters.allowing_one_minus
    );
  });
  
  // Use pre-calculated coverage if available
  if (proteinData.coverage) {
    proteinCoverage.textContent = proteinData.coverage.coverage_percent.toFixed(1);
    proteinPeptideCount.textContent = proteinData.coverage.peptides_count;
    
    // Add indicator if coverage was pre-calculated
    if (proteinData.coverage.is_precalculated) {
      console.log('Using pre-calculated coverage');
    } else {
      console.log('Coverage calculated manually');
    }
  } else {
    // Fallback: calculate manually (shouldn't happen with new API)
    const coverage = calculateCoverage(proteinData.sequence, filteredPeptides);
    proteinCoverage.textContent = coverage.toFixed(1);
    proteinPeptideCount.textContent = filteredPeptides.length;
  }
  
  // Display sequence with peptide bars
  displaySequenceWithPeptides(sequenceContainer, proteinData.sequence, filteredPeptides);
  
  proteinDisplay.style.display = 'block';
}

function calculateCoverage(sequence, peptides) {
  const coveredPositions = new Set();
  
  peptides.forEach(peptide => {
    for (let i = peptide.subject_start - 1; i < peptide.subject_end; i++) {
      coveredPositions.add(i);
    }
  });
  
  return (coveredPositions.size / sequence.length) * 100;
}



function displaySequenceWithPeptides(container, sequence, peptides) {
  container.innerHTML = '';
  
  const residuesPerLine = 50;
  const lines = Math.ceil(sequence.length / residuesPerLine);
  
  // Group peptides by line and assign Y layers to avoid overlaps
  const peptidesByLine = [];
  
  for (let lineIndex = 0; lineIndex < lines; lineIndex++) {
    const lineStart = lineIndex * residuesPerLine;
    const lineEnd = Math.min(lineStart + residuesPerLine, sequence.length);
    
    // Find peptides that overlap with this line (using subject coordinates directly)
    const linePeptides = peptides
      .map((peptide, index) => ({ peptide, index }))
      .filter(({ peptide }) => {
        const start = peptide.subject_start - 1; // Convert to 0-indexed
        const end = peptide.subject_end - 1; // Convert to 0-indexed
        return (start < lineEnd && end >= lineStart);
      });
    
    // For each peptide, calculate its start and end position on this line
    const linePeptidesWithCoords = linePeptides.map(({ peptide, index }) => {
      const peptideStart = peptide.subject_start - 1; // 0-indexed
      const peptideEnd = peptide.subject_end - 1; // 0-indexed
      
      // Calculate which part of the peptide is on this line
      const lineStart_pos = Math.max(peptideStart, lineStart);
      const lineEnd_pos = Math.min(peptideEnd, lineEnd - 1);
      
      return {
        peptide,
        index,
        lineStart: lineStart_pos - lineStart,
        lineEnd: lineEnd_pos - lineStart
      };
    });
    
    // Assign Y layers to avoid overlaps
    const layers = [];
    linePeptidesWithCoords.forEach(item => {
      let layer = 0;
      while (layer < layers.length) {
        const hasOverlap = layers[layer].some(other => 
          !(item.lineEnd < other.lineStart || item.lineStart > other.lineEnd)
        );
        if (!hasOverlap) break;
        layer++;
      }
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(item);
      item.layer = layer;
    });
    
    peptidesByLine.push({ linePeptides: linePeptidesWithCoords, layerCount: layers.length });
  }
  
  // Render each line
  for (let lineIndex = 0; lineIndex < lines; lineIndex++) {
    const lineStart = lineIndex * residuesPerLine;
    const lineEnd = Math.min(lineStart + residuesPerLine, sequence.length);
    
    const lineWrapper = document.createElement('div');
    lineWrapper.className = 'sequence-line-wrapper';
    
    const lineDiv = document.createElement('div');
    lineDiv.className = 'sequence-line';
    
    // Add line number
    const lineNumber = document.createElement('span');
    lineNumber.className = 'line-number';
    lineNumber.textContent = (lineStart + 1).toString().padStart(5, ' ') + ' ';
    lineDiv.appendChild(lineNumber);
    
    // Add residues for this line (no coloring)
    for (let pos = lineStart; pos < lineEnd; pos++) {
      const residue = sequence[pos];
      const residueSpan = document.createElement('span');
      residueSpan.className = 'residue';
      residueSpan.textContent = residue;
      residueSpan.dataset.position = pos + 1;
      lineDiv.appendChild(residueSpan);
    }
    
    lineWrapper.appendChild(lineDiv);
    
    // Add peptide bars
    const { linePeptides, layerCount } = peptidesByLine[lineIndex];
    if (linePeptides.length > 0) {
      const peptideBarsContainer = document.createElement('div');
      peptideBarsContainer.className = 'peptide-bars-container';
      peptideBarsContainer.style.height = `${layerCount * 8}px`;
      
      linePeptides.forEach(({ peptide, lineStart: start, lineEnd: end, layer, index }) => {
        const barWrapper = document.createElement('div');
        barWrapper.className = 'peptide-bar-wrapper';
        barWrapper.dataset.peptideIndex = index;
        
        const bar = document.createElement('div');
        bar.className = 'peptide-bar';
        
        // Calculate position (account for dynamic line number width)
        const lineNumberWidth = (lineStart.toString().length + 1) * 8; // Dynamic width based on digits
        const residueWidth = 12; // Approximate width per residue
        const left = lineNumberWidth + (start * residueWidth);
        const width = ((end - start + 1) * residueWidth) - 2; // Reduce by 2px to not cover right residue
        
        bar.style.left = `${left}px`;
        bar.style.width = `${width}px`;
        bar.style.top = `${layer * 8}px`;
        
        // Shorter tooltip
        bar.title = `${peptide.denovo_id} - Click to expand`;
        
        // Click handler to expand peptide sequence
        bar.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePeptideSequence(barWrapper, peptide, left, container);
        });
        
        barWrapper.appendChild(bar);
        peptideBarsContainer.appendChild(barWrapper);
      });
      
      lineWrapper.appendChild(peptideBarsContainer);
    }
    
    container.appendChild(lineWrapper);
  }
}

function togglePeptideSequence(barWrapper, peptide, leftPosition, container) {
  // Check if already expanded
  const existing = barWrapper.querySelector('.peptide-sequence-detail');
  if (existing) {
    existing.remove();
    barWrapper.querySelector('.peptide-bar').classList.remove('active');
    return;
  }
  
  // Close all other open details
  container.querySelectorAll('.peptide-sequence-detail').forEach(detail => detail.remove());
  container.querySelectorAll('.peptide-bar.active').forEach(bar => bar.classList.remove('active'));
  
  // Mark this bar as active
  barWrapper.querySelector('.peptide-bar').classList.add('active');
  
  // Create detail view
  const detail = document.createElement('div');
  detail.className = 'peptide-sequence-detail';
  detail.style.left = `${leftPosition}px`;
  
  // Build colored sequence with score table
  const fullSeq = peptide.full_sequence || '';
  const filteredSeq = peptide.filtered_sequence || '';
  const queryAligned = peptide.query_aligned || '';
  const subjectAligned = peptide.subject_aligned || '';
  const residueScores = peptide.full_residue_scores || [];
  
  // Find where filtered sequence starts in full sequence
  const filteredStartInFull = fullSeq.indexOf(filteredSeq);
  
  // Build HTML for sequence with scores in table format
  let sequenceHTML = '<div class="peptide-sequence-table">';
  
  // Row 1: Residues
  sequenceHTML += '<div class="sequence-residues-row">';
  for (let i = 0; i < fullSeq.length; i++) {
    const char = fullSeq[i];
    let colorClass = 'seq-full'; // Default: part of full but not filtered
    let isMismatch = false;
    
    if (i >= filteredStartInFull && i < filteredStartInFull + filteredSeq.length) {
      const posInFiltered = i - filteredStartInFull;
      const queryStart = (peptide.query_start || 1) - 1; // 0-indexed
      const queryEnd = (peptide.query_end || filteredSeq.length) - 1; // 0-indexed
      
      if (posInFiltered >= queryStart && posInFiltered <= queryEnd) {
        // This is in the matched region
        colorClass = 'seq-matched';
        
        // Check for mismatch by comparing aligned sequences
        const posInAlignment = posInFiltered - queryStart;
        if (posInAlignment >= 0 && posInAlignment < queryAligned.length) {
          const queryChar = queryAligned[posInAlignment];
          const subjectChar = subjectAligned[posInAlignment];
          if (queryChar !== subjectChar && queryChar !== '-' && subjectChar !== '-') {
            isMismatch = true;
            colorClass = 'seq-mismatch';
          }
        }
      } else {
        // This is filtered but not matched
        colorClass = 'seq-filtered';
      }
    }
    
    sequenceHTML += `<span class="seq-char ${colorClass}">${char}</span>`;
  }
  sequenceHTML += '</div>';
  
  // Row 2: Scores
  sequenceHTML += '<div class="sequence-scores-row">';
  for (let i = 0; i < fullSeq.length; i++) {
    const score = residueScores[i] !== undefined ? residueScores[i].toFixed(0) : '-';
    sequenceHTML += `<span class="score-cell">${score}</span>`;
  }
  sequenceHTML += '</div>';
  
  sequenceHTML += '</div>';
  
  detail.innerHTML = `
    <div class="peptide-detail-header">
      <strong>${peptide.denovo_id}</strong>
      <span class="close-btn">×</span>
    </div>
    <div class="peptide-detail-info">De novo Global Score: ${peptide.global_score}</div>
    <div class="peptide-detail-info">De novo Residue Score:</div>
    ${sequenceHTML}
    <div class="peptide-color-legend">
      <div class="legend-item">
        <span class="legend-color" style="background-color: #ab47bc;"></span>
        <span>Full sequence (raw de novo prediction)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background-color: #42a5f5;"></span>
        <span>Filtered sequence (longest high‑confidence subsequence used for MS‑BLAST ; see De Novo page)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background-color: #4caf50;"></span>
        <span>MS‑BLAST matched region</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background-color: #2e7d32;"></span>
        <span>Mismatch within MS‑BLAST match</span>
      </div>
    </div>

  `;
  
  // Close button handler
  detail.querySelector('.close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    detail.remove();
    barWrapper.querySelector('.peptide-bar').classList.remove('active');
  });
  
  barWrapper.appendChild(detail);
}

// Export for use in renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleMsblast };
}
