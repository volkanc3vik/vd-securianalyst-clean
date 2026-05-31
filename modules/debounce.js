// ═══════════════════════════════════════════════
// DEBOUNCE / THROTTLE — Performance utilities
// ═══════════════════════════════════════════════

/**
 * Debounce — son çağrıdan delay ms sonra çalışır
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle — en fazla interval ms'de bir çalışır
 */
export function throttle(fn, interval = 100) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * RAF throttle — requestAnimationFrame ile senkronize
 * UI güncellemeleri için ideal
 */
export function rafThrottle(fn) {
  let pending = false;
  return function (...args) {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      fn.apply(this, args);
      pending = false;
    });
  };
}

/**
 * Once — sadece bir kez çalışır
 */
export function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

/**
 * Timer yöneticisi — memory leak önler
 * Tüm interval/timeout'ları merkezi yönet
 */
export class TimerManager {
  constructor() {
    this._intervals = new Map();
    this._timeouts  = new Set();
  }

  setInterval(key, fn, ms) {
    this.clearInterval(key);
    const id = setInterval(fn, ms);
    this._intervals.set(key, id);
    return id;
  }

  clearInterval(key) {
    if (this._intervals.has(key)) {
      clearInterval(this._intervals.get(key));
      this._intervals.delete(key);
    }
  }

  setTimeout(fn, ms) {
    const id = setTimeout(() => {
      this._timeouts.delete(id);
      fn();
    }, ms);
    this._timeouts.add(id);
    return id;
  }

  clearAll() {
    this._intervals.forEach(id => clearInterval(id));
    this._intervals.clear();
    this._timeouts.forEach(id => clearTimeout(id));
    this._timeouts.clear();
  }

  get activeCount() {
    return this._intervals.size + this._timeouts.size;
  }
}

// Global timer manager
export const Timers = new TimerManager();
