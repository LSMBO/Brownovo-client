const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const config = require('./config.js');

app.commandLine.appendSwitch('--no-sandbox'); // without this, the app crashes when launched from a network drive

function createWindow () {
  const appIconPath = path.join(__dirname, "../img/icon.png");
  const appIcon = nativeImage.createFromPath(appIconPath);
  mainWindow = new BrowserWindow({
    width: config.DEBUG_MODE ? 1800 : 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // uncomment the next line to open the app in full screen mode
  if(!config.DEBUG_MODE) mainWindow.maximize();

  // Open the DevTools.
  if(config.DEBUG_MODE) mainWindow.webContents.openDevTools()
}

async function browse(_, type, title, currentPath, filter, properties) {
  var defaultPath = "";
  if(currentPath != "") defaultPath = path.dirname(currentPath);
  else if(type == "FASTA") {
    console.log("Getting fasta path from config", config.get("fasta.path"));
    defaultPath = config.get("fasta.path");
  } else if(type == "RAW") defaultPath = config.get("raw.file.path");
  // console.log(`Browse here: "${defaultPath}"`);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: title, defaultPath: defaultPath, filters: filter, properties: properties });
  return canceled ? "" : filePaths;
}

app.whenReady().then(() => {
  ipcMain.handle('browse', browse);
//   ipcMain.handle('cancel-job', srv.cancelJob);
//   ipcMain.handle('check-rsync', srv.checkRsyncAgent);
//   ipcMain.handle('check-server', srv.checkServerVersion);
//   ipcMain.handle('close-app', exitApp);
//   ipcMain.handle('count-existing-files', countExistingFiles);
//   ipcMain.handle('delete-job', srv.deleteJob);
//   ipcMain.handle('download', srv.downloadFile);
//   ipcMain.handle('get-config', config.getConfig);
//   ipcMain.handle('get-debug-mode', getDebugMode);
//   ipcMain.handle('get-disk-usage', srv.getDiskUsage);
//   ipcMain.handle('get-file-content', srv.getFileContent);
//   ipcMain.handle('get-last-jobs', srv.getLastJobs);
//   ipcMain.handle('get-transfer-progress', srv.transferProgress);
//   // ipcMain.handle('get-unc-paths', getUncPaths);
//   ipcMain.handle('get-user-name', getUserName);
//   ipcMain.handle('list-apps', srv.listApps);
//   ipcMain.handle('list-flavors', srv.listFlavors);
//   ipcMain.handle('list-storage', srv.listStorage);
//   ipcMain.handle('load-file', loadFile);
//   ipcMain.handle('open-url', openUrl);
//   ipcMain.handle('open-project-url', openProjectUrl);
//   ipcMain.handle('reset-config', config.resetConfig);
//   ipcMain.handle('search-jobs', srv.searchJobs);
//   ipcMain.handle('save-dialog', saveDialog);
//   ipcMain.handle('save-file', saveFile);
//   ipcMain.handle('set-config', config.saveConfig);
//   ipcMain.handle('start-job', srv.createJob);
//   ipcMain.handle('restart-app', () => { app.relaunch(); app.exit(); });
//   ipcMain.handle('test-stuff', testStuff);
  
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})