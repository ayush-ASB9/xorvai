export function createLogger(tag) {
  return {
    info: (...args) => console.log(`[${tag}]`, ...args),
    warn: (...args) => console.warn(`[${tag}]`, ...args),
    error: (...args) => console.error(`[${tag}]`, ...args),
  };
}
