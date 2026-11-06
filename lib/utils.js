'use strict';

const fs = require('fs');
const path = require('path');
const archiverModule = require('archiver');
const archiver = typeof archiverModule === 'function' ? archiverModule : (archiverModule.default || archiverModule);

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function countFiles(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
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
  } catch {
    // Ignore read errors
  }
  return count;
}

function getDirectorySize(dir) {
  let size = 0;
  if (!fs.existsSync(dir)) return 0;
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
  } catch {
    // Ignore read errors
  }
  return size;
}

function createArchiveInstance(format = 'zip', options = {}) {
  const archiverModule = require('archiver');
  if (typeof archiverModule === 'function') {
    return archiverModule(format, options);
  }
  if (format === 'tar' && archiverModule.TarArchive) {
    return new archiverModule.TarArchive({ gzip: true, ...options });
  }
  if (archiverModule.ZipArchive) {
    return new archiverModule.ZipArchive({ zlib: { level: 9 }, ...options });
  }
  throw new Error('Unsupported archiver module configuration');
}

function archiveDirectory(dir, format = 'zip') {
  return new Promise((resolve, reject) => {
    const ext = format === 'tar' ? 'tar.gz' : 'zip';
    const outPath = `${dir}.${ext}`;
    const output = fs.createWriteStream(outPath);
    
    let archive;
    try {
      archive = createArchiveInstance(format);
    } catch (err) {
      return reject(err);
    }

    output.on('close', () => {
      resolve({ path: outPath, size: archive.pointer() });
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(dir, false);
    archive.finalize();
  });
}

function validateUrl(input) {
  try {
    const parsed = new URL(input);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizePath(urlPath) {
  let cleaned = urlPath.replace(/[?#].*$/, '');
  if (!cleaned || cleaned === '/' || cleaned.endsWith('/')) {
    cleaned += 'index.html';
  }
  return cleaned;
}

module.exports = {
  formatBytes,
  countFiles,
  getDirectorySize,
  archiveDirectory,
  validateUrl,
  sanitizePath
};
