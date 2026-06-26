#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');
const { Command } = require('commander');
const axios = require('axios');
const figlet = require('figlet');
const gradient = require('gradient-string');
const boxen = require('boxen');
const archiver = require('archiver');
const program = new Command();

// Professional CLI styling
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

// Display beautiful header
function showHeader() {
  console.clear();
  const titleText = figlet.textSync('Website Cloner', { font: 'Slant' });
  console.log(gradient.pastel.multiline(titleText));
  
  const message = styles.subtitle('🌐 Clone any website with ease and precision\n') +
                  styles.info('   Professional Cross-Platform Tool');
  
  console.log(boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    align: 'center'
  }));
}

// Validate URL format
function validateURL(url) {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Check if wget is installed
async function checkWgetInstallation() {
  const spinner = ora('Checking system dependencies...').start();
  
  if (os.platform() === 'win32') {
    const wgetPath = path.join(__dirname, 'wget.exe');
    if (fs.existsSync(wgetPath)) {
      process.env.PATH = `${__dirname}${path.delimiter}${process.env.PATH}`;
      spinner.succeed('wget is already installed (local)');
      return true;
    }
  }
  
  try {
    execSync('wget --version', { stdio: 'ignore' });
    spinner.succeed('wget is already installed');
    return true;
  } catch (e) {
    spinner.warn('wget not found, installing...');
    return false;
  }
}

// Install wget based on platform
async function installWget() {
  const platform = os.platform();
  const spinner = ora('Installing wget...').start();
  
  try {
    if (platform === 'linux') {
      await installWgetLinux();
    } else if (platform === 'darwin') {
      await installWgetMacOS();
    } else if (platform === 'win32') {
      await installWgetWindows();
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    spinner.succeed('wget installed successfully');
    return true;
  } catch (error) {
    spinner.fail(`Failed to install wget: ${error.message}`);
    throw error;
  }
}

async function installWgetLinux() {
  const distros = [
    { cmd: 'apt-get', install: 'sudo apt-get update && sudo apt-get install -y wget' },
    { cmd: 'yum', install: 'sudo yum install -y wget' },
    { cmd: 'pacman', install: 'sudo pacman -S --noconfirm wget' },
    { cmd: 'dnf', install: 'sudo dnf install -y wget' },
    { cmd: 'zypper', install: 'sudo zypper install -y wget' }
  ];
  
  for (const distro of distros) {
    try {
      execSync(`command -v ${distro.cmd}`, { stdio: 'ignore' });
      execSync(distro.install, { stdio: 'inherit' });
      return;
    } catch (e) {
      continue;
    }
  }
  
  throw new Error('Could not determine Linux distribution. Please install wget manually.');
}

async function installWgetMacOS() {
  try {
    execSync('brew --version', { stdio: 'ignore' });
    execSync('brew install wget', { stdio: 'inherit' });
  } catch (e) {
    throw new Error('Homebrew not found. Please install Homebrew first: https://brew.sh');
  }
}

async function installWgetWindows() {
  const wgetPath = path.join(__dirname, 'wget.exe');
  
  if (fs.existsSync(wgetPath)) {
    process.env.PATH = `${__dirname}${path.delimiter}${process.env.PATH}`;
    return;
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(wgetPath);
    
    https.get('https://eternallybored.org/misc/wget/1.21.4/64/wget.exe', (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download wget: HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        fs.chmodSync(wgetPath, '755');
        process.env.PATH = `${__dirname}${path.delimiter}${process.env.PATH}`;
        resolve();
      });
    }).on('error', reject);
  });
}

// Test website accessibility
async function testWebsite(url) {
  const spinner = ora('Testing website accessibility...').start();
  
  try {
    const response = await axios.get(url, { 
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    });
    
    spinner.succeed(`Website is accessible (Status: ${response.status})`);
    return true;
  } catch (error) {
    spinner.warn(`Website test failed: ${error.message}`);
    return false;
  }
}

