'use strict';

const EventEmitter = require('events');

class Logger extends EventEmitter {
  constructor(options = {}) {
    super();
    this.level = options.level || 'info'; // 'silent', 'error', 'warn', 'info', 'debug'
    this.json = Boolean(options.json);
    this.levels = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
  }

  _shouldLog(lvl) {
    return this.levels[lvl] <= this.levels[this.level];
  }

  _format(lvl, message, meta) {
    if (this.json) {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        level: lvl,
        message,
        ...(meta && Object.keys(meta).length ? { meta } : {})
      });
    }
    return message;
  }

  error(msg, meta = {}) {
    if (this._shouldLog('error')) {
      const formatted = this._format('error', msg, meta);
      console.error(formatted);
      this.emit('log', { level: 'error', message: msg, meta });
    }
  }

  warn(msg, meta = {}) {
    if (this._shouldLog('warn')) {
      const formatted = this._format('warn', msg, meta);
      console.warn(formatted);
      this.emit('log', { level: 'warn', message: msg, meta });
    }
  }

  info(msg, meta = {}) {
    if (this._shouldLog('info')) {
      const formatted = this._format('info', msg, meta);
      console.log(formatted);
      this.emit('log', { level: 'info', message: msg, meta });
    }
  }

  debug(msg, meta = {}) {
    if (this._shouldLog('debug')) {
      const formatted = this._format('debug', msg, meta);
      console.log(formatted);
      this.emit('log', { level: 'debug', message: msg, meta });
    }
  }
}

module.exports = { Logger };

