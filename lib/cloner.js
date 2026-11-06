'use strict';

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { NativeEngine } = require('./engines/native');
const { SystemEngine } = require('./engines/system');
const { Logger } = require('./logger');
const { RetryHandler } = require('./retry');
const { SecurityManager } = require('./security');
const { archiveDirectory, countFiles, getDirectorySize, formatBytes, validateUrl } = require('./utils');

class WebsiteCloner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      engine: 'auto',
      output: null,
      maxDepth: 3,
      concurrency: 5,
      delay: 0,
      timeout: 15000,
      zip: false,
      archiveFormat: 'tar',
      verbose: false,
      json: false,
      skipTest: false,
      force: false,
      userAgent: null,
      proxy: null,
      exclude: null,
      extractMarkdown: false,
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: this.options.userAgent ? { 'User-Agent': this.options.userAgent } : {}
      });
      clearTimeout(timer);
      return { success: res.ok, status: res.status };
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
    this.logger.info(`Initiating mirror for ${targetUrl}`);

    if (!this.options.skipTest) {
      this.logger.debug('Validating target connectivity...');
      const testResult = await this.testUrl(targetUrl);
      if (!testResult.success && !this.options.force) {
        throw new Error(`Target URL unreachable: ${testResult.error || 'Connection failed'}. Use force: true to bypass.`);
      }
    }

    const outputDir = this.resolveOutputDir(targetUrl);

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

    await this.currentEngine.run(targetUrl, outputDir, (progress) => {
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
      this.logger.info('Archiving output bundle...');
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

module.exports = {
  WebsiteCloner,
  SystemEngine,
  NativeEngine,
  Logger,
  RetryHandler,
  SecurityManager,
  utils: require('./utils')
};
