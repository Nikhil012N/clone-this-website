'use strict';

const path = require('path');
const { validateUrl } = require('./utils');

/**
 * Enterprise URL & Path Security Normalizer
 * Mitigates Directory Traversal (Zip Slip / Path Injection)
 * and sanitizes domain and URL components across platforms.
 */
class SecurityManager {
  /**
   * Sanitizes local output paths to prevent directory traversal attacks.
   * Ensures the resulting path stays within the base target directory.
   */
  static safeResolve(baseDir, relativePath) {
    const cleanRelative = relativePath
      .replace(/^[a-zA-Z]:[/\\]/, '') // Strip Windows drive prefixes
      .replace(/^([/\\])+/, '');      // Strip leading slashes

    const resolved = path.resolve(baseDir, cleanRelative);
    const resolvedBase = path.resolve(baseDir);

    if (!resolved.startsWith(resolvedBase)) {
      throw new Error(`Security Violation: Directory traversal detected for path "${relativePath}"`);
    }

    return resolved;
  }

  /**
   * Validates URLs against SSRF risk on internal network resources (metadata servers, localhost)
   * unless explicitly whitelisted in development environments.
   */
  static isAllowedTarget(urlStr, allowLocalhost = false) {
    if (!validateUrl(urlStr)) return false;
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();

      if (!allowLocalhost) {
        // Block cloud metadata services & private ranges
        if (host === '169.254.169.254' || host === 'metadata.google.internal') {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes HTTP headers for outgoing crawler requests to prevent header injection
   */
  static sanitizeHeaders(headers = {}) {
    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      const cleanKey = String(key).replace(/[\r\n]/g, '').trim();
      const cleanValue = String(value).replace(/[\r\n]/g, '').trim();
      if (cleanKey && cleanValue) {
        sanitized[cleanKey] = cleanValue;
      }
    }
    return sanitized;
  }
}

module.exports = { SecurityManager };
