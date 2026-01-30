const fs = require('fs');
const os = require('os');
const path = require('path');

const workDirs = new Set();

function sleepMs(duration) {
  const buffer = new SharedArrayBuffer(4);
  const array = new Int32Array(buffer);
  Atomics.wait(array, 0, 0, duration);
}

function safeRemoveDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return true;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 0 });
    } catch (error) {
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code)) {
        return false;
      }
    }

    if (!fs.existsSync(dirPath)) {
      return true;
    }

    sleepMs(200 + attempt * 100);
  }

  return !fs.existsSync(dirPath);
}

function registerWorkDir(dirPath) {
  if (dirPath) {
    workDirs.add(dirPath);
  }
}

function unregisterWorkDir(dirPath) {
  if (dirPath) {
    workDirs.delete(dirPath);
  }
}

function cleanupWorkDirs() {
  if (workDirs.size === 0) {
    return;
  }

  workDirs.forEach((dirPath) => {
    try {
      process.chdir(os.homedir());
    } catch (error) {
      process.chdir(path.parse(process.cwd()).root);
    }

    const removed = safeRemoveDir(dirPath);
    if (!removed) {
      console.log(` • Не удалось удалить рабочую директорию: ${dirPath}`);
    } else {
      console.log(` • Удалена рабочая директория: ${dirPath}`);
    }
  });
  workDirs.clear();
}

module.exports = {
  cleanupWorkDirs,
  registerWorkDir,
  unregisterWorkDir
};
