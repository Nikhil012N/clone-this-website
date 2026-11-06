#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { WebsiteCloner } = require('../lib/cloner');
const { validateUrl } = require('../lib/utils');
const { loadConfigFile, mergeConfig } = require('../lib/config');
const packageJson = require('../package.json');

function printBanner() {
  console.log(`--------------------------------------------------`);
  console.log(` clone-this-website v${packageJson.version}`);
  console.log(` Enterprise Website Mirror & RAG Crawler`);
  console.log(`--------------------------------------------------\n`);
}

function parseCliArgs(args) {
  const result = {
    _: [],
    options: {}
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.options.version = true;
    } else if (arg === '--verbose') {
      result.options.verbose = true;
    } else if (arg === '--json') {
      result.options.json = true;
    } else if (arg === '--markdown' || arg === '--ai') {
      result.options.extractMarkdown = true;
    } else if (arg === '--zip' || arg === '-z') {
      result.options.zip = true;
    } else if (arg === '--force' || arg === '-f') {
      result.options.force = true;
    } else if (arg === '--skip-test' || arg === '-s') {
      result.options.skipTest = true;
    } else if (arg === '--interactive' || arg === '-i') {
      result.options.interactive = true;
    } else if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
      result.options.output = arg.split('=')[1];
    } else if (arg === '-o' || arg === '--output') {
      result.options.output = args[++i];
    } else if (arg.startsWith('--engine=')) {
      result.options.engine = arg.split('=')[1];
    } else if (arg === '--engine') {
      result.options.engine = args[++i];
    } else if (arg.startsWith('--max-depth=') || arg.startsWith('-m=')) {
      result.options.maxDepth = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-m' || arg === '--max-depth') {
      result.options.maxDepth = parseInt(args[++i], 10);
    } else if (arg.startsWith('--concurrency=') || arg.startsWith('-c=')) {
      result.options.concurrency = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-c' || arg === '--concurrency') {
      result.options.concurrency = parseInt(args[++i], 10);
    } else if (arg.startsWith('--delay=') || arg.startsWith('-d=')) {
      result.options.delay = parseFloat(arg.split('=')[1]);
    } else if (arg === '-d' || arg === '--delay') {
      result.options.delay = parseFloat(args[++i]);
    } else if (arg.startsWith('--exclude=') || arg.startsWith('-e=')) {
      result.options.exclude = arg.split('=')[1];
    } else if (arg === '-e' || arg === '--exclude') {
      result.options.exclude = args[++i];
    } else if (arg.startsWith('--proxy=')) {
      result.options.proxy = arg.split('=')[1];
    } else if (arg === '--proxy') {
      result.options.proxy = args[++i];
    } else if (arg.startsWith('--user-agent=') || arg.startsWith('-u=')) {
      result.options.userAgent = arg.split('=')[1];
    } else if (arg === '-u' || arg === '--user-agent') {
      result.options.userAgent = args[++i];
    } else if (arg.startsWith('--config=')) {
      result.options.config = arg.split('=')[1];
    } else if (arg === '--config') {
      result.options.config = args[++i];
    } else if (!arg.startsWith('-')) {
      result._.push(arg);
    }
  }

  return result;
}

function printHelp() {
  console.log(`Usage: clone-this-website [options] [url]

Enterprise cross-platform website mirroring engine and AI crawler

Arguments:
  url                         Website URL to mirror

Options:
  -V, --version               output the version number
  -o, --output <dir>          Custom output directory path
  --config <path>             Path to custom configuration file (.clonerc.json)
  --engine <engine>           Engine choice: auto, native, system
  -m, --max-depth <depth>     Maximum crawl depth recursion (default: 3)
  -c, --concurrency <number>  Concurrent connections for native crawler (default: 5)
  -d, --delay <seconds>       Throttle delay between requests in seconds
  -z, --zip                   Generate compressed archive upon completion
  --markdown, --ai            Extract clean Markdown for LLM & RAG vector ingestion
  -u, --user-agent <string>   Custom User-Agent header
  --proxy <proxyUrl>          HTTP/HTTPS proxy server (e.g., http://proxy:8080)
  -e, --exclude <extensions>  Comma-separated extensions to exclude (e.g. pdf,mp4)
  -f, --force                 Force clone even if target accessibility test fails
  -s, --skip-test             Skip connectivity check before starting
  -v, --verbose               Enable verbose diagnostic logging
  --json                      Output structured JSON responses for CI/CD runners
  -i, --interactive           Run in interactive prompt mode
  -h, --help                  display help for command
`);
}

