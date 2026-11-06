'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
  } catch {}
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
  } catch {}
  return size;
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

/**
 * Native Zero-Dependency USTAR Tar Archive Creator with Gzip compression
 */
function createTarHeader(name, size, mode = 0o644) {
  const header = Buffer.alloc(512);
  let normalizedName = name.replace(/\\/g, '/');
  if (normalizedName.startsWith('./')) normalizedName = normalizedName.slice(2);
  if (normalizedName.length > 100) normalizedName = normalizedName.slice(-100);

  header.write(normalizedName, 0, 100, 'utf8');
  header.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8, 'utf8');
  header.write((0).toString(8).padStart(7, '0') + '\0', 108, 8, 'utf8');
  header.write((0).toString(8).padStart(7, '0') + '\0', 116, 8, 'utf8');
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8');
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 12, 'utf8');
  header.fill(32, 148, 156); // 8 spaces for checksum placeholder
  header.write('0', 156, 1, 'utf8'); // typeflag normal file
  header.write('ustar\0', 257, 6, 'utf8');
  header.write('00', 263, 2, 'utf8');

  // Compute checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');
  return header;
}

/**
 * High-performance, zero-dependency tar.gz generator
 */
async function archiveDirectory(dir, format = 'tar') {
  const ext = 'tar.gz';
  const outPath = `${dir}.${ext}`;
  const writeStream = fs.createWriteStream(outPath);
  const gzipStream = zlib.createGzip({ level: 9 });
  gzipStream.pipe(writeStream);

  function walk(currentDir, relativePrefix = '') {
    const entries = fs.readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const relPath = relativePrefix ? `${relativePrefix}/${entry}` : entry;
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        const fileData = fs.readFileSync(fullPath);
        const header = createTarHeader(relPath, fileData.length, stat.mode);
        gzipStream.write(header);
        gzipStream.write(fileData);

        // Pad to 512-byte boundary
        const remainder = fileData.length % 512;
        if (remainder !== 0) {
          gzipStream.write(Buffer.alloc(512 - remainder));
        }
      }
    }
  }

  walk(dir);
  // Write 1024 zero bytes marking tar end
  gzipStream.write(Buffer.alloc(1024));
  gzipStream.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const stat = fs.statSync(outPath);
      resolve({ path: outPath, size: stat.size });
    });
    writeStream.on('error', reject);
    gzipStream.on('error', reject);
  });
}

module.exports = {
  formatBytes,
  countFiles,
  getDirectorySize,
  archiveDirectory,
  validateUrl,
  sanitizePath
};
