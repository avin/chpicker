const os = require('os');
const path = require('path');
const shell = require('shelljs');
const { fatalError } = require('./logger');

function getAppDir() {
  return path.join(os.homedir(), '.chpicker');
}

function getConfigPath() {
  return path.join(getAppDir(), 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();

  if (!shell.test('-e', configPath)) {
    return {};
  }

  try {
    return JSON.parse(shell.cat(configPath).toString());
  } catch (error) {
    fatalError('Не удалось прочитать конфиг');
  }
}

function saveConfig(config) {
  const appDir = getAppDir();

  if (!shell.test('-d', appDir)) {
    shell.mkdir('-p', appDir);
  }

  shell.ShellString(`${JSON.stringify(config, null, 2)}\n`).to(getConfigPath());
}

function getAccessToken() {
  const config = loadConfig();
  const token = config.bbToken;

  if (!token) {
    fatalError('Не найден токен. Используйте --bbtoken для сохранения');
  }

  return token;
}

function getProxyUrl() {
  const config = loadConfig();
  const proxyValue = config.proxy || config.httpProxy;

  if (!proxyValue) {
    return null;
  }

  try {
    return new URL(proxyValue);
  } catch (error) {
    fatalError('Неверный формат proxy в конфиге');
  }
}

function ensureWorkDir() {
  const workDir = path.join(getAppDir(), 'work');
  if (!shell.test('-d', workDir)) {
    shell.mkdir('-p', workDir);
  }
  return workDir;
}

module.exports = {
  ensureWorkDir,
  getAccessToken,
  getProxyUrl,
  loadConfig,
  saveConfig
};
