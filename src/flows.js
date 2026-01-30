const path = require('path');
const shell = require('shelljs');
const open = require('open');
const { promptInput } = require('./cli');
const { createPullRequest, getPullRequest } = require('./bitbucket');
const { ensureWorkDir, getAccessToken, loadConfig, saveConfig } = require('./config');
const {
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
} = require('./git');
const { fatalError, showOperation } = require('./logger');
const {
  checkReleaseVersion,
  extractPullRequestName,
  extractPullRequestNumber,
  extractTaskNumber,
  parseCommitUrl,
  parsePullRequestUrl
} = require('./parsers');

async function handleTokenSave(bbtokenValue) {
  const token = bbtokenValue || await promptInput('Введите токен Bitbucket: ');
  if (!token) {
    fatalError('Токен не может быть пустым');
  }

  const config = loadConfig();
  saveConfig({
    ...config,
    bbToken: token
  });

  showOperation('Токен сохранён');
}

async function handlePullRequestMerge(pullRequestUrl) {
  const parsed = parsePullRequestUrl(pullRequestUrl);
  if (!parsed) {
    fatalError('Невозможно распарсить ссылку на pull-request');
  }

  const token = getAccessToken();

  showOperation('Получение данных pull-request');
  const pullRequest = await getPullRequest(parsed, token);

  const sourceRefId = pullRequest?.fromRef?.id || '';
  const sourceBranch = pullRequest?.fromRef?.displayId || sourceRefId.replace(/^refs\/heads\//, '');
  if (!sourceBranch) {
    fatalError('Не удалось определить исходную ветку pull-request');
  }

  const workDir = ensureWorkDir();
  const folderPath = path.join(workDir, `__chpicker__${parsed.repo}`);
  const rootDir = shell.pwd().toString();

  shell.rm('-rf', folderPath);

  showOperation('Клонирование репозитория');
  cloneRepo(`${parsed.url}/scm/${parsed.project}/${parsed.repo}.git`, folderPath);

  shell.cd(folderPath);

  showOperation('Получение всех веток с сервера');
  fetchAll();

  showOperation(`Переключение на ветку ${sourceBranch}`);
  switchToRemoteBranch(sourceBranch);

  const mainBranch = 'master';
  ensureRemoteBranch(mainBranch);

  showOperation(`Подлив изменений из ${mainBranch}`);
  mergeFrom(mainBranch);

  showOperation('Push ветки на сервер');
  pushBranch(sourceBranch);

  showOperation('Удаляем директорию с кодом');
  shell.cd(rootDir);
  shell.rm('-rf', folderPath);

  showOperation('Готово');
}

async function handleCherryPick(commitUrl, releaseVersionRaw) {
  const releaseVersion = releaseVersionRaw.replace(/\.x$/, '').replace(/^release\//, '');

  checkReleaseVersion(releaseVersion);

  const {
    url,
    project,
    repo,
    commit
  } = parseCommitUrl(commitUrl);

  const workDir = ensureWorkDir();
  const folderPath = path.join(workDir, `__chpicker__${repo}`);
  const rootDir = shell.pwd().toString();

  shell.rm('-rf', folderPath);

  showOperation('Клонирование репозитория');
  cloneRepo(`${url}/scm/${project}/${repo}.git`, folderPath);

  shell.cd(folderPath);

  showOperation('Получение всех веток с сервера');
  fetchAll();

  const commitName = showCommitSubject(commit);
  const taskNumber = extractTaskNumber(commitName);
  const pullRequestNumber = extractPullRequestNumber(commitName);
  const pullRequestName = extractPullRequestName(commitName).replaceAll('"', "'");

  const cherryPickBranchName = `cherrypick/${taskNumber}_${releaseVersion}.x`;
  const releaseBranchName = `release/${releaseVersion}.x`;

  showOperation(`Переключение на ветку ${releaseBranchName}`);
  switchToRemoteBranch(releaseBranchName);

  showOperation(`Создание от неё ветки ${cherryPickBranchName}`);
  createBranch(cherryPickBranchName);

  showOperation('Выполнение cherry-pick');
  cherryPickNoCommit(commit);

  showOperation('Коммит изменений');
  commitChanges(
    `${taskNumber} | 🍒 ${releaseVersion}.x | ${pullRequestName}`,
    `Pull request #${pullRequestNumber}`
  );

  showOperation('Push новой ветки на сервер');
  pushBranch(cherryPickBranchName);

  const token = getAccessToken();
  const pullRequestPayload = {
    title: `${taskNumber} | 🍒 ${releaseVersion}.x | ${pullRequestName}`,
    description: `Pull request #${pullRequestNumber}`,
    fromRef: {
      id: `refs/heads/${cherryPickBranchName}`,
      repository: {
        slug: repo,
        project: {
          key: project
        }
      }
    },
    toRef: {
      id: `refs/heads/${releaseBranchName}`,
      repository: {
        slug: repo,
        project: {
          key: project
        }
      }
    }
  };

  showOperation('Создание pull-request');
  const createdPullRequest = await createPullRequest({ url, project, repo }, token, pullRequestPayload);

  showOperation('Удаляем директорию с кодом');
  shell.cd(rootDir);
  shell.rm('-rf', folderPath);

  const createdPullRequestId = createdPullRequest?.id;
  if (!createdPullRequestId) {
    fatalError('Не удалось создать pull-request');
  }

  showOperation('Открываем созданный pull-request');
  open(`${url}/projects/${project}/repos/${repo}/pull-requests/${createdPullRequestId}/overview`);
}

module.exports = {
  handleCherryPick,
  handlePullRequestMerge,
  handleTokenSave
};
