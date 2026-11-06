'use strict';

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { NativeEngine } = require('./engines/native');
const { SystemEngine } = require('./engines/system');
const { Logger } = require('./logger');
const { archiveDirectory, countFiles, getDirectorySize, formatBytes, validateUrl } = require('./utils');

class WebsiteCloner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      engine: 'auto', // 'auto', 'native', 'system'
      output: null,
      maxDepth: 3,
      concurrency: 5,
      delay: 0,
      timeout: 15000,
      zip: false,
      archiveFormat: 'zip', // 'zip' or 'tar'
      verbose: false,
      json: false,
      skipTest: false,
      force: false,
      userAgent: null,
      proxy: null,
      exclude: null,
      ...options
    };

    this.logger = new Logger({
      level: this.options.verbose ? 'debug' : 'info',
      json: this.options.json
    });

    this.currentEngine = null;
  }

  async testUrl(url) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        headers: this.options.userAgent ? { 'User-Agent': this.options.userAgent } : {}
      });
      return { success: true, status: res.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resolveOutputDir(url) {
    if (this.options.output) {
      return path.resolve(process.cwd(), this.options.output);
    }
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.resolve(process.cwd(), domain);
  }

  async clone(targetUrl) {
    if (!validateUrl(targetUrl)) {
      throw new Error(`Invalid URL format: "${targetUrl}". Expected http:// or https:// URL.`);
    }

    this.emit('start', { url: targetUrl });
    this.logger.info(`Initiating clone for ${targetUrl}`);

    if (!this.options.skipTest) {
      this.logger.debug('Validating target connectivity...');
      const testResult = await this.testUrl(targetUrl);
      if (!testResult.success && !this.options.force) {
        throw new Error(`Target URL unreachable: ${testResult.error}. Use force: true to bypass.`);
      }
    }

    const outputDir = this.resolveOutputDir(targetUrl);

    // Resolve engine
    let selectedEngine = this.options.engine;
    if (selectedEngine === 'auto') {
      const systemAvail = await SystemEngine.isAvailable();
      selectedEngine = systemAvail ? 'system' : 'native';
    }

    this.logger.info(`Using engine: ${selectedEngine}`);

    if (selectedEngine === 'system') {
      const isAvailable = await SystemEngine.isAvailable();
      if (!isAvailable) {
        this.logger.info('System wget not found, preparing binary...');
        await SystemEngine.ensureBinary();
      }
      this.currentEngine = new SystemEngine(this.options);
    } else {
      this.currentEngine = new NativeEngine(this.options);
    }

    const engineResult = await this.currentEngine.run(targetUrl, outputDir, (progress) => {
      this.emit('progress', progress);
    });

    const fileCount = countFiles(outputDir);
    const dirSize = getDirectorySize(outputDir);

    const result = {
      url: targetUrl,
      outputDir,
      engine: selectedEngine,
      totalFiles: fileCount,
      totalSizeBytes: dirSize,
      formattedSize: formatBytes(dirSize),
      archive: null
    };

    if (this.options.zip) {
      this.logger.info(`Archiving outputs to ${this.options.archiveFormat}...`);
      const archiveResult = await archiveDirectory(outputDir, this.options.archiveFormat);
      result.archive = {
        path: archiveResult.path,
        sizeBytes: archiveResult.size,
        formattedSize: formatBytes(archiveResult.size)
      };
      this.emit('archived', result.archive);
    }

    this.emit('complete', result);
    return result;
  }
}

module.exports = { WebsiteCloner, SystemEngine, NativeEngine, Logger, utils: require('./utils') };

