const { requestJson } = require('./http');

async function getPullRequest(parsed, token) {
  const apiUrl = `${parsed.url}/rest/api/1.0/projects/${parsed.project}/repos/${parsed.repo}/pull-requests/${parsed.pullRequestId}`;
  return requestJson(apiUrl, token);
}

async function createPullRequest(parsed, token, payload) {
  const apiUrl = `${parsed.url}/rest/api/1.0/projects/${parsed.project}/repos/${parsed.repo}/pull-requests`;
  return requestJson(apiUrl, token, 'POST', payload);
}

module.exports = {
  getPullRequest,
  createPullRequest
};
