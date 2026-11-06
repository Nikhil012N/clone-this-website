'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { sanitizePath } = require('../utils');

class NativeEngine {
  constructor(options = {}) {
    this.options = {
      maxDepth: 3,
      concurrency: 5,
      delay: 0,
      timeout: 15000,
      userAgent: 'Mozilla/5.0 (compatible; EnterpriseWebsiteCloner/2.0; +https://github.com/Nikhil012N/clone-this-website)',
      headers: {},
      excludeExtensions: [],
      allowCrossOriginAssets: true,
      ...options
    };
    
    // Normalize exclude list
    if (typeof this.options.exclude === 'string') {
      this.options.excludeExtensions = this.options.exclude.split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
    }

    this.visitedUrls = new Set();
    this.downloadQueue = [];
    this.activeWorkers = 0;
    this.filesDownloaded = 0;
    this.totalDiscovered = 0;
    this.isAborted = false;
  }

  _createHttpClient() {
    const config = {
      timeout: this.options.timeout,
      headers: {
        'User-Agent': this.options.userAgent,
        ...this.options.headers
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    };

    if (this.options.proxy) {
      try {
        const proxyUrl = new URL(this.options.proxy);
        config.proxy = {
          protocol: proxyUrl.protocol.replace(':', ''),
          host: proxyUrl.hostname,
          port: proxyUrl.port ? parseInt(proxyUrl.port, 10) : (proxyUrl.protocol === 'https:' ? 443 : 80),
          ...(proxyUrl.username ? { auth: { username: proxyUrl.username, password: proxyUrl.password } } : {})
        };
      } catch {
        // Ignore invalid proxy format
      }
    }

    return axios.create(config);
  }

  _isExcluded(urlStr) {
    try {
      const parsed = new URL(urlStr);
      const ext = path.extname(parsed.pathname).slice(1).toLowerCase();
      if (ext && this.options.excludeExtensions.includes(ext)) {
        return true;
      }
    } catch {}
    return false;
  }

  _urlToFilePath(urlObj, baseHost, outputDir) {
    let relPath = urlObj.pathname;
    if (!relPath || relPath === '/' || relPath.endsWith('/')) {
      relPath = path.join(relPath, 'index.html');
    } else if (!path.extname(relPath)) {
      relPath = relPath + '.html';
    }

    // Isolate by domain if cross-origin asset
    if (urlObj.hostname !== baseHost) {
      relPath = path.join('assets', urlObj.hostname, relPath);
    } else {
      relPath = relPath.replace(/^\//, '');
    }

    // Sanitize for Windows/Unix file systems
    const normalizedParts = relPath.split('/').map(seg => seg.replace(/[<>:"|?*]/g, '_'));
    return path.join(outputDir, ...normalizedParts);
  }

  async run(targetUrl, outputDir, onProgress) {
    this.isAborted = false;
    const startUrl = new URL(targetUrl);
    const baseHost = startUrl.hostname;
    const client = this._createHttpClient();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const queue = [{ url: startUrl.href, depth: 0, isHtml: true }];
    this.visitedUrls.add(startUrl.href);

    return new Promise((resolve, reject) => {
      const processNext = async () => {
        if (this.isAborted) return;
        if (queue.length === 0 && this.activeWorkers === 0) {
          resolve({
            outputDir,
            engine: 'native',
            filesDownloaded: this.filesDownloaded,
            totalDiscovered: this.visitedUrls.size
          });
          return;
        }

        while (queue.length > 0 && this.activeWorkers < this.options.concurrency) {
          const item = queue.shift();
          this.activeWorkers++;

          this._downloadItem(item, baseHost, outputDir, client, queue, onProgress)
            .catch(() => {})
            .finally(() => {
              this.activeWorkers--;
              if (this.options.delay > 0) {
                setTimeout(processNext, this.options.delay * 1000);
              } else {
                setImmediate(processNext);
              }
            });
        }
      };

      processNext();
    });
  }

  async _downloadItem(item, baseHost, outputDir, client, queue, onProgress) {
    if (this._isExcluded(item.url)) return;

    try {
      const parsedUrl = new URL(item.url);
      const targetFilePath = this._urlToFilePath(parsedUrl, baseHost, outputDir);
      const response = await client.get(item.url);
      const contentType = response.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html') || parsedUrl.pathname.endsWith('.html') || item.isHtml;

      const fileDir = path.dirname(targetFilePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      let dataToWrite = response.data;

      if (isHtml) {
        const htmlContent = response.data.toString('utf8');
        const $ = cheerio.load(htmlContent);

        // Rewrite and collect assets
        const collectAsset = (rawAttr, element, attrName) => {
          if (!rawAttr || rawAttr.startsWith('data:') || rawAttr.startsWith('javascript:') || rawAttr.startsWith('#')) {
            return;
          }
          try {
            const assetUrl = new URL(rawAttr, item.url);
            const isSameHost = assetUrl.hostname === baseHost;

            if (isSameHost || this.options.allowCrossOriginAssets) {
              const assetFile = this._urlToFilePath(assetUrl, baseHost, outputDir);
              const relativeAssetPath = path.relative(path.dirname(targetFilePath), assetFile).replace(/\\/g, '/');
              $(element).attr(attrName, relativeAssetPath);

              if (!this.visitedUrls.has(assetUrl.href)) {
                this.visitedUrls.add(assetUrl.href);
                queue.push({ url: assetUrl.href, depth: item.depth, isHtml: false });
              }
            }
          } catch {}
        };

        $('img[src]').each((_, el) => collectAsset($(el).attr('src'), el, 'src'));
        $('script[src]').each((_, el) => collectAsset($(el).attr('src'), el, 'src'));
        $('link[rel="stylesheet"]').each((_, el) => collectAsset($(el).attr('href'), el, 'href'));
        $('source[src]').each((_, el) => collectAsset($(el).attr('src'), el, 'src'));

        // Collect internal links if depth permits
        if (item.depth < this.options.maxDepth) {
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:')) return;
            try {
              const linkUrl = new URL(href, item.url);
              if (linkUrl.hostname === baseHost) {
                const targetLinkFile = this._urlToFilePath(linkUrl, baseHost, outputDir);
                const relativeLinkPath = path.relative(path.dirname(targetFilePath), targetLinkFile).replace(/\\/g, '/');
                $(el).attr('href', relativeLinkPath);

                const cleanHref = linkUrl.origin + linkUrl.pathname + linkUrl.search;
                if (!this.visitedUrls.has(cleanHref)) {
                  this.visitedUrls.add(cleanHref);
                  queue.push({ url: cleanHref, depth: item.depth + 1, isHtml: true });
                }
              }
            } catch {}
          });
        }

        dataToWrite = Buffer.from($.html(), 'utf8');
      }

      fs.writeFileSync(targetFilePath, dataToWrite);
      this.filesDownloaded++;

      if (onProgress) {
        onProgress({
          count: this.filesDownloaded,
          url: item.url,
          file: targetFilePath,
          queueLength: queue.length
        });
      }
    } catch (err) {
      // In enterprise crawlers, 404/403 on isolated assets shouldn't crash the entire mirror job
    }
  }

  abort() {
    this.isAborted = true;
  }
}

module.exports = { NativeEngine };

