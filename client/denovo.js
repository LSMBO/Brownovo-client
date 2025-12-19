async function handleDenovo(mgfFiles, denovoMgfSelect) {
  const selectedIndices = Array.from(denovoMgfSelect.selectedOptions).map(opt => parseInt(opt.value));
  const selectedFiles = selectedIndices.map(idx => mgfFiles[idx]);
  
  if (selectedFiles.length === 0) {
    alert('Please select at least one MGF file');
    return null;
  }
  
  const denovoMethod = document.querySelector('input[name="denovo-method"]:checked').value;
  const minGlobalScore = parseInt(document.getElementById('min-global-score').value);
  const minResidueScore = parseInt(document.getElementById('min-residue-score').value);
  const minPeptideLength = parseInt(document.getElementById('min-peptide-length').value);
  
  const jobId = `denovo_${Date.now()}`;
  const timeouts = await window.electronAPI.getJobTimeouts();
  
  try {
    const localFiles = selectedFiles.filter(f => !f.isServerFile);
    const serverFiles = selectedFiles.filter(f => f.isServerFile).map(f => f.path);

    // Upload local files if necessary
    if (localFiles.length > 0) {
      addJob(`${jobId}_upload`, 'upload', `Uploading ${localFiles.length} file(s)`);
      
      const filePaths = localFiles.map(f => f.path);
      
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
      
      updateJob(`${jobId}_upload`, 'completed', `${localFiles.length} file(s) uploaded`);
      setTimeout(() => removeJob(`${jobId}_upload`), timeouts.upload);
      
      const uploadedPaths = uploadResults.map(r => r.filePath);
      serverFiles.push(...uploadedPaths);
    }
    
    // Start De Novo processing
    addJob(jobId, 'denovo', `De Novo (${denovoMethod}) on ${serverFiles.length} file(s)`);
    
    const denovoResult = await window.electronAPI.denovo(serverFiles, {
      method: denovoMethod,
      min_global_score: minGlobalScore,
      min_residue_score: minResidueScore,
      min_peptide_length: minPeptideLength
    });
    
    if (denovoResult.success) {
      updateJob(jobId, 'completed', `${denovoResult.output_files.length} file(s) generated`);
      setTimeout(() => removeJob(jobId), timeouts.denovo);
      
      // Display results in visualization section
      displayDenovoResults(denovoResult.output_files);
      
      alert(`De Novo completed!\nGenerated files: ${denovoResult.output_files.length}`);
      console.log('Output files:', denovoResult.output_files);
      
      return denovoResult.output_files;
    } else {
      updateJob(jobId, 'failed', 'De Novo failed');
      setTimeout(() => removeJob(jobId), timeouts.denovo);
      alert('Error during De Novo processing');
      return null;
    }
    
  } catch (error) {
    console.error('Error:', error);
    updateJob(jobId, 'failed', error.message);
    setTimeout(() => removeJob(jobId), timeouts.denovo);
    alert('Error: ' + error.message);
    return null;
  }
}

function displayDenovoResults(outputFiles) {
  const visualizationSection = document.getElementById('denovo-visualization');
  const resultsContainer = document.getElementById('denovo-results');
  const template = document.getElementById('denovo-result-template');
  
  resultsContainer.innerHTML = '';
  
  outputFiles.forEach(async (fileInfo) => {
    // Clone the template
    const card = template.content.cloneNode(true);
    
    // Extract file path and construct JSON path
    const fastaPath = fileInfo.path;
    const jsonPath = fastaPath.replace(/\.fasta$/, '.json');
    const fileName = fastaPath.split('/').pop();
    
    // Extract base name (remove .fasta suffix)
    const fileBaseName = fileName.replace(/\.fasta$/, '');
    
    // Set base filename immediately
    card.querySelector('[data-field="fileBaseName"]').textContent = fileBaseName;
    
    try {
      // Fetch statistics from server
      const statsResult = await window.electronAPI.getDenovoStats(jsonPath);
      
      if (statsResult.success && statsResult.statistics) {
        const stats = statsResult.statistics;
        const percentage = stats.total_peptides > 0
          ? ((stats.valid_peptides / stats.total_peptides) * 100).toFixed(1)
          : '0.0';
        
        // Populate template fields with statistics
        card.querySelector('[data-field="totalPeptides"]').textContent = stats.total_peptides;
        card.querySelector('[data-field="validPeptides"]').textContent = stats.valid_peptides;
        card.querySelector('[data-field="percentage"]').textContent = `${percentage}%`;
      } else {
        // Show error in card
        card.querySelector('[data-field="totalPeptides"]').textContent = 'N/A';
        card.querySelector('[data-field="validPeptides"]').textContent = 'N/A';
        card.querySelector('[data-field="percentage"]').textContent = 'Error loading stats';
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      card.querySelector('[data-field="totalPeptides"]').textContent = 'N/A';
      card.querySelector('[data-field="validPeptides"]').textContent = 'N/A';
      card.querySelector('[data-field="percentage"]').textContent = 'Error';
    }
    
    resultsContainer.appendChild(card);
  });
  
  visualizationSection.style.display = 'block';
}

// Export for use in renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleDenovo };
}
