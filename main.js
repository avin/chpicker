#!/usr/bin/env node

const shell = require('shelljs');
const open = require('open');

function fatalError(message) {
  shell.echo(`❌ Ошибка: ${message}`);
  process.exit(1);
}

function showOperation(name) {
  shell.echo(` • ${name}`);
}

function extractTaskNumber(val) {
  const regex = /[A-Z0-9]+-\d+/;
  const match = val.match(regex);

  if (match) {
    return match[0];
  }

  fatalError('Не удалось извлечь номер задачи')
}

function extractPullRequestNumber(val) {
  const regex = /#(\d+)/;
  const match = val.match(regex);

  if (match) {
    return match[1];
  }

  fatalError('Не удалось извлечь номер PR')
}

function extractPullRequestName(val) {
  const regex = /-\d+\s\|\s(.+)$/;
  const match = val.match(regex);

  if (match) {
    return match[1];
  }

  fatalError('Не удалось извлечь название PR')
}

function checkReleaseVersion(val) {
  const regex = /^\d+\.\d+$/;
  if(!regex.test(val)){
    fatalError('Неверный номер релиза')
  }
}

function parseCommitUrl(url) {
  const regex = /(.*)\/projects\/(.*?)\/repos\/(.*?)\/commits\/(.*?)(\/|$)/;
  const match = url.match(regex);

  if (match) {
    return {
      url: match[1],
      project: match[2],
      repo: match[3],
      commit: match[4]
    };
  }

  fatalError('Невозможно распарсить ссылку на коммит')
}

function main() {
  const commitUrl = process.argv[2];
  const releaseVersion = (process.argv[3] || '').replace(/\.x$/, '').replace(/^release\//, '');

  checkReleaseVersion(releaseVersion);

  const {
    url,
    project,
    repo,
    commit
  } = parseCommitUrl(commitUrl);

  const folderName = `__chpicker__${repo}`

  shell.rm('-rf', folderName);

  showOperation('Клонирование репозитория')
  if (shell.exec(`git clone ${url}/scm/${project}/${repo}.git ${folderName}`, {silent: true}).code !== 0) {
    shell.echo('Не удалось клонировать репозиторий');
    shell.exit(1);
  }

  shell.cd(folderName);

  showOperation('Получение всех веток с сервера')
  if (shell.exec('git fetch --all', {silent: true}).code !== 0) {
    fatalError('Не удалось получить ветки с сервера')
  }

  const commitName = shell.exec(`git show --pretty=format:"%s" -s ${commit}`, {silent: true}).stdout;

  const taskNumber = extractTaskNumber(commitName);
  const pullRequestNumber = extractPullRequestNumber(commitName);
  const pullRequestName = extractPullRequestName(commitName).replaceAll('"', "'");

  const cherryPickBranchName = `cherrypick/${taskNumber}_${releaseVersion}.x`;
  const releaseBranchName = `release/${releaseVersion}.x`;

  showOperation(`Переключение на ветку ${releaseBranchName}`)
  if (shell.exec(`git switch -c ${releaseBranchName} origin/${releaseBranchName}`, {silent: true}).code !== 0) {
    fatalError(`Не удалось переключиться на ветку ${releaseBranchName}`)
  }

  showOperation(`Создание от неё ветки ${cherryPickBranchName}`)
  if (shell.exec(`git checkout -b ${cherryPickBranchName}`, {silent: true}).code !== 0) {
    fatalError(`Не удалось создать ветку ${cherryPickBranchName}`)
  }

  showOperation('Выполнение cherry-pick')
  if (shell.exec(`git cherry-pick -n ${commit}`, {silent: true}).code !== 0) {
    fatalError('Cherry-pick не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!')
  }

  showOperation('Коммит изменений')
  if (shell.exec(`git add .`, {silent: true}).code !== 0 || shell.exec(`git commit -m "${taskNumber} | 🍒 ${releaseVersion}.x | ${pullRequestName}" -m "Pull request #${pullRequestNumber}"`, {silent: true}).code !== 0) {
    fatalError('Cherry-pick не удался. Возможно из-за конфликтов. Выполните дальнейшие действия вручную!')
  }

  showOperation('Push новой ветки на сервер')
  if (shell.exec(`git push origin ${cherryPickBranchName}`, {silent: true}).code !== 0) {
    fatalError('Не удалось выполнить push')
  }

  showOperation(`Удаляем директорию с кодом`)
  shell.cd('..');
  shell.rm('-rf', folderName);

  showOperation('Открываем страницу создания PR...');
  open(`${url}/projects/${project}/repos/${repo}/pull-requests?create&sourceBranch=${encodeURIComponent(`refs/heads/${cherryPickBranchName}`)}&targetBranch=${encodeURIComponent(`refs/heads/${releaseBranchName}`)}`);
}

main();