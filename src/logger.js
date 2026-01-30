const shell = require('shelljs');

function fatalError(message) {
  shell.echo(`❌ Ошибка: ${message}`);
  process.exit(1);
}

function showOperation(name) {
  shell.echo(` • ${name}`);
}

function fatalGitError(message, commands = []) {
  shell.echo(`❌ Ошибка: ${message}`);
  if (commands.length > 0) {
    shell.echo('Выполненные git-команды:');
    commands.forEach((command) => shell.echo(`  ${command}`));
  }
  process.exit(1);
}

module.exports = {
  fatalError,
  fatalGitError,
  showOperation
};
