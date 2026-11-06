'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { sanitizePath } = require('../utils');
const { RetryHandler } = require('../retry');
const { SecurityManager } = require('../security');

class NativeEngine {
  constructor(options = {}) {
    this.options = {
      maxDepth: 3,
      concurrency: 5,
      delay: 0,
      retries: 3,
      timeout: 15000,
      userAgent: 'Mozilla/5.0 (compatible; EnterpriseWebsiteCloner/2.1; +https://github.com/Nikhil012N/clone-this-website)',
      headers: {},
      excludeExtensions: [],
      allowCrossOriginAssets: true,
      extractMarkdown: false,
      ...options
    };

    if (typeof this.options.exclude === 'string') {
      this.options.excludeExtensions = this.options.exclude
        .split(',')
        .map((e) => e.trim().toLowerCase().replace(/^\./, ''));
    }

    this.visitedUrls = new Set();
    this.activeWorkers = 0;
    this.filesDownloaded = 0;
    this.isAborted = false;
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

    if (urlObj.hostname !== baseHost) {
      relPath = path.join('assets', urlObj.hostname, relPath);
    } else {
      relPath = relPath.replace(/^\//, '');
    }

    const normalizedParts = relPath.split('/').map((seg) => seg.replace(/[<>:"|?*]/g, '_'));
    return path.join(outputDir, ...normalizedParts);
  }

  /**
   * Enterprise HTML to Clean Markdown / LLM Ingestion Converter
   * Strips scripts, styles, SVGs, and formats clean semantic markdown for RAG pipelines
   */
  _convertToMarkdown(html, pageTitle = '') {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, nav, footer, iframe').remove();

    let md = pageTitle ? `# ${pageTitle.trim()}\n\n` : '';

    $('h1, h2, h3, h4, h5, h6, p, pre, code, ul, ol, blockquote, table').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const text = $(el).text().trim();
      if (!text) return;

      if (tag === 'h1') md += `\n# ${text}\n\n`;
      else if (tag === 'h2') md += `\n## ${text}\n\n`;
      else if (tag === 'h3') md += `\n### ${text}\n\n`;
      else if (tag === 'h4') md += `\n#### ${text}\n\n`;
      else if (tag === 'p') md += `${text}\n\n`;
      else if (tag === 'blockquote') md += `> ${text}\n\n`;
      else if (tag === 'pre') md += `\`\`\`\n${text}\n\`\`\`\n\n`;
      else if (tag === 'ul' || tag === 'ol') {
        $(el).find('li').each((_, li) => {
          const liText = $(li).text().trim();
          if (liText) md += `* ${liText}\n`;
        });
        md += '\n';
      }
    });

    return md.trim();
  }

  async run(targetUrl, outputDir, onProgress) {
    this.isAborted = false;
    const startUrl = new URL(targetUrl);
    const baseHost = startUrl.hostname;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const queue = [{ url: startUrl.href, depth: 0, isHtml: true }];
    this.visitedUrls.add(startUrl.href);

    return new Promise((resolve) => {
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

          this._downloadItem(item, baseHost, outputDir, queue, onProgress)
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

  async _downloadItem(item, baseHost, outputDir, queue, onProgress) {
    if (this._isExcluded(item.url)) return;

    try {
      const parsedUrl = new URL(item.url);
      const targetFilePath = this._urlToFilePath(parsedUrl, baseHost, outputDir);

      const response = await RetryHandler.executeWithRetry(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.options.timeout);

        try {
          const res = await fetch(item.url, {
            method: 'GET',
            headers: SecurityManager.sanitizeHeaders({
              'User-Agent': this.options.userAgent,
              ...this.options.headers
            }),
            signal: controller.signal,
            redirect: 'follow'
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          return res;
        } finally {
          clearTimeout(timer);
        }
      }, { retries: this.options.retries, delayMs: 400 });

      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html') || parsedUrl.pathname.endsWith('.html') || item.isHtml;

      const fileDir = path.dirname(targetFilePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      let dataToWrite = buffer;

      if (isHtml) {
        const htmlContent = buffer.toString('utf8');
        const $ = cheerio.load(htmlContent);
        const pageTitle = $('title').text() || '';

        // If AI/LLM ingestion mode is active, also generate clean Markdown
        if (this.options.extractMarkdown) {
          const mdText = this._convertToMarkdown(htmlContent, pageTitle);
          const mdFilePath = targetFilePath.replace(/\.html?$/i, '.md');
          fs.writeFileSync(mdFilePath, mdText, 'utf8');
        }

        // Rewrite assets
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
    } catch {}
  }

  abort() {
    this.isAborted = true;
  }
}

module.exports = { NativeEngine };
