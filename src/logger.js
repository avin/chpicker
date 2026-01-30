const shell = require('shelljs');
const { cleanupWorkDirs } = require('./cleanup');

function fatalError(message) {
  shell.echo(`❌ Ошибка: ${message}`);
  cleanupWorkDirs();
  process.exit(1);
}

function showOperation(name) {
  shell.echo(` • ${name}`);
}

function fatalGitError(message, commands = []) {
  shell.echo(`❌ Ошибка: ${message}`);
  if (commands.length > 0) {
    const line = '------------------------';
    shell.echo('Выполненные git-команды:');
    shell.echo(line);
    commands.forEach((command) => shell.echo(`  ${command}`));
    shell.echo(line);
  }
  cleanupWorkDirs();
  process.exit(1);
}

module.exports = {
  fatalError,
  fatalGitError,
  showOperation
};
