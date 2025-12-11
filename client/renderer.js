// File management
let mgfFiles = [];
let fastaFiles = [];
let denovoFastaFiles = []; // De novo FASTA files only

// DOM elements
const fileLoader = document.getElementById('file-loader');
const mgfList = document.getElementById('mgf-list');
const fastaList = document.getElementById('fasta-list');

// Tab management
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Deactivate all buttons and panels
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      // Activate selected button and panel
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}

// Initialize tabs on load
document.addEventListener('DOMContentLoaded', initTabs);

// Selects
const mgfSelect = document.getElementById('mgf-select');
const denovoMgfSelect = document.getElementById('denovo-mgf-select');
const dbFastaSelect = document.getElementById('db-fasta-select');
const denovoFastaSelect = document.getElementById('denovo-fasta-select');

// Helper texts
const mgfSelectHelper = document.getElementById('mgf-select-helper');
const denovoMgfSelectHelper = document.getElementById('denovo-mgf-select-helper');
const dbFastaSelectHelper = document.getElementById('db-fasta-select-helper');
const denovoFastaSelectHelper = document.getElementById('denovo-fasta-select-helper');

// Update MGF files list
async function updateMgfList() {
  mgfList.innerHTML = '';
  
  for (const [index, file] of mgfFiles.entries()) {
    const li = document.createElement('li');
    const size = await getFileSize(file);
    li.textContent = formatFileDisplay(file.name, size);
    li.dataset.index = index;
    mgfList.appendChild(li);
  }
  
  updateMgfSelects();
}

// Update FASTA files list
async function updateFastaList() {
  fastaList.innerHTML = '';
  
  for (const [index, file] of fastaFiles.entries()) {
    const li = document.createElement('li');
    const size = await getFileSize(file);
    li.textContent = formatFileDisplay(file.name, size);
    li.dataset.index = index;
    fastaList.appendChild(li);
  }
  
  // Filter de novo files
  denovoFastaFiles = fastaFiles.filter(file => {
    const name = file.name.toLowerCase();
    return name.endsWith('novor.fasta') || name.endsWith('powernovo.fasta');
  });
  
  updateFastaSelects();
}

// Update MGF selects (Recover and De Novo)
async function updateMgfSelects() {
  // Update Recover select
  mgfSelect.innerHTML = '';
  
  for (const [index, file] of mgfFiles.entries()) {
    const option = document.createElement('option');
    option.value = index;
    const size = await getFileSize(file);
    option.textContent = formatFileDisplay(file.name, size);
    mgfSelect.appendChild(option);
  }
  
  // Show/hide select and helper message
  if (mgfFiles.length > 0) {
    mgfSelect.style.display = 'block';
    mgfSelectHelper.style.display = 'none';
  } else {
    mgfSelect.style.display = 'none';
    mgfSelectHelper.style.display = 'block';
  }
  
  // Update De Novo select (same logic)
  denovoMgfSelect.innerHTML = '';
  
  for (const [index, file] of mgfFiles.entries()) {
    const option = document.createElement('option');
    option.value = index;
    const size = await getFileSize(file);
    option.textContent = formatFileDisplay(file.name, size);
    denovoMgfSelect.appendChild(option);
  }
  
  if (mgfFiles.length > 0) {
    denovoMgfSelect.style.display = 'block';
    denovoMgfSelectHelper.style.display = 'none';
  } else {
    denovoMgfSelect.style.display = 'none';
    denovoMgfSelectHelper.style.display = 'block';
  }
}

