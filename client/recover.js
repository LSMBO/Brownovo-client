async function handleRecover(mgfFiles, mgfSelect) {
  const selectedIndices = Array.from(mgfSelect.selectedOptions).map(opt => parseInt(opt.value));
  const selectedFiles = selectedIndices.map(idx => mgfFiles[idx]);
  
  if (selectedFiles.length === 0) {
    alert('Please select at least one MGF file');
    return null;
  }
  
  const emergence = parseInt(document.getElementById('emergence').value);
  const minUpn = parseInt(document.getElementById('min-upn').value);
  const intensityMethod = document.querySelector('input[name="intensity-method"]:checked').value;
  
  const jobId = `recover_${Date.now()}`;
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

    // Start Recover processing
    addJob(jobId, 'recover', `Recover on ${serverFiles.length} file(s)`);
    
    const recoverResult = await window.electronAPI.recover(serverFiles, {
      emergence: emergence,
      min_upn: minUpn,
      intensity_method: intensityMethod
    });
    
    if (recoverResult.success) {
      updateJob(jobId, 'completed', `${recoverResult.output_files.length} file(s) generated`);
      setTimeout(() => removeJob(jobId), timeouts.recover);
      
      // Display results in visualization section
      displayRecoverResults(recoverResult.output_files);
      
      alert(`Recover completed!\nGenerated files: ${recoverResult.output_files.length}`);
      console.log('Output files:', recoverResult.output_files);
      
      return recoverResult.output_files;
    } else {
      updateJob(jobId, 'failed', 'Recover failed');
      setTimeout(() => removeJob(jobId), timeouts.recover);
      alert('Error during Recover processing');
      return null;
    }
    
  } catch (error) {
    console.error('Error:', error);
    updateJob(jobId, 'failed', error.message);
    setTimeout(() => removeJob(jobId), timeouts.recover);
    alert('Error: ' + error.message);
    return null;
  }
}

function displayRecoverResults(outputFiles) {
  const visualizationSection = document.getElementById('recover-visualization');
  const resultsContainer = document.getElementById('recover-results');
  const template = document.getElementById('recover-result-template');
  
  resultsContainer.innerHTML = '';
  
  outputFiles.forEach(async (fileInfo) => {
    // Clone the template
    const card = template.content.cloneNode(true);
    
    // Extract file path and construct JSON path
    const mgfPath = fileInfo.path;
    const jsonPath = mgfPath.replace(/\.mgf$/, '.json');
    const fileName = mgfPath.split('/').pop();
    
    // Extract base name (remove _recovered.mgf suffix)
    const fileBaseName = fileName.replace(/_recovered\.mgf$/, '');
    
    // Set base filename immediately
    card.querySelector('[data-field="fileBaseName"]').textContent = fileBaseName;
    
    try {
      // Fetch statistics from server
      const statsResult = await window.electronAPI.getRecoverStats(jsonPath);
      
      if (statsResult.success && statsResult.statistics) {
        const stats = statsResult.statistics;
        const percentage = stats.retention_rate.toFixed(1);
        
        // Populate template fields with statistics
        card.querySelector('[data-field="totalSpectra"]').textContent = stats.total_spectra;
        card.querySelector('[data-field="filteredSpectra"]').textContent = stats.filtered_spectra;
        card.querySelector('[data-field="percentage"]').textContent = `${percentage}%`;
      } else {
        // Show error in card
        card.querySelector('[data-field="totalSpectra"]').textContent = 'N/A';
        card.querySelector('[data-field="filteredSpectra"]').textContent = 'N/A';
        card.querySelector('[data-field="percentage"]').textContent = 'Error loading stats';
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      card.querySelector('[data-field="totalSpectra"]').textContent = 'N/A';
      card.querySelector('[data-field="filteredSpectra"]').textContent = 'N/A';
      card.querySelector('[data-field="percentage"]').textContent = 'Error';
    }
    
    resultsContainer.appendChild(card);
  });
  
  visualizationSection.style.display = 'block';
}

// Export for use in renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleRecover };
}
