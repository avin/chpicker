#!/usr/bin/env node

const { parseArgs } = require('./src/cli');
const { handleCherryPick, handlePullRequestMerge, handleTokenSave } = require('./src/flows');
const { fatalError } = require('./src/logger');
const { parsePullRequestUrl } = require('./src/parsers');

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));

  if (parsedArgs.bbtokenRequested) {
    await handleTokenSave(parsedArgs.bbtokenValue);
    return;
  }

  const commitUrl = parsedArgs.args[0];
  if (!commitUrl) {
    fatalError('Не передана ссылка');
  }

  if (parsePullRequestUrl(commitUrl)) {
    await handlePullRequestMerge(commitUrl);
    return;
  }

  const releaseVersion = parsedArgs.args[1] || '';
  await handleCherryPick(commitUrl, releaseVersion);
}

main().catch((error) => {
  fatalError(error?.message || 'Неизвестная ошибка');
});
