const readline = require('readline');

function promptInput(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseArgs(argv) {
  const args = [];
  let bbtokenRequested = false;
  let bbtokenValue = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--bbtoken') {
      bbtokenRequested = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        bbtokenValue = next;
        i += 1;
      }
      continue;
    }

    args.push(arg);
  }

  return {
    args,
    bbtokenRequested,
    bbtokenValue
  };
}

module.exports = {
  parseArgs,
  promptInput
};
