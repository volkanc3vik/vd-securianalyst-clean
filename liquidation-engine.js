// ═══════════════════════════════════════════════
// NOTIFICATION ENGINE — Bildirim yönetimi
// UI'dan bağımsız, saf iş mantığı
// ═══════════════════════════════════════════════
import { Storage } from '../services/storage-service.js';
import { Bus } from '../modules/helpers.js';
import { TOAST_MAX, TOAST_DURATION } from '../modules/constants.js';

class NotificationEngine {
  constructor() {
    this._notifs  = [];
    this._unread  = 0;
    this._filter  = 'all';
    this._open    = false;
    this._load();
  }

  _load() {
    this._notifs = Storage.getNotifications();
    this._unread = this._notifs.filter(n => n.unread).length;
  }

  _save() {
    Storage.saveNotifications(this._notifs);
  }

  // ── Bildirim ekle ─────────────────────────────
  add(opts) {
    const notif = {
      id:     Date.now() + Math.random(),
      sym:    opts.sym || 'SİSTEM',
      dir:    opts.dir || 'info',
      level:  opts.level || 'low',
      msg:    opts.msg || '',
      ts:     Date.now(),
      unread: true,
    };

    this._notifs.unshift(notif);
    if (this._notifs.length > 200) this._notifs.pop();
    this._unread++;
    this._save();

    // Event yayınla
    Bus.emit('notification:new', notif);
    Bus.emit('notification:badge', this._unread);

    return notif;
  }

  // ── Tümünü okundu işaretle ────────────────────
  markAllRead() {
    this._notifs.forEach(n => { n.unread = false; });
    this._unread = 0;
    this._save();
    Bus.emit('notification:badge', 0);
  }

  // ── Tümünü sil ───────────────────────────────
  clearAll() {
    this._notifs = [];
    this._unread = 0;
    this._save();
    Bus.emit('notification:cleared');
    Bus.emit('notification:badge', 0);
  }

  // ── Filtrele ─────────────────────────────────
  setFilter(key) {
    this._filter = key;
    Bus.emit('notification:filter', key);
  }

  getFiltered() {
    if (this._filter === 'all') return this._notifs;
    if (this._filter === 'crit') return this._notifs.filter(n => n.level === 'critical');
    return this._notifs.filter(n => n.dir === this._filter);
  }

  // ── Panel toggle ─────────────────────────────
  toggle() {
    this._open = !this._open;
    if (this._open) this.markAllRead();
    Bus.emit('notification:toggle', this._open);
  }

  get unreadCount() { return this._unread; }
  get isOpen()      { return this._open; }
  get all()         { return this._notifs; }
}

export const NC = new NotificationEngine();

// ── Toast Engine — UI katmanı ────────────────────
class ToastEngine {
  constructor() {
    this._enabled = Storage.isToastEnabled();
    this._queue   = [];

    // NC'den gelen yeni bildirimler → toast göster
    Bus.on('notification:new', n => this._show(n));
  }

  _show(n) {
    if (!this._enabled) return;
    const wrap = document.getElementById('ncPopup');
    if (!wrap) return;

    const item = this._createToast(n);
    wrap.insertBefore(item, wrap.firstChild);

    // Max TOAST_MAX göster
    while (wrap.children.length > TOAST_MAX) {
      this._dismiss(wrap.lastChild);
    }

    const tid = setTimeout(() => this._dismiss(item), TOAST_DURATION);
    item._tid = tid;
  }

  _createToast(n) {
    const DIR_EMOJI = { long:'▲', short:'▼', warn:'⚠', info:'◈', entry:'🎯', fake:'🪤' };
    const DIR_COL   = { long:'var(--green)', short:'var(--red)', warn:'var(--orange)', info:'var(--purple)', entry:'var(--cyan)', fake:'var(--yellow)' };
    const DIR_BG    = { long:'rgba(0,229,160,.1)', short:'rgba(255,61,107,.1)', warn:'rgba(255,122,0,.1)', info:'rgba(157,125,250,.1)', entry:'rgba(0,212,255,.1)', fake:'rgba(255,193,7,.1)' };
    const LVL_EMOJI = { critical:'🔴', high:'🟠', medium:'🟡', low:'🟢' };

    const emoji = DIR_EMOJI[n.dir] || '◈';
    const col   = DIR_COL[n.dir]   || 'var(--text2)';
    const bg    = DIR_BG[n.dir]    || 'rgba(255,255,255,.06)';
    const lvlE  = LVL_EMOJI[n.level] || '⚪';
    const sym   = (n.sym || 'SİSTEM').replace('USDT', '').replace('PERP', '');
    const msg   = n.msg?.length > 88 ? n.msg.slice(0, 86) + '…' : (n.msg || '');

    const item = document.createElement('div');
    item.className = `nc-popup-item nc-${n.level}`;
    item.style.setProperty('--toast-duration', (TOAST_DURATION / 1000) + 's');
    item.innerHTML = `
      <button class="ncp-close" onclick="this.closest('.nc-popup-item').remove()">✕</button>
      <div class="ncp-top">
        <span class="ncp-dir-badge" style="background:${bg};color:${col};border:1px solid ${col}33">${emoji} ${sym}</span>
        <span style="font-size:9px;color:var(--text3);margin-left:auto;padding-right:18px">${lvlE}</span>
      </div>
      <div class="ncp-msg">${msg}</div>
      <div class="ncp-timer"><div class="ncp-timer-fill"></div></div>`;
    return item;
  }

  _dismiss(item) {
    if (!item?.parentElement) return;
    clearTimeout(item._tid);
    item.classList.add('toast-exit');
    setTimeout(() => { try { item.remove(); } catch {} }, 220);
  }

  toggle() {
    this._enabled = !this._enabled;
    Storage.setToastEnabled(this._enabled);
    Bus.emit('toast:toggle', this._enabled);
  }

  get enabled() { return this._enabled; }
}

export const Toast = new ToastEngine();
