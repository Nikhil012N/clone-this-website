'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILENAMES = [
  '.clonerc',
  '.clonerc.json',
  '.clonerc.js',
  'cloner.config.json',
  'cloner.config.js'
];

function loadConfigFile(customPath = null, workingDir = process.cwd()) {
  if (customPath) {
    const resolvedPath = path.resolve(workingDir, customPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found at: ${resolvedPath}`);
    }
    return parseConfigFile(resolvedPath);
  }

  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.join(workingDir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        return parseConfigFile(fullPath);
      } catch (err) {
        console.warn(`Failed to parse config ${filename}: ${err.message}`);
      }
    }
  }

  return {};
}

function parseConfigFile(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.js' || ext === '.cjs') {
    return require(filePath);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in configuration file ${filePath}: ${err.message}`);
  }
}

function mergeConfig(defaults, fileConfig = {}, cliConfig = {}) {
  const cleanCli = Object.entries(cliConfig).reduce((acc, [key, val]) => {
    if (val !== undefined && val !== null) {
      acc[key] = val;
    }
    return acc;
  }, {});

  return {
    ...defaults,
    ...fileConfig,
    ...cleanCli
  };
}

module.exports = {
  loadConfigFile,
  mergeConfig,
  CONFIG_FILENAMES
};

