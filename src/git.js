const shell = require('shelljs');
const { fatalGitError } = require('./logger');

const executedCommands = [];

function recordCommand(command) {
  executedCommands.push(command);
}

function runGit(command, errorMessage) {
  recordCommand(command);
  const result = shell.exec(command, {silent: true});
  if (result.code !== 0) {
    fatalGitError(errorMessage, executedCommands);
  }
  return result;
}

function cloneRepo(repoUrl, folderPath) {
  runGit(`git clone ${repoUrl} "${folderPath}"`, 'Не удалось клонировать репозиторий');
}

function fetchAll() {
  runGit('git fetch --all', 'Не удалось получить ветки с сервера');
}

function showCommitSubject(commit) {
  return runGit(`git show --pretty=format:"%s" -s ${commit}`, 'Не удалось получить сообщение коммита').stdout;
}

function switchToRemoteBranch(branch) {
  runGit(`git switch -c ${branch} origin/${branch}`, `Не удалось переключиться на ветку ${branch}`);
}

function createBranch(branch) {
  runGit(`git checkout -b ${branch}`, `Не удалось создать ветку ${branch}`);
}

function cherryPickNoCommit(commit) {
  runGit(`git cherry-pick -n ${commit}`, 'Cherry-pick не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!');
}

function commitChanges(title, body) {
  runGit('git add .', 'Cherry-pick не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!');
  runGit(`git commit -m "${title}" -m "${body}"`, 'Cherry-pick не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!');
}

function pushBranch(branch) {
  runGit(`git push origin ${branch}`, 'Не удалось выполнить push');
}

function ensureRemoteBranch(branch) {
  runGit(`git show-ref --verify --quiet refs/remotes/origin/${branch}`, `Не найдена ветка ${branch} в origin`);
}

function mergeFrom(branch) {
  runGit(`git merge origin/${branch}`, 'Merge не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!');
}

module.exports = {
  cherryPickNoCommit,
  cloneRepo,
  commitChanges,
  createBranch,
  ensureRemoteBranch,
  fetchAll,
  mergeFrom,
  pushBranch,
  showCommitSubject,
  switchToRemoteBranch
};
