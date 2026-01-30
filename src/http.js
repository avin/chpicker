const http = require('http');
const https = require('https');
const tls = require('tls');
const { getProxyUrl } = require('./config');

function getProxyAuthHeader(proxyUrl) {
  if (!proxyUrl.username) {
    return null;
  }

  const credentials = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

function sendResponse(res, resolve, reject) {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      return;
    }

    try {
      resolve(data ? JSON.parse(data) : {});
    } catch (error) {
      reject(error);
    }
  });
}

function requestDirect(requestUrl, headers, method, payload, resolve, reject) {
  const client = requestUrl.protocol === 'http:' ? http : https;
  const req = client.request({
    method,
    hostname: requestUrl.hostname,
    port: requestUrl.port,
    path: requestUrl.pathname + requestUrl.search,
    headers
  }, (res) => sendResponse(res, resolve, reject));

  req.on('error', reject);

  if (payload) {
    req.write(payload);
  }

  req.end();
}

function requestViaHttpProxy(requestUrl, proxyUrl, headers, method, payload, resolve, reject) {
  const proxyAuth = getProxyAuthHeader(proxyUrl);
  if (proxyAuth) {
    headers['Proxy-Authorization'] = proxyAuth;
  }

  const client = proxyUrl.protocol === 'https:' ? https : http;
  const req = client.request({
    method,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || 8080,
    path: requestUrl.href,
    headers: {
      ...headers,
      Host: requestUrl.host
    }
  }, (res) => sendResponse(res, resolve, reject));

  req.on('error', reject);

  if (payload) {
    req.write(payload);
  }

  req.end();
}

function requestViaHttpsProxy(requestUrl, proxyUrl, headers, method, payload, resolve, reject) {
  const proxyAuth = getProxyAuthHeader(proxyUrl);
  const connectHeaders = {};
  if (proxyAuth) {
    connectHeaders['Proxy-Authorization'] = proxyAuth;
  }

  const connector = (proxyUrl.protocol === 'https:' ? https : http).request({
    method: 'CONNECT',
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || 8080,
    path: `${requestUrl.hostname}:${requestUrl.port || 443}`,
    headers: connectHeaders
  });

  connector.on('connect', (res, socket) => {
    if (res.statusCode !== 200) {
      socket.destroy();
      reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      return;
    }

    const tlsSocket = tls.connect({
      socket,
      servername: requestUrl.hostname
    });

    const req = https.request({
      method,
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: requestUrl.pathname + requestUrl.search,
      headers,
      createConnection: () => tlsSocket
    }, (response) => sendResponse(response, resolve, reject));

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });

  connector.on('error', reject);
  connector.end();
}

function requestJson(url, token, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const proxyUrl = getProxyUrl();
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (!proxyUrl) {
      requestDirect(requestUrl, headers, method, payload, resolve, reject);
      return;
    }

    if (requestUrl.protocol === 'http:') {
      requestViaHttpProxy(requestUrl, proxyUrl, headers, method, payload, resolve, reject);
      return;
    }

    requestViaHttpsProxy(requestUrl, proxyUrl, headers, method, payload, resolve, reject);
  });
}

module.exports = {
  requestJson
};
