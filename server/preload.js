const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Upload files to server
  sendFiles: (files, destinationPath) => ipcRenderer.invoke('send-files', files, destinationPath),
  
  // Processing actions
  recover: (mgfFiles, params) => ipcRenderer.invoke('recover', mgfFiles, params),
  denovoStart: (mgfFiles, params) => ipcRenderer.invoke('denovo-start', mgfFiles, params),
  denovoTreatment: (resultFiles, params) => ipcRenderer.invoke('denovo-treatment', resultFiles, params),
  msblast: (fastaFiles, params) => ipcRenderer.invoke('msblast', fastaFiles, params),
  
  // Get statistics from JSON files
  getRecoverStats: (jsonPath) => ipcRenderer.invoke('get-recover-stats', jsonPath),
  getDenovoStats: (jsonPath) => ipcRenderer.invoke('get-denovo-stats', jsonPath),
  
  // Protein search and details
  searchProtein: (proteinIndexPath, query) => ipcRenderer.invoke('search-protein', proteinIndexPath, query),
  getProteinDetails: (proteinIndexPath, accession, filters) => ipcRenderer.invoke('get-protein-details', proteinIndexPath, accession, filters),
  
  // Download file
  downloadFile: (filePath) => ipcRenderer.invoke('download-file', filePath),

  // File browser
  browseServer: (type, title, defaultPath, filter, properties) => ipcRenderer.invoke('browse', type, title, defaultPath, filter, properties),
  
  // Get local file stats
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  
  // Get timeouts from config
  getJobTimeouts: () => ipcRenderer.invoke('get-job-timeouts')
});

window.addEventListener('DOMContentLoaded', () => {
});
