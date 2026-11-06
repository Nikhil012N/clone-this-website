'use strict';

class RetryHandler {
  /**
   * Executes an asynchronous operation with exponential backoff and jitter.
   */
  static async executeWithRetry(fn, options = {}) {
    const maxRetries = options.retries !== undefined ? options.retries : 3;
    const baseDelay = options.delayMs || 500;
    const maxDelay = options.maxDelayMs || 5000;

    let attempt = 0;
    while (true) {
      try {
        return await fn(attempt);
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }

        // Exponential backoff with random jitter: (baseDelay * 2^attempt) + jitter
        const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
        const jitter = Math.random() * (exponential * 0.2);
        const sleepTime = Math.floor(exponential + jitter);

        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
    }
  }
}

module.exports = { RetryHandler };

