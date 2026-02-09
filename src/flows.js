const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const open = require('open');
const { promptInput } = require('./cli');
const { registerWorkDir, unregisterWorkDir } = require('./cleanup');
const {
  addPullRequestReviewer,
  createPullRequest,
  getDefaultReviewers,
  getRepository,
  getPullRequest
} = require('./bitbucket');
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

function addReviewerToMap(reviewerMap, userLike) {
  const user = userLike?.user || userLike;
  const userName = user?.name || null;
  const userSlug = user?.slug || null;
  const key = userName || userSlug;

  if (!key) {
    return;
  }

  reviewerMap.set(key, {
    user: userName ? { name: userName } : { slug: userSlug }
  });
}

function getErrorMessage(error) {
  return error?.message || `${error}`;
}

function getReviewerKey(userLike) {
  return userLike?.user?.name
    || userLike?.user?.slug
    || userLike?.name
    || userLike?.slug
    || null;
}

function getExistingReviewerKeysFromPullRequest(pullRequest) {
  const keys = new Set();
  const reviewers = Array.isArray(pullRequest?.reviewers) ? pullRequest.reviewers : [];
  const participants = Array.isArray(pullRequest?.participants) ? pullRequest.participants : [];

  reviewers.forEach((reviewer) => {
    const key = getReviewerKey(reviewer);
    if (key) {
      keys.add(key);
    }
  });

  participants.forEach((participant) => {
    if (participant?.role !== 'REVIEWER') {
      return;
    }

    const key = getReviewerKey(participant);
    if (key) {
      keys.add(key);
    }
  });

  return keys;
}

function getPullRequestAuthorKey(pullRequest) {
  return pullRequest?.author?.user?.name
    || pullRequest?.author?.user?.slug
    || null;
}

function addReviewersFromUsers(reviewerMap, users) {
  if (!Array.isArray(users)) {
    return;
  }

  users.forEach((user) => addReviewerToMap(reviewerMap, user));
}

function extractDefaultReviewers(reviewersPayload) {
  const reviewerMap = new Map();
  const values = [];

  if (Array.isArray(reviewersPayload)) {
    values.push(...reviewersPayload);
  }

  if (Array.isArray(reviewersPayload?.values)) {
    values.push(...reviewersPayload.values);
  }

  if (Array.isArray(reviewersPayload?.reviewers)) {
    values.push(...reviewersPayload.reviewers);
  }

  values.forEach((item) => {
    const directUser = item?.user || item;
    if (directUser?.name || directUser?.slug) {
      addReviewerToMap(reviewerMap, directUser);
      return;
    }

    addReviewersFromUsers(reviewerMap, item?.reviewers);

    if (Array.isArray(item?.reviewerGroups)) {
      item.reviewerGroups.forEach((group) => addReviewersFromUsers(reviewerMap, group?.users));
    }
  });

  return [...reviewerMap.values()];
}

function createUniqueWorkFolder(workDir, repoName) {
  const safeRepoName = `${repoName || 'repo'}`
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[. ]+$/, '') || 'repo';

  return fs.mkdtempSync(path.join(workDir, `${safeRepoName}-`));
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
  const folderPath = createUniqueWorkFolder(workDir, parsed.repo);
  const rootDir = shell.pwd().toString();

  registerWorkDir(folderPath);

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
  unregisterWorkDir(folderPath);

  showOperation('Готово');
}

