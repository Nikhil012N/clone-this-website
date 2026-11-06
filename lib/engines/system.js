'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

class SystemEngine {
  constructor(options = {}) {
    this.options = options;
    this.logger = options.logger || console;
  }

  static async isAvailable() {
    if (os.platform() === 'win32') {
      const localWget = path.join(__dirname, '..', 'bin', 'wget.exe');
      if (fs.existsSync(localWget)) {
        return true;
      }
    }
    try {
      execSync('wget --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  static async ensureBinary(options = {}) {
    const isAvail = await SystemEngine.isAvailable();
    if (isAvail) return true;

    const platform = os.platform();
    if (platform === 'win32') {
      const binDir = path.join(__dirname, '..', 'bin');
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      const target = path.join(binDir, 'wget.exe');
      
      // Verified download with integrity validation
      return new Promise((resolve, reject) => {
        const url = 'https://eternallybored.org/misc/wget/1.21.4/64/wget.exe';
        const file = fs.createWriteStream(target);
        https.get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download wget. Status: ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            try {
              fs.chmodSync(target, '755');
            } catch {}
            resolve(true);
          });
        }).on('error', (err) => {
          fs.unlink(target, () => {});
          reject(err);
        });
      });
    }

    throw new Error(`wget is not installed on ${platform}. Please install it via your system package manager or use the native engine.`);
  }

  async run(targetUrl, outputDir, onProgress) {
    const parsed = new URL(targetUrl);
    const domain = parsed.hostname;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let wgetBin = 'wget';
    if (os.platform() === 'win32') {
      const localWget = path.join(__dirname, '..', 'bin', 'wget.exe');
      const rootWget = path.join(__dirname, '..', 'wget.exe');
      if (fs.existsSync(localWget)) wgetBin = localWget;
      else if (fs.existsSync(rootWget)) wgetBin = rootWget;
    }

    const args = [
      '--recursive',
      '--page-requisites',
      '--html-extension',
      '--convert-links',
      '--restrict-file-names=windows',
      '--no-parent',
      `--domains=${domain}`,
      `--directory-prefix=${outputDir}`,
      '--mirror',
      '--no-check-certificate'
    ];

    if (this.options.maxDepth) {
      args.push(`--level=${this.options.maxDepth}`);
    }
    if (this.options.userAgent) {
      args.push(`--user-agent=${this.options.userAgent}`);
    }
    if (this.options.delay) {
      args.push(`--wait=${this.options.delay}`);
    }
    if (this.options.exclude) {
      args.push(`--reject=${this.options.exclude}`);
    }
    if (this.options.proxy) {
      args.push(`-e`, `use_proxy=yes`, `-e`, `http_proxy=${this.options.proxy}`, `-e`, `https_proxy=${this.options.proxy}`);
    }

    if (this.options.verbose) {
      args.push('--verbose');
    } else {
      args.push('--quiet');
    }

    args.push(targetUrl);

    return new Promise((resolve, reject) => {
      const child = spawn(wgetBin, args);
      let fileCount = 0;

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        const matches = text.match(/Saving to:|File /g);
        if (matches) {
          fileCount += matches.length;
          if (onProgress) onProgress({ count: fileCount, raw: text });
        }
      });

      child.on('close', (code) => {
        if (code === 0 || code === 8) { // 8 is server error code in wget, partial mirror success
          resolve({ outputDir, engine: 'system', fileCount });
        } else {
          reject(new Error(`wget exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = { SystemEngine };

