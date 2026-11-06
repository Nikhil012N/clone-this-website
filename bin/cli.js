#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { Command } = require('commander');

const { WebsiteCloner } = require('../lib/cloner');
const { validateUrl, formatBytes } = require('../lib/utils');
const { loadConfigFile, mergeConfig } = require('../lib/config');
const packageJson = require('../package.json');

const program = new Command();

const styles = {
  header: chalk.cyan.bold,
  dim: chalk.gray,
  success: chalk.green.bold,
  error: chalk.red.bold,
  info: chalk.blue,
  label: chalk.white.bold,
  value: chalk.yellow
};

function printBanner() {
  console.log(styles.header(`--------------------------------------------------`));
  console.log(styles.header(` clone-this-website v${packageJson.version}`));
  console.log(styles.dim(` Enterprise Website Mirroring & Crawler Tool`));
  console.log(styles.header(`--------------------------------------------------\n`));
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
      console.log(styles.error('Invalid URL format. Please provide an http:// or https:// URL.\n'));
    }
  }

  const engineChoice = await prompt('Engine selection (auto / native / system)', 'auto');
  const outputDir = await prompt('Output directory name', '');
  const maxDepthStr = await prompt('Max crawl depth recursion', '3');
  const zipChoice = await prompt('Create zip archive upon completion? (y/N)', 'n');
  const delayStr = await prompt('Request delay throttle in seconds', '0');

  const options = {
    engine: ['auto', 'native', 'system'].includes(engineChoice.toLowerCase()) ? engineChoice.toLowerCase() : 'auto',
    output: outputDir || null,
    maxDepth: parseInt(maxDepthStr, 10) || 3,
    zip: zipChoice.toLowerCase().startsWith('y'),
    delay: parseFloat(delayStr) || 0
  };

  return runCloner(targetUrl, options);
}

async function runCloner(url, options) {
  if (!options.json) {
    console.log(`${styles.label('Target URL:')}    ${styles.value(url)}`);
    console.log(`${styles.label('Engine:')}        ${styles.value(options.engine || 'auto')}`);
    console.log(`${styles.label('Max Depth:')}     ${styles.value(options.maxDepth || 3)}`);
    console.log(`${styles.dim('--------------------------------------------------')}`);
  }

  const cloner = new WebsiteCloner(options);

  let lastLineLength = 0;
  cloner.on('progress', (data) => {
    if (!options.json && !options.verbose) {
      const msg = `Fetched ${data.count || 0} resource(s)${data.url ? ` | Current: ${data.url.slice(0, 45)}` : ''}`;
      const padded = msg.padEnd(lastLineLength, ' ');
      lastLineLength = padded.length;
      process.stdout.write(`\r${styles.info(padded)}`);
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

    console.log(`\n${styles.success('Mirror completed successfully.')}`);
    console.log(`${styles.label('Destination:')}   ${result.outputDir}`);
    console.log(`${styles.label('Total Files:')}   ${result.totalFiles}`);
    console.log(`${styles.label('Total Size:')}    ${result.formattedSize}`);
    console.log(`${styles.label('Engine Used:')}   ${result.engine}`);

    if (result.archive) {
      console.log(`${styles.label('Archive:')}       ${result.archive.path} (${result.archive.formattedSize})`);
    }
  } catch (err) {
    if (!options.json && !options.verbose) {
      process.stdout.write('\r' + ' '.repeat(lastLineLength) + '\r');
    }

    if (options.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(`\n${styles.error('Operation failed:')} ${err.message}`);
    }
    process.exit(1);
  }
}

program
  .name('clone-this-website')
  .description('Enterprise cross-platform website mirroring engine with Dual Engine execution')
  .version(packageJson.version);

program
  .argument('[url]', 'Website URL to mirror')
  .option('-o, --output <dir>', 'Custom output directory path')
  .option('--config <path>', 'Path to custom configuration file (.clonerc.json, cloner.config.js)')
  .option('--engine <engine>', 'Engine choice: auto, native, system')
  .option('-m, --max-depth <depth>', 'Maximum crawl depth recursion', (v) => parseInt(v, 10))
  .option('-c, --concurrency <number>', 'Concurrent connection limit for native crawler', (v) => parseInt(v, 10))
  .option('-d, --delay <seconds>', 'Throttle delay between requests in seconds', (v) => parseFloat(v))
  .option('-z, --zip', 'Generate .zip archive upon completion')
  .option('--tar', 'Generate .tar.gz archive upon completion')
  .option('-u, --user-agent <string>', 'Custom User-Agent header')
  .option('--proxy <proxyUrl>', 'HTTP/HTTPS proxy server (e.g., http://proxy:8080)')
  .option('-e, --exclude <extensions>', 'Comma-separated file extensions to exclude (e.g. pdf,mp4)')
  .option('-f, --force', 'Force clone even if target accessibility test fails')
  .option('-s, --skip-test', 'Skip connectivity check before starting')
  .option('-v, --verbose', 'Enable verbose diagnostic logging')
  .option('--json', 'Output structured JSON responses for CI/CD runners')
  .option('-i, --interactive', 'Run in interactive CLI mode')
  .action(async (url, opts) => {
    try {
      const fileConfig = loadConfigFile(opts.config);
      const mergedOpts = mergeConfig({ engine: 'auto', maxDepth: 3, concurrency: 5, delay: 0 }, fileConfig, opts);

      const targetUrl = url || fileConfig.url;

      if (opts.interactive || !targetUrl) {
        await interactiveMode();
        return;
      }

      if (!validateUrl(targetUrl)) {
        console.error(styles.error(`Invalid URL format: "${targetUrl}". Expected http:// or https:// protocol.`));
        process.exit(1);
      }

      if (mergedOpts.tar) {
        mergedOpts.zip = true;
        mergedOpts.archiveFormat = 'tar';
      }

      if (!mergedOpts.json) printBanner();
      await runCloner(targetUrl, mergedOpts);
    } catch (err) {
      console.error(styles.error(`Execution error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
