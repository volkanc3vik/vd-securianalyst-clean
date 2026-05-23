// ════════════════════════════════════════════════════════════════════
// FUTURES STATE — Tek doğruluk kaynağı
// Pozisyonlar, bakiye, mod — tek noktadan okunur, tek noktadan yazılır.
// Persistence: localStorage. Subscribers: pub/sub pattern.
// ════════════════════════════════════════════════════════════════════
window.FuturesState = (() => {
  'use strict';

  const STORAGE_KEY  = 'vd_futures_v3';
  const STATE_VER    = 3;

  // ── Default state ─────────────────────────────────────────────────
  const _defaultState = () => ({
    ver:        STATE_VER,
    balance:    10000,       // toplam cüzdan bakiyesi (USDT)
    mode:       'CROSS',     // 'CROSS' | 'ISOLATED' (global varsayılan)
    positions:  [],          // aktif + kapalı pozisyonlar
  });

  let _state = _defaultState();
  const _listeners = new Set();

  // ── Persistence ───────────────────────────────────────────────────
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ver !== STATE_VER) return; // şema değişmiş, sıfırla
      // Sanity checks
      if (typeof parsed.balance !== 'number' || !Number.isFinite(parsed.balance)) return;
      if (!Array.isArray(parsed.positions)) return;
      _state = { ..._defaultState(), ...parsed };
    } catch {
      // bozuk veri — varsayılana dön
      _state = _defaultState();
    }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch {
      // quota aşımı vs — sessizce yut
    }
  }

  // ── Pub/Sub ───────────────────────────────────────────────────────
  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  function _notify(eventName, payload) {
    _listeners.forEach(fn => {
      try { fn(eventName, payload, _state); } catch (e) {
        console.warn('[FuturesState] listener error:', e);
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  function getState() {
    // shallow copy — dışarıdan mutasyon engellenir
    return {
      ver:        _state.ver,
      balance:    _state.balance,
      mode:       _state.mode,
      positions:  _state.positions.map(p => ({ ...p })),
    };
  }

  function getActivePositions() {
    return _state.positions
      .filter(p => p.status === 'ACTIVE')
      .map(p => ({ ...p }));
  }

  function getPositionById(id) {
    const p = _state.positions.find(p => p.id === id);
    return p ? { ...p } : null;
  }

  function getBalance() {
    return _state.balance;
  }

  function getMode() {
    return _state.mode;
  }

  function setBalance(amount) {
    const v = +amount;
    if (!Number.isFinite(v) || v < 0) return false;
    // Aktif pozisyon margin'inin altına düşmeye izin verme — likidasyon riski
    const used = (_state.positions || []).reduce((s, p) => s + (+p.margin || 0), 0);
    if (v < used) {
      _notify('balance:rejected', { reason: 'below_used_margin', requested: v, minimum: used });
      return false;
    }
    _state.balance = +v.toFixed(2);
    _save();
    _notify('balance:changed', { balance: _state.balance });
    return true;
  }

  function setMode(mode) {
    if (mode !== 'CROSS' && mode !== 'ISOLATED') return false;
    _state.mode = mode;
    _save();
    _notify('mode:changed', { mode });
    return true;
  }

  /**
   * Yeni pozisyon ekle.
   * @param {Object} pos - controller tarafından doğrulanmış pozisyon objesi
   * @returns {string} eklenen pozisyonun id'si
   */
  function addPosition(pos) {
    if (!pos || !pos.id) return null;
    // mükerrer engelle
    if (_state.positions.some(p => p.id === pos.id)) return null;
    _state.positions.unshift({ ...pos });
    _save();
    _notify('position:added', { position: { ...pos } });
    return pos.id;
  }

  /**
   * Mevcut pozisyonu güncelle (PNL, mark price, TP hit flag'leri vs).
   * Sadece değişen alanları gönder.
   */
  function updatePosition(id, patch) {
    if (!id || !patch || typeof patch !== 'object') return false;
    const i = _state.positions.findIndex(p => p.id === id);
    if (i === -1) return false;
    // id, sym, dir, openTs gibi immutable alanlar overwrite edilmesin
    const immutable = ['id', 'sym', 'symFull', 'dir', 'mode', 'openTs', 'entry', 'lev', 'margin'];
    const safe = { ...patch };
    immutable.forEach(k => delete safe[k]);
    _state.positions[i] = { ..._state.positions[i], ...safe };
    // sadece ACTIVE pozisyon güncellemeleri için kaydet (tick spam etmesin)
    if (patch._persist !== false) _save();
    _notify('position:updated', { id, patch: safe });
    return true;
  }

  /**
   * Pozisyonu kapat. status='CLOSED' yapar ve realized PNL'i bakiyeye yansıtır.
   */
  function closePosition(id, exitPrice, reason = 'MANUAL') {
    const i = _state.positions.findIndex(p => p.id === id);
    if (i === -1) return false;
    const p = _state.positions[i];
    if (p.status !== 'ACTIVE') return false;

    const finalPrice = Number.isFinite(+exitPrice) ? +exitPrice : p.markPrice || p.entry;
    p.status     = 'CLOSED';
    p.closeTs    = Date.now();
    p.closeReason = reason;
    p.exitPrice  = finalPrice;
    // realized PNL'i kalıcı kaydet (p.pnl zaten unrealized'dan güncelleniyor olabilir)
    p.realizedPnl = Number.isFinite(p.pnl) ? p.pnl : 0;

    // Bakiyeye yansıt — yalnızca pnl miktarı eklenir (margin zaten bakiyeye sayılıyordu)
    _state.balance = +(_state.balance + p.realizedPnl).toFixed(2);

    _save();
    _notify('position:closed', { id, position: { ...p }, reason });
    _notify('balance:changed', { balance: _state.balance });
    return true;
  }

  /**
   * Kapanmış pozisyonları temizle (geçmiş listesi büyümesin).
   * Son N kapanmış pozisyonu tut.
   */
  function pruneClosed(keepLast = 50) {
    const closed = _state.positions
      .filter(p => p.status !== 'ACTIVE')
      .sort((a, b) => (b.closeTs || 0) - (a.closeTs || 0))
      .slice(0, keepLast);
    const active = _state.positions.filter(p => p.status === 'ACTIVE');
    _state.positions = [...active, ...closed];
    _save();
  }

  /**
   * Tüm state'i sıfırla (debug / kullanıcı reset).
   */
  function reset() {
    _state = _defaultState();
    _save();
    _notify('state:reset', {});
  }

  // ── Init ──────────────────────────────────────────────────────────
  _load();

  return {
    subscribe,
    getState,
    getActivePositions,
    getPositionById,
    getBalance,
    getMode,
    setBalance,
    setMode,
    addPosition,
    updatePosition,
    closePosition,
    pruneClosed,
    reset,
  };
})();
