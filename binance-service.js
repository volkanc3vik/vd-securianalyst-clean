// ═══════════════════════════════════════════════
// HELPERS — Genel yardımcı fonksiyonlar
// ═══════════════════════════════════════════════

/**
 * Mevcut trading session'ı döndür
 */
export function getCurrentSession() {
  const h = new Date().getUTCHours();
  if (h < 8)  return 'ASIA';
  if (h < 13) return 'LONDON';
  if (h < 21) return 'NEW_YORK';
  return 'AFTER';
}

/**
 * Sayıyı belirli aralığa sıkıştır
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Dizi ortalaması
 */
export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * DOM element oluştur
 */
export function createElement(tag, attrs = {}, innerHTML = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  });
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

/**
 * Event listener'ı güvenli ekle/kaldır
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
  }

  off(event, handler) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).forEach(fn => {
        try { fn(data); } catch (e) { console.warn(`EventBus error [${event}]:`, e); }
      });
    }
  }

  clear() {
    this._listeners.clear();
  }
}

// Global event bus
export const Bus = new EventBus();

/**
 * Lazy singleton — bir kez oluştur, hep kullan
 */
export function lazy(factory) {
  let instance;
  return {
    get() {
      if (!instance) instance = factory();
      return instance;
    },
    reset() { instance = undefined; }
  };
}

/**
 * DOM hazır olunca çalıştır
 */
export function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

/**
 * Mobile mi?
 */
export function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * iOS Safari mi?
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Güvenli JSON parse
 */
export function safeJSON(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Benzersiz ID üret
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