// Extract domain and create output directory
function prepareOutput(url, customOutput) {
  let domain = url.replace(/^https?:\/\//, '');
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  
  const outputDir = customOutput || domain;
  
  if (fs.existsSync(outputDir)) {
    console.log(styles.warning(`⚠️  Directory '${outputDir}' already exists`));
  }
  
  return { domain, outputDir };
}

// Clone website with progress tracking
async function cloneWebsite(url, options) {
  const { domain, outputDir } = prepareOutput(url, options.output);
  
  console.log(styles.info(`🌐 Target Domain: ${styles.url(domain)}`));
  console.log(styles.info(`📁 Output Directory: ${styles.path(outputDir)}`));
  
  if (!options.skipTest) {
    const isAccessible = await testWebsite(url);
    if (!isAccessible && !options.force) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Website test failed. Continue anyway?',
          default: false
        }
      ]);
      
      if (!answer.continue) {
        console.log(styles.error('❌ Operation cancelled by user'));
        process.exit(0);
      }
    }
  }
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(styles.subtitle('\n🚀 Starting website clone...\n'));
  
  const progressBar = new cliProgress.SingleBar({
    format: gradient.cristal('Cloning') + ' |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  return new Promise((resolve, reject) => {
    const wgetArgs = [
      '--recursive',
      '--page-requisites',
      '--html-extension',
      '--convert-links',
      '--restrict-file-names=windows',
      '--no-parent',
      '--domains=' + domain,
      '--directory-prefix=' + outputDir,
      '--mirror',
      '--no-check-certificate',
      url
    ];
    
    if (options.userAgent) {
      wgetArgs.push(`--user-agent=${options.userAgent}`);
    }
    if (options.delay) {
      wgetArgs.push(`--wait=${options.delay}`);
    }
    if (options.exclude) {
      wgetArgs.push(`--reject=${options.exclude}`);
    }
    
    if (options.verbose) {
      wgetArgs.push('--verbose');
    } else {
      wgetArgs.push('--quiet');
    }
    
    let wgetCmd = 'wget';
    if (os.platform() === 'win32') {
      const localWget = path.join(__dirname, 'wget.exe');
      if (fs.existsSync(localWget)) {
        wgetCmd = localWget;
      }
    }
    
    const wget = spawn(wgetCmd, wgetArgs);
    let fileCount = 0;
    
    wget.stderr.on('data', (data) => {
      const output = data.toString();
      if (options.verbose) {
        console.log(output.trim());
      }
      
      // Simple file counting (this is approximate)
      const matches = output.match(/Saving to:|File /g);
      if (matches) {
        fileCount += matches.length;
        progressBar.update(fileCount);
      }
    });
    
    wget.on('close', async (code) => {
      progressBar.stop();
      
      if (code === 0) {
        console.log('\n' + styles.success('✅ Website cloned successfully!'));
        console.log(styles.info(`📂 Files saved in: ${styles.path(outputDir)}`));
        
        // Show directory info
        try {
          const files = countFiles(outputDir);
          console.log(styles.info(`📊 Total files downloaded: ${files}`));
          console.log(styles.info(`📏 Directory size: ${formatBytes(getDirectorySize(outputDir))}`));
        } catch (e) {
          // Ignore stats errors
        }
        
        if (options.zip) {
          try {
            await zipDirectory(outputDir);
          } catch (err) {
            console.log(styles.error(`\n❌ Failed to create zip: ${err.message}`));
          }
        }
        
        resolve(outputDir);
      } else {
        console.log('\n' + styles.error(`❌ Error cloning website (exit code: ${code})`));
        reject(new Error(`wget exited with code ${code}`));
      }
    });
    
    wget.on('error', (error) => {
      progressBar.stop();
      reject(error);
    });
    
    // Start progress bar
    progressBar.start(100, 0);
  });
}

// Utility functions
function countFiles(dir) {
  let count = 0;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        count += countFiles(fullPath);
      } else {
        count++;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return count;
}

function getDirectorySize(dir) {
  let size = 0;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else {
        size += stat.size;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Zip functionality
function zipDirectory(dir) {
  return new Promise((resolve, reject) => {
    const spinner = ora('Creating zip archive...').start();
    const outPath = `${dir}.zip`;
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      spinner.succeed(`Archive created successfully: ${styles.path(outPath)} (${formatBytes(archive.pointer())})`);
      resolve(outPath);
    });
    
    archive.on('error', (err) => {
      spinner.fail(`Failed to create archive: ${err.message}`);
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(dir, false);
    archive.finalize();
  });
}

// Interactive mode
async function interactiveMode() {
  showHeader();
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter website URL to clone:',
      validate: (input) => {
        if (!input.trim()) return 'URL is required';
        if (!validateURL(input.trim())) return 'Please enter a valid URL (e.g., https://example.com)';
        return true;
      }
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output directory name (optional):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'skipTest',
      message: 'Skip website accessibility test?',
      default: false
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Enable verbose output?',
      default: false
    },
    {
      type: 'confirm',
      name: 'zip',
      message: 'Create a zip archive after cloning?',
      default: false
    },
    {
      type: 'input',
      name: 'delay',
      message: 'Delay between requests in seconds (optional, e.g. 1):',
      default: ''
    },
    {
      type: 'input',
      name: 'exclude',
      message: 'File extensions to exclude (optional, e.g. pdf,mp4):',
      default: ''
    }
  ]);
  
  try {
    const wgetInstalled = await checkWgetInstallation();
    if (!wgetInstalled) {
      await installWget();
    }
    
    await cloneWebsite(answers.url, answers);
  } catch (error) {
    console.log(styles.error(`\n❌ Failed to clone website: ${error.message}`));
    process.exit(1);
  }
}

// CLI program setup
program
  .name('clone-this-website')
  .description('Professional cross-platform website cloner with beautiful CLI interface')
  .version('1.0.0');

program
  .argument('[url]', 'Website URL to clone')
  .option('-o, --output <directory>', 'Custom output directory name')
  .option('-f, --force', 'Force cloning even if website test fails')
  .option('-s, --skip-test', 'Skip website accessibility test')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-i, --interactive', 'Start in interactive mode')
  .option('-z, --zip', 'Create a zip archive of the downloaded website')
  .option('-u, --user-agent <string>', 'Set a custom User-Agent string')
  .option('-d, --delay <seconds>', 'Delay between requests in seconds')
  .option('-e, --exclude <extensions>', 'Comma-separated list of extensions to exclude (e.g., pdf,mp4)')
  .action(async (url, options) => {
    try {
      if (options.interactive || !url) {
        await interactiveMode();
        return;
      }
      
      if (!validateURL(url)) {
        console.log(styles.error('❌ Invalid URL format. Please use: https://example.com'));
        process.exit(1);
      }
      
      showHeader();
      
      const wgetInstalled = await checkWgetInstallation();
      if (!wgetInstalled) {
        await installWget();
      }
      
      await cloneWebsite(url, options);
      
    } catch (error) {
      console.log(styles.error(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.log(styles.error(`\n❌ Unexpected error: ${error.message}`));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(styles.error(`\n❌ Unhandled promise rejection: ${reason}`));
  process.exit(1);
});

// Parse command line arguments
program.parse();
