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
      
      // Add uploaded paths to server files
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

// Export pour utilisation dans renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleRecover };
}
