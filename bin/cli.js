#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const boxen = require('boxen');
const ora = require('ora');
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');
const { Command } = require('commander');

const { WebsiteCloner } = require('../lib/cloner');
const { validateUrl, formatBytes } = require('../lib/utils');
const { loadConfigFile, mergeConfig } = require('../lib/config');
const packageJson = require('../package.json');

const program = new Command();

const styles = {
  title: chalk.bold.cyan,
  subtitle: chalk.bold.blue,
  success: chalk.bold.green,
  error: chalk.bold.red,
  warning: chalk.bold.yellow,
  info: chalk.bold.magenta,
  url: chalk.underline.blue,
  path: chalk.italic.gray
};

function showHeader() {
  console.clear();
  const titleText = figlet.textSync('Website Cloner', { font: 'Slant' });
  console.log(gradient.pastel.multiline(titleText));

  const message = styles.subtitle('🌐 Enterprise Cross-Platform Website Cloner & Crawler\n') +
                  styles.info('   Dual Engine (Native Node.js & System Wget) | SDK & CLI');

  console.log(boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    align: 'center'
  }));
}

async function interactiveMode() {
  showHeader();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter website URL to clone:',
      validate: (input) => {
        if (!input.trim()) return 'URL is required';
        if (!validateUrl(input.trim())) return 'Please enter a valid URL (e.g., https://example.com)';
        return true;
      }
    },
    {
      type: 'list',
      name: 'engine',
      message: 'Select crawling engine:',
      choices: [
        { name: 'Auto (Detect best available engine)', value: 'auto' },
        { name: 'Native (Pure Node.js - Zero external dependencies)', value: 'native' },
        { name: 'System (Wget binary - Maximum raw throughput)', value: 'system' }
      ],
      default: 'auto'
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output directory name (optional):',
      default: ''
    },
    {
      type: 'input',
      name: 'maxDepth',
      message: 'Max crawling recursion depth:',
      default: '3',
      validate: (input) => !isNaN(parseInt(input, 10)) || 'Must be a number'
    },
    {
      type: 'confirm',
      name: 'zip',
      message: 'Archive output into a zip file when done?',
      default: false
    },
    {
      type: 'input',
      name: 'delay',
      message: 'Rate limit delay between requests in seconds (optional, e.g. 1):',
      default: '0'
    },
    {
      type: 'input',
      name: 'exclude',
      message: 'File extensions to exclude (comma separated, e.g. pdf,mp4):',
      default: ''
    }
  ]);

  return runCloner(answers.url, {
    ...answers,
    maxDepth: parseInt(answers.maxDepth, 10) || 3,
    delay: parseFloat(answers.delay) || 0
  });
}

async function runCloner(url, options) {
  if (!options.json) {
    console.log(styles.info(`\n🌐 Target: ${styles.url(url)}`));
    console.log(styles.info(`⚙️  Engine: ${options.engine || 'auto'}`));
  }

  let progressBar = null;
  if (!options.verbose && !options.json) {
    progressBar = new cliProgress.SingleBar({
      format: gradient.cristal('Cloning') + ' |' + chalk.cyan('{bar}') + '| {value} files fetched',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    progressBar.start(100, 0);
  }

  const cloner = new WebsiteCloner(options);

  cloner.on('progress', (data) => {
    if (progressBar) {
      progressBar.update(data.count || 0);
    }
  });

  try {
    const result = await cloner.clone(url);
    if (progressBar) progressBar.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log('\n' + styles.success('✅ Website cloned successfully!'));
    console.log(styles.info(`📂 Output Directory: ${styles.path(result.outputDir)}`));
    console.log(styles.info(`📊 Total Files Downloaded: ${result.totalFiles}`));
    console.log(styles.info(`📏 Total Size: ${result.formattedSize}`));
    console.log(styles.info(`⚡ Engine Used: ${result.engine}`));

    if (result.archive) {
      console.log(styles.success(`📦 Archive Created: ${styles.path(result.archive.path)} (${result.archive.formattedSize})`));
    }
  } catch (err) {
    if (progressBar) progressBar.stop();
    if (options.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(styles.error(`\n❌ Clone failed: ${err.message}`));
    }
    process.exit(1);
  }
}

program
  .name('clone-this-website')
  .description('Enterprise cross-platform website cloner with Dual Engine (Native Node.js & Wget)')
  .version(packageJson.version);

program
  .argument('[url]', 'Website URL to clone')
  .option('-o, --output <dir>', 'Custom output directory path')
  .option('--config <path>', 'Path to custom configuration file (.clonerc.json, cloner.config.js)')
  .option('--engine <engine>', 'Engine to use: "auto", "native", or "system"')
  .option('-m, --max-depth <depth>', 'Maximum crawl depth recursion', (v) => parseInt(v, 10))
  .option('-c, --concurrency <number>', 'Concurrent connection limit for native crawler', (v) => parseInt(v, 10))
  .option('-d, --delay <seconds>', 'Delay between requests in seconds', (v) => parseFloat(v))
  .option('-z, --zip', 'Create a zip archive of the output')
  .option('--tar', 'Create a tar.gz archive of the output')
  .option('-u, --user-agent <string>', 'Custom User-Agent header')
  .option('--proxy <proxyUrl>', 'HTTP/HTTPS proxy server (e.g., http://proxy:8080)')
  .option('-e, --exclude <extensions>', 'Comma-separated file extensions to exclude (e.g. pdf,mp4)')
  .option('-f, --force', 'Force clone even if target accessibility test fails')
  .option('-s, --skip-test', 'Skip connectivity check before starting')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--json', 'Output structured JSON responses (CI/CD friendly)')
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
        console.error(styles.error(`❌ Invalid URL format "${targetUrl}". Must start with http:// or https://`));
        process.exit(1);
      }

      if (mergedOpts.tar) {
        mergedOpts.zip = true;
        mergedOpts.archiveFormat = 'tar';
      }

      if (!mergedOpts.json) showHeader();
      await runCloner(targetUrl, mergedOpts);
    } catch (err) {
      console.error(styles.error(`❌ Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();

