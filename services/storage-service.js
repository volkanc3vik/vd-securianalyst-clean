// ═══════════════════════════════════════════════
// STORAGE SERVICE — localStorage merkezi yönetim
// ═══════════════════════════════════════════════
import { STORAGE_KEYS } from '../modules/constants.js';
import { safeJSON } from '../modules/helpers.js';

class StorageService {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return safeJSON(raw, raw); // JSON ise parse et, değilse string döndür
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch { return false; }
  }

  // Trade memory — max 500 kayıt
  getTrades() {
    return this.get(STORAGE_KEYS.TRADE_MEMORY, []);
  }

  saveTrades(trades) {
    return this.set(STORAGE_KEYS.TRADE_MEMORY, trades.slice(-500));
  }

  // Bildirimler
  getNotifications() {
    return this.get(STORAGE_KEYS.NOTIF_STORE, []);
  }

  saveNotifications(notifs) {
    return this.set(STORAGE_KEYS.NOTIF_STORE, notifs.slice(-200));
  }

  // Toast toggle
  isToastEnabled() {
    return this.get(STORAGE_KEYS.TOAST_ENABLED, 'true') !== 'false';
  }

  setToastEnabled(val) {
    return this.set(STORAGE_KEYS.TOAST_ENABLED, val ? 'true' : 'false');
  }

  // User prefs
  getPrefs() {
    return this.get(STORAGE_KEYS.USER_PREFS, {});
  }

  setPref(key, value) {
    const prefs = this.getPrefs();
    prefs[key] = value;
    return this.set(STORAGE_KEYS.USER_PREFS, prefs);
  }

  getPref(key, fallback = null) {
    return this.getPrefs()[key] ?? fallback;
  }
}

export const Storage = new StorageService();