// Update FASTA selects (MS-Blast)
async function updateFastaSelects() {
  // Database select (single selection)
  dbFastaSelect.innerHTML = '';
  
  for (const [index, file] of fastaFiles.entries()) {
    const option = document.createElement('option');
    option.value = index;
    const size = await getFileSize(file);
    option.textContent = formatFileDisplay(file.name, size);
    dbFastaSelect.appendChild(option);
  }
  
  if (fastaFiles.length > 0) {
    dbFastaSelect.style.display = 'block';
    dbFastaSelectHelper.style.display = 'none';
  } else {
    dbFastaSelect.style.display = 'none';
    dbFastaSelectHelper.style.display = 'block';
  }
  
  // De novo files select (multiple selection - only novor/powernovo)
  denovoFastaSelect.innerHTML = '';
  
  for (const [index, file] of denovoFastaFiles.entries()) {
    // Find index in fastaFiles
    const originalIndex = fastaFiles.indexOf(file);
    const option = document.createElement('option');
    option.value = originalIndex;
    const size = await getFileSize(file);
    option.textContent = formatFileDisplay(file.name, size);
    denovoFastaSelect.appendChild(option);
  }
  
  if (denovoFastaFiles.length > 0) {
    denovoFastaSelect.style.display = 'block';
    denovoFastaSelectHelper.style.display = 'none';
  } else {
    denovoFastaSelect.style.display = 'none';
    denovoFastaSelectHelper.style.display = 'block';
  }
}

// File loading event listener (MGF and FASTA)
fileLoader.addEventListener('click', async () => {
  // Call browse() function on server side (Electron)
  const filePaths = await window.electronAPI.browseServer(
    'FILES',
    'Select MGF or FASTA files',
    '',
    [
      { name: 'Supported files', extensions: ['mgf', 'fasta', 'faa', 'fa'] },
      { name: 'MGF files', extensions: ['mgf'] },
      { name: 'FASTA files', extensions: ['fasta', 'faa', 'fa'] }
    ],
    ['openFile', 'multiSelections']
  );
  
  if (!filePaths || filePaths.length === 0) return;
  
  // Process selected files
  filePaths.forEach(filePath => {
    const ext = filePath.toLowerCase().split('.').pop();
    const fileName = filePath.split(/[\\/]/).pop(); // Extract filename
    
    // Create File-like object with path
    const fileObj = {
      name: fileName,
      path: filePath,
      isServerFile: false
    };
    
    if (ext === 'mgf') {
      mgfFiles.push(fileObj);
    } else if (['fasta', 'faa', 'fa'].includes(ext)) {
      fastaFiles.push(fileObj);
    }
  });
  
  updateMgfList();
  updateFastaList();
});

// Action buttons
document.getElementById('recover-btn').addEventListener('click', async () => {
  // Check if a job is already running
  if (warnIfJobRunning()) return;
  
  const outputFiles = await handleRecover(mgfFiles, mgfSelect);
  
  // Add generated files to mgfFiles
  if (outputFiles && outputFiles.length > 0) {
    outputFiles.forEach(fileInfo => {
      // Handle case where fileInfo is a string (path) or object {path, size}
      const filePath = typeof fileInfo === 'string' ? fileInfo : fileInfo.path;
      const fileSize = typeof fileInfo === 'object' ? fileInfo.size : undefined;
      
      const fileName = filePath.split('/').pop();
      mgfFiles.push({
        name: fileName,
        path: filePath,
        size: fileSize,
        isServerFile: true
      });
    });
    
    await updateMgfList();
    console.log(`${outputFiles.length} Recover file(s) added to MGF list`);
  }
});

document.getElementById('denovo-btn').addEventListener('click', async () => {
  // Check if a job is already running
  if (warnIfJobRunning()) return;
  
  const outputFiles = await handleDenovo(mgfFiles, denovoMgfSelect);
  
  // Add generated FASTA files to fastaFiles
  if (outputFiles && outputFiles.length > 0) {
    outputFiles.forEach(fileInfo => {
      const filePath = typeof fileInfo === 'string' ? fileInfo : fileInfo.path;
      const fileSize = typeof fileInfo === 'object' ? fileInfo.size : undefined;
      
      const fileName = filePath.split('/').pop();
      fastaFiles.push({
        name: fileName,
        path: filePath,
        size: fileSize,
        isServerFile: true
      });
    });
    
    await updateFastaList();
    console.log(`${outputFiles.length} De Novo file(s) added to FASTA list`);
  }
});

document.getElementById('msblast-btn').addEventListener('click', async () => {
  // Check if a job is already running
  if (warnIfJobRunning()) return;
  
  await handleMsblast(fastaFiles, denovoFastaSelect, dbFastaSelect);
});

// Initialization
updateMgfList();
updateFastaList();