async function handleCherryPick(commitUrl, releaseVersionRaw) {
  const releaseVersion = releaseVersionRaw.replace(/\.x$/, '').replace(/^release\//, '');

  checkReleaseVersion(releaseVersion);

  const token = getAccessToken();

  const {
    url,
    project,
    repo,
    commit
  } = parseCommitUrl(commitUrl);

  const workDir = ensureWorkDir();
  const folderPath = createUniqueWorkFolder(workDir, repo);
  const rootDir = shell.pwd().toString();

  registerWorkDir(folderPath);

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

  const sourceRefId = `refs/heads/${cherryPickBranchName}`;
  const targetRefId = `refs/heads/${releaseBranchName}`;
  const bbTargetRepo = { url, project, repo };
  let defaultReviewers = [];
  let repoId = null;

  try {
    const repository = await getRepository(bbTargetRepo, token);
    repoId = repository?.id || null;
  } catch (error) {
    showOperation(`Не удалось получить id репозитория (${getErrorMessage(error)}), продолжаем без sourceRepoId/targetRepoId`);
  }

  try {
    showOperation('Получение дефолтных ревьюверов');
    const defaultReviewersPayload = await getDefaultReviewers(
      bbTargetRepo,
      token,
      sourceRefId,
      targetRefId,
      repoId,
      repoId
    );
    defaultReviewers = extractDefaultReviewers(defaultReviewersPayload);

    if (defaultReviewers.length === 0) {
      const sourceBranchRef = sourceRefId.replace(/^refs\/heads\//, '');
      const targetBranchRef = targetRefId.replace(/^refs\/heads\//, '');
      if (sourceBranchRef !== sourceRefId || targetBranchRef !== targetRefId) {
        showOperation('Повторный поиск дефолтных ревьюверов по коротким именам веток');
        const fallbackReviewersPayload = await getDefaultReviewers(
          bbTargetRepo,
          token,
          sourceBranchRef,
          targetBranchRef,
          repoId,
          repoId
        );
        defaultReviewers = extractDefaultReviewers(fallbackReviewersPayload);
      }
    }

    showOperation(`Найдено дефолтных ревьюверов: ${defaultReviewers.length}`);
  } catch (error) {
    showOperation(`Не удалось получить дефолтных ревьюверов (${getErrorMessage(error)}), PR будет создан без них`);
  }

  const pullRequestPayload = {
    title: `${taskNumber} | 🍒 ${releaseVersion}.x | ${pullRequestName}`,
    description: `Pull request #${pullRequestNumber}`,
    fromRef: {
      id: sourceRefId,
      repository: {
        slug: repo,
        project: {
          key: project
        }
      }
    },
    toRef: {
      id: targetRefId,
      repository: {
        slug: repo,
        project: {
          key: project
        }
      }
    }
  };

  if (defaultReviewers.length > 0) {
    pullRequestPayload.reviewers = defaultReviewers;
  }

  showOperation('Создание pull-request');
  const createdPullRequest = await createPullRequest(bbTargetRepo, token, pullRequestPayload);

  showOperation('Удаляем директорию с кодом');
  shell.cd(rootDir);
  shell.rm('-rf', folderPath);
  unregisterWorkDir(folderPath);

  const createdPullRequestId = createdPullRequest?.id;
  if (!createdPullRequestId) {
    fatalError('Не удалось создать pull-request');
  }

  if (defaultReviewers.length > 0) {
    const existingReviewerKeys = getExistingReviewerKeysFromPullRequest(createdPullRequest);
    const pullRequestAuthorKey = getPullRequestAuthorKey(createdPullRequest);
    const reviewersToAdd = defaultReviewers.filter((reviewer) => {
      const key = getReviewerKey(reviewer);
      return key && key !== pullRequestAuthorKey && !existingReviewerKeys.has(key);
    });

    if (reviewersToAdd.length > 0) {
      showOperation('Fallback: добавление дефолтных ревьюверов в созданный pull-request');
      for (const reviewer of reviewersToAdd) {
        const userName = reviewer?.user?.name || reviewer?.user?.slug || '<unknown>';
        try {
          await addPullRequestReviewer(
            bbTargetRepo,
            token,
            createdPullRequestId,
            reviewer.user
          );
        } catch (error) {
          showOperation(`Не удалось добавить ревьювера ${userName}: ${getErrorMessage(error)}`);
        }
      }
    }
  }

  showOperation('Открываем созданный pull-request');
  open(`${url}/projects/${project}/repos/${repo}/pull-requests/${createdPullRequestId}/overview`);
}

module.exports = {
  handleCherryPick,
  handlePullRequestMerge,
  handleTokenSave
};
