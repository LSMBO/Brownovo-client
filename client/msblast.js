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
      
      // Les premiers sont les fichiers de novo, le dernier est la db (si présente)
      uploadedDenovoPaths = uploadedPaths.slice(0, localDenovoFiles.length);
      if (localDbFile) {
        uploadedDbPath = uploadedPaths[uploadedPaths.length - 1];
      }
    }
    
    // Construire les listes finales pour le serveur Flask
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
      
      alert(`MS-Blast completed!\nGenerated files: ${msblastResult.output_files.length}`);
      console.log('Output files:', msblastResult.output_files);
      
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

// Export for use in renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleMsblast };
}
