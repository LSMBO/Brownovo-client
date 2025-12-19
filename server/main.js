const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const config = require('./config.js');
const fs = require('fs');
const FormData = require('form-data');
const { CLIENT_RENEG_WINDOW } = require('tls');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Automatic reload in development mode
try {
  require('electron-reload')(path.join(__dirname, '../'), {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
} catch (err) {
  console.log('electron-reload not available');
}

app.commandLine.appendSwitch('--no-sandbox');

let mainWindow;

function createWindow() {
  const appIconPath = path.join(__dirname, "../img/logo.png");
  const appIcon = nativeImage.createFromPath(appIconPath);
  mainWindow = new BrowserWindow({
    width: config.get('DEBUG_MODE') ? 1800 : 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  if (!config.get('DEBUG_MODE')) mainWindow.maximize();
  if (config.get('DEBUG_MODE')) mainWindow.webContents.openDevTools();
}

async function browse(_, type, title, currentPath, filter, properties) {
  let defaultPath = "";
  if (currentPath) {
    defaultPath = path.dirname(currentPath);
  } else if (type === "FASTA") {
    defaultPath = config.get("fasta.path");
  } else if (type === "RAW") {
    defaultPath = config.get("raw.file.path");
  }
  
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { 
    title, 
    defaultPath, 
    filters: filter, 
    properties 
  });
  
  return canceled ? "" : filePaths;   
}

async function getFileStats(_, filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime
    };
  } catch (error) {
    console.error(`Stats error for ${filePath}:`, error);
    throw error;
  }
}

async function getJobTimeouts() {
  return {
    upload: parseInt(config.get('job.timeout.upload')) * 1000 || 3600000,
    recover: parseInt(config.get('job.timeout.recover')) * 1000 || 3600000,
    denovo: parseInt(config.get('job.timeout.denovo')) * 1000 || 604800000,
    msblast: parseInt(config.get('job.timeout.msblast')) * 1000 || 28800000
  };
}

const SERVER_URL = config.get('server.url');

async function sendFiles(_, filePaths, destinationPath) {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const fileSize = stats.size;
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Build full destination path
      const fullDestPath = `${destinationPath}/${fileName}`;
      
      console.log(`Sending ${fileName} (${fileSize} bytes) to ${fullDestPath}...`);
      
      const response = await fetch(`${SERVER_URL}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: fileContent,
          file_path: fullDestPath,
          size: fileSize
        })
      });
      
      const result = await response.json();
      
      results.push({
        filePath: result.file,
        success: result.success || false,
        skipped: result.skipped || false,
        message: result.message,
      });
      
      console.log(`${fileName}: ${result.skipped ? 'skipped' : 'uploaded'} - ${result.message}`);
      
    } catch (error) {
      console.error(`Error for ${path.basename(filePath)}:`, error);
      results.push({
        file: path.basename(filePath),
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function recover(_, mgfFiles, params) {
  try {
    console.log("Starting Recover with params:", params)
    const response = await fetch(`${SERVER_URL}/recover_start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parameters: {
          mgf_files: mgfFiles,
          emergence: params.emergence,
          min_upn: params.min_upn,
          intensity_method: params.intensity_method
        }
      })
    });
    
    const result = await response.json();
    console.log("Recover result:", result);
    return result;
    
  } catch (error) {
    console.error('Recover error:', error);
    throw error;
  }
}

async function getRecoverStats(_, jsonPath) {
  try {
    const response = await fetch(`${SERVER_URL}/recover_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        json_path: jsonPath
      })
    });
    
    const result = await response.json();
    console.log("Recover stats:", result);
    return result;
    
  } catch (error) {
    console.error('Error fetching recover stats:', error);
    throw error;
  }
}

async function denovo(_, mgfFiles, params) {
  try {
    console.log("Starting De Novo with params:", params)
    const response = await fetch(`${SERVER_URL}/denovo_start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parameters: {
          mgf_files: mgfFiles,
          method: params.method,
          min_global_score: params.min_global_score,
          min_residue_score: params.min_residue_score,
          min_peptide_length: params.min_peptide_length
        }
      })
    });
    
    const result = await response.json();
    console.log("De Novo result:", result);
    return result;
    
  } catch (error) {
    console.error('De Novo error:', error);
    throw error;
  }
}

async function getDenovoStats(_, jsonPath) {
  try {
    const response = await fetch(`${SERVER_URL}/denovo_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        json_path: jsonPath
      })
    });
    
    const result = await response.json();
    console.log("De Novo stats:", result);
    return result;
    
  } catch (error) {
    console.error('Error fetching de novo stats:', error);
    throw error;
  }
}

async function msblast(_, fastaFiles, params) {
  try {
    const response = await fetch(`${SERVER_URL}/msblast_start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parameters: {
          fasta_files: fastaFiles,
          database: params.database
        }
      })
    });
    
    const result = await response.json();
    console.log("MS-Blast result:", result);
    return result;
    
  } catch (error) {
    console.error('MS-Blast error:', error);
    throw error;
  }
}

async function downloadFile(_, filePath) {
  try {
    const fileName = path.basename(filePath);
    console.log(`Preparing to download file: ${fileName}`);
    
    // Ask user where to save
    const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save file',
      defaultPath: fileName,
      filters: [
        { name: 'TSV files', extensions: ['tsv'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    
    if (canceled || !savePath) {
      return { success: false, message: 'Download canceled' };
    }
    
    // Download from server
    const response = await fetch(`${SERVER_URL}/download?file=${encodeURIComponent(filePath)}`);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const fileContent = await response.text();
    
    // Save to local file
    fs.writeFileSync(savePath, fileContent);
    
    console.log(`File downloaded to: ${savePath}`);
    return { success: true, savePath };
    
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

app.whenReady().then(() => {
  ipcMain.handle('browse', browse);
  ipcMain.handle('send-files', sendFiles);
  ipcMain.handle('recover', recover);
  ipcMain.handle('get-recover-stats', getRecoverStats);
  ipcMain.handle('get-denovo-stats', getDenovoStats);
  ipcMain.handle('denovo', denovo);
  ipcMain.handle('msblast', msblast);
  ipcMain.handle('download-file', downloadFile);
  ipcMain.handle('get-file-stats', getFileStats);
  ipcMain.handle('get-job-timeouts', getJobTimeouts);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
