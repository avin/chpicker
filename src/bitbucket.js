const { requestJson } = require('./http');

function buildRepoApiBase(parsed) {
  return `${parsed.url}/rest/api/1.0/projects/${parsed.project}/repos/${parsed.repo}`;
}

function buildDefaultReviewersApiBase(parsed, version = 'latest') {
  return `${parsed.url}/rest/default-reviewers/${version}/projects/${parsed.project}/repos/${parsed.repo}`;
}

async function getPullRequest(parsed, token) {
  const apiUrl = `${buildRepoApiBase(parsed)}/pull-requests/${parsed.pullRequestId}`;
  return requestJson(apiUrl, token);
}

async function getRepository(parsed, token) {
  const apiUrl = buildRepoApiBase(parsed);
  return requestJson(apiUrl, token);
}

async function createPullRequest(parsed, token, payload) {
  const apiUrl = `${buildRepoApiBase(parsed)}/pull-requests`;
  return requestJson(apiUrl, token, 'POST', payload);
}

async function getDefaultReviewers(parsed, token, sourceRefId, targetRefId, sourceRepoId, targetRepoId) {
  const queryParams = new URLSearchParams();
  if (sourceRefId) {
    queryParams.set('sourceRefId', sourceRefId);
  }
  if (targetRefId) {
    queryParams.set('targetRefId', targetRefId);
  }
  if (sourceRepoId) {
    queryParams.set('sourceRepoId', sourceRepoId);
  }
  if (targetRepoId) {
    queryParams.set('targetRepoId', targetRepoId);
  }

  const queryString = queryParams.toString();
  const buildApiUrl = (version) => `${buildDefaultReviewersApiBase(parsed, version)}/reviewers${queryString ? `?${queryString}` : ''}`;

  try {
    return await requestJson(buildApiUrl('latest'), token);
  } catch (error) {
    if (!`${error?.message || ''}`.includes('HTTP 404')) {
      throw error;
    }
  }

  return requestJson(buildApiUrl('1.0'), token);
}

async function addPullRequestReviewer(parsed, token, pullRequestId, reviewerUser) {
  const apiUrl = `${buildRepoApiBase(parsed)}/pull-requests/${pullRequestId}/participants`;
  const payload = {
    user: reviewerUser,
    role: 'REVIEWER'
  };

  return requestJson(apiUrl, token, 'POST', payload);
}

module.exports = {
  addPullRequestReviewer,
  getRepository,
  getPullRequest,
  createPullRequest,
  getDefaultReviewers
};
