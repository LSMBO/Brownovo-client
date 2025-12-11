const { app } = require('electron');
const fs = require('fs');
const path = require('path');
// const log = require('electron-log/main');

const CONFIG = new Map();
const CONFIG_FILE = path.join(__dirname, "../application.conf");
const USER_CONFIG_FILE = path.join(app.getPath('userData'), "brownovo.conf");

function loadConfigFile(file) {
  const regex = /^\s*([^=\s]+)\s*=\s*(.*)\s*$/;
  for(let line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    line = line.trim(); // remove space and tabs at the beginning and end of each line
    line = line.replace(/;$/, ""); // remove semicolon, because it's just too tempting to end lines with that character
    if(!line.startsWith("//") && !line.startsWith("#") && line.includes("=")) { // do not consider commented lines
      const matches = line.match(regex);
      if(matches !== null) CONFIG.set(matches[1], matches[2].replace(/^["']/, "").replace(/['"]$/, ""));
    }
  }
}

function loadConfig() {
  if(CONFIG.size == 0) {
    // get application config
    if(fs.existsSync(CONFIG_FILE)) loadConfigFile(CONFIG_FILE);
    // else log.error(`Could not find ${CONFIG_FILE}`);
    // overwrite with user settings, if there are any
    if(fs.existsSync(USER_CONFIG_FILE)) loadConfigFile(USER_CONFIG_FILE);
    // else log.error(`Could not find ${USER_CONFIG_FILE}`);
    // also add the licence
    // if(fs.existsSync(LICENSE_FILE)) CONFIG.set("license", fs.readFileSync(LICENSE_FILE, 'utf-8'));
    // else log.error(`Could not find ${LICENSE_FILE}`);
    // and the version number
    CONFIG.set("brownovo.version", app.getVersion());
  }
}
function get(key) {
  loadConfig();
  return CONFIG.has(key) ? CONFIG.get(key) : "";
}

module.exports = { get };