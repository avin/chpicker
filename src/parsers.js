const { fatalError } = require('./logger');

function extractTaskNumber(val) {
  const regex = /[A-Z0-9]+-\d+/;
  const match = val.match(regex);

  if (match) {
    return match[0];
  }

  fatalError('Не удалось извлечь номер задачи');
}

function extractPullRequestNumber(val) {
  const regex = /#(\d+)/;
  const match = val.match(regex);

  if (match) {
    return match[1];
  }

  fatalError('Не удалось извлечь номер PR');
}

function extractPullRequestName(val) {
  const regex = /-\d+\s\|\s(.+)$/;
  const match = val.match(regex);

  if (match) {
    return match[1];
  }

  fatalError('Не удалось извлечь название PR');
}

function checkReleaseVersion(val) {
  const regex = /^\d+\.\d+$/;
  if (!regex.test(val)) {
    fatalError('Неверный номер релиза');
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

  fatalError('Невозможно распарсить ссылку на коммит');
}

function parsePullRequestUrl(url) {
  const regex = /(.*)\/projects\/(.*?)\/repos\/(.*?)\/pull-requests\/(\d+)(\/|$)/;
  const match = url.match(regex);

  if (match) {
    return {
      url: match[1],
      project: match[2],
      repo: match[3],
      pullRequestId: match[4]
    };
  }

  return null;
}

module.exports = {
  extractTaskNumber,
  extractPullRequestName,
  extractPullRequestNumber,
  checkReleaseVersion,
  parseCommitUrl,
  parsePullRequestUrl
};