function prompt(questionText, defaultVal = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptMessage = defaultVal ? `${questionText} [${defaultVal}]: ` : `${questionText}: `;
  return new Promise((resolve) => {
    rl.question(promptMessage, (answer) => {
      rl.close();
      const val = answer.trim();
      resolve(val || defaultVal);
    });
  });
}

async function interactiveMode() {
  printBanner();

  let targetUrl = '';
  while (!targetUrl) {
    const input = await prompt('Target website URL to mirror (e.g., https://example.com)');
    if (validateUrl(input)) {
      targetUrl = input;
    } else {
      console.log('Invalid URL format. Please provide an http:// or https:// URL.\n');
    }
  }

  const engineChoice = await prompt('Engine selection (auto / native / system)', 'auto');
  const outputDir = await prompt('Output directory name', '');
  const maxDepthStr = await prompt('Max crawl depth recursion', '3');
  const aiChoice = await prompt('Extract clean Markdown for LLM/RAG? (y/N)', 'n');
  const zipChoice = await prompt('Create compressed archive upon completion? (y/N)', 'n');

  const options = {
    engine: ['auto', 'native', 'system'].includes(engineChoice.toLowerCase()) ? engineChoice.toLowerCase() : 'auto',
    output: outputDir || null,
    maxDepth: parseInt(maxDepthStr, 10) || 3,
    extractMarkdown: aiChoice.toLowerCase().startsWith('y'),
    zip: zipChoice.toLowerCase().startsWith('y')
  };

  return runCloner(targetUrl, options);
}

async function runCloner(url, options) {
  if (!options.json) {
    console.log(`Target URL:    ${url}`);
    console.log(`Engine:        ${options.engine || 'auto'}`);
    console.log(`Max Depth:     ${options.maxDepth || 3}`);
    if (options.extractMarkdown) {
      console.log(`AI Ingestion:  Enabled (extracting clean .md for LLMs)`);
    }
    console.log(`--------------------------------------------------`);
  }

  const cloner = new WebsiteCloner(options);

  let lastLineLength = 0;
  cloner.on('progress', (data) => {
    if (!options.json && !options.verbose) {
      const msg = `Fetched ${data.count || 0} resource(s)${data.url ? ` | Current: ${data.url.slice(0, 45)}` : ''}`;
      const padded = msg.padEnd(lastLineLength, ' ');
      lastLineLength = padded.length;
      process.stdout.write(`\r${padded}`);
    }
  });

  try {
    const result = await cloner.clone(url);
    if (!options.json && !options.verbose) {
      process.stdout.write('\r' + ' '.repeat(lastLineLength) + '\r');
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\nMirror completed successfully.`);
    console.log(`Destination:   ${result.outputDir}`);
    console.log(`Total Files:   ${result.totalFiles}`);
    console.log(`Total Size:    ${result.formattedSize}`);
    console.log(`Engine Used:   ${result.engine}`);

    if (result.archive) {
      console.log(`Archive:       ${result.archive.path} (${result.archive.formattedSize})`);
    }
  } catch (err) {
    if (!options.json && !options.verbose) {
      process.stdout.write('\r' + ' '.repeat(lastLineLength) + '\r');
    }

    if (options.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(`\nOperation failed: ${err.message}`);
    }
    process.exit(1);
  }
}

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.options.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.options.version) {
    console.log(packageJson.version);
    process.exit(0);
  }

  const fileConfig = loadConfigFile(parsed.options.config);
  const mergedOpts = mergeConfig({ engine: 'auto', maxDepth: 3, concurrency: 5, delay: 0 }, fileConfig, parsed.options);

  const targetUrl = parsed._[0] || fileConfig.url;

  if (parsed.options.interactive || !targetUrl) {
    await interactiveMode();
    return;
  }

  if (!validateUrl(targetUrl)) {
    console.error(`Invalid URL format: "${targetUrl}". Expected http:// or https:// protocol.`);
    process.exit(1);
  }

  if (!mergedOpts.json) printBanner();
  await runCloner(targetUrl, mergedOpts);
}

main().catch((err) => {
  console.error(`Execution error: ${err.message}`);
  process.exit(1);
});
