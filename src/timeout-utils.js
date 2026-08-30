class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
  }
}

function withTimeout(taskFactory, timeoutMs, message, onTimeout) {
  if (!timeoutMs || timeoutMs <= 0) return taskFactory();
  let timer;
  let timedOut = false;
  const task = Promise.resolve()
    .then(taskFactory)
    .then((value) => {
      if (timedOut) return new Promise(() => {});
      return value;
    })
    .catch((error) => {
      if (timedOut) return new Promise(() => {});
      throw error;
    });
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(async () => {
      timedOut = true;
      try {
        if (onTimeout) await onTimeout();
      } finally {
        reject(new TimeoutError(message));
      }
    }, timeoutMs);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

function shouldResetBrowserAfterError(error) {
  const text = String((error && (error.stack || error.message)) || error || "");
  return error instanceof TimeoutError || /Target page, context or browser has been closed/i.test(text);
}

module.exports = { TimeoutError, shouldResetBrowserAfterError, withTimeout };
