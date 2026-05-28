// ════════════════════════════════════════════════════════════════════
// TELEGRAM CONTROLLER
// Formatter + Dispatcher orchestrator. UI ve console'dan giriş noktası.
//
// Public API:
//   await TelegramController.sendCardSignal(sym, dir, channel)
//     → Sayfada kart bulunan bir sinyali Telegram'a gönderir.
//
//   await TelegramController.sendCustom(signalObj, channel)
//     → Tam sinyal objesiyle direkt gönderim (test ve özel kullanım için)
//
//   TelegramController.getHistory()
//     → Bu oturumda gönderilen sinyallerin listesi
//
//   TelegramController.clearHistory()
//     → Geçmişi temizle (debug)
//
//   TelegramController.setDebug(bool)
//     → [TG-CTRL] loglarını aç/kapa
//
// Davranış:
//   - sendCardSignal: önce session'daki SCE/window cache'inden sinyalin
//     güncel halini bulur. Bulamazsa hata döner.
//   - Cooldown / format / network hataları Dispatcher'dan gelir.
//   - History RAM'de tutulur (max 50 entry), sayfa kapanınca uçar.
// ════════════════════════════════════════════════════════════════════
window.TelegramController = (() => {
  'use strict';

  const HISTORY_MAX = 50;
  const _history = []; // { ts, sym, dir, channel, ok, error? }
  let _debug = true;

  function _log(...args)  { if (_debug) console.log('[TG-CTRL]', ...args); }
  function _warn(...args) { console.warn('[TG-CTRL]', ...args); }

  // ── Sayfadaki sinyal verisini bul ─────────────────────────────────
  // SCE, window.VD_STATE.scanResults veya benzer kaynaklardan sym/dir'e
  // göre güncel sinyal objesini arar. Sırayla şu kaynakları dener:
  //   1. window.SCE?.getCard(sym, dir)         - Signal Card Engine
  //   2. window.VD_STATE.scanResults           - scanMarket sonucu (yeni namespace)
  //      fallback: window._lastScanResults     - geriye dönük uyumluluk
  //   3. window.TIState?.get()?.bestSetup      - TI engine
  //   4. window.TIState?.get()?.watchlist      - TI izleme listesi
  function _findSignalData(sym, dir) {
    const symU = (sym || '').toUpperCase();
    const dirU = (dir || '').toUpperCase();

    // 1. SCE (Signal Card Engine)
    try {
      if (window.SCE && typeof window.SCE.getCard === 'function') {
        const card = window.SCE.getCard(symU, dirU);
        if (card) {
          _log('signal source: SCE');
          return _mergeCardData(card, symU, dirU);
        }
      }
    } catch (e) { /* yut */ }

    // 2. Scan sonuçları — önce VD_STATE.scanResults, fallback _lastScanResults
    try {
      // VD_STATE öncelikli ama boş array varsa fallback'a düş
      const primary = window.VD_STATE?.scanResults;
      const secondary = window._lastScanResults;
      const results = (Array.isArray(primary) && primary.length > 0) ? primary
                     : (Array.isArray(secondary) ? secondary : null);
      if (Array.isArray(results)) {
        const item = results.find(r => (r.sym || '').toUpperCase() === symU);
        if (item) {
          const source = (results === primary) ? 'VD_STATE.scanResults' : '_lastScanResults';
          _log('signal source:', source);
          return _mergeScanItem(item, dirU);
        }
      }
    } catch (e) { /* yut */ }

    // 3. TI Best Setup
    try {
      const snap = window.TIState?.get?.();
      if (snap?.bestSetup) {
        const bs = snap.bestSetup;
        if ((bs.sym || '').toUpperCase() === symU && (bs.dir || '').toUpperCase() === dirU) {
          _log('signal source: TI BestSetup');
          return _mergeTISetup(bs);
        }
      }
    } catch (e) { /* yut */ }

    // 4. TI Watchlist
    try {
      const snap = window.TIState?.get?.();
      const watchlist = snap?.watchlist;
      if (Array.isArray(watchlist)) {
        const match = watchlist.find(w =>
          (w.sym || '').toUpperCase() === symU && (w.dir || '').toUpperCase() === dirU
        );
        if (match) {
          _log('signal source: TI Watchlist');
          return _mergeTISetup(match);
        }
      }
    } catch (e) { /* yut */ }

    return null;
  }

  function _mergeCardData(card, sym, dir) {
    // SCE card objesi — direkt kullanılabilir
    return {
      sym, dir,
      score:      card.score || card.lScore || card.sScore || 0,
      entry:      card.entry || card.price,
      sl:         card.sl,
      tp1:        card.tp1,
      tp2:        card.tp2,
      tp3:        card.tp3,
      rationale:  card.rationale || null,
      risk:       card.risk || null,
      price:      card.price,
    };
  }

  function _mergeScanItem(item, dir) {
    const isShort = dir === 'SHORT';
    return {
      sym:        item.sym,
      dir,
      score:      isShort ? (item.sScore || 0) : (item.lScore || 0),
      entry:      item.price,
      price:      item.price,
      sl:         isShort ? item.slShort  : item.sl,
      tp1:        isShort ? item.tp1Short : item.tp1,
      tp2:        isShort ? item.tp2Short : item.tp2,
      tp3:        isShort ? item.tp3Short : item.tp3,
      risk:       item.risk || null,
      rationale:  null,
    };
  }

  function _mergeTISetup(bs) {
    return {
      sym:       bs.sym,
      dir:       bs.dir,
      score:     bs.score || 0,
      entry:     bs.entry || bs.price,
      price:     bs.price,
      sl:        bs.sl,
      tp1:       bs.tp1,
      tp2:       bs.tp2,
      tp3:       bs.tp3,
      risk:      bs.risk || null,
      rationale: bs.rationale || null,
    };
  }

  // ── History yönetimi ──────────────────────────────────────────────
  function _addHistory(entry) {
    _history.unshift({ ts: Date.now(), ...entry });
    if (_history.length > HISTORY_MAX) _history.length = HISTORY_MAX;
  }

  function getHistory() {
    return _history.map(h => ({ ...h }));
  }

  function clearHistory() {
    _history.length = 0;
    _log('history cleared');
  }

  // ── Ana send: kart üzerinden ──────────────────────────────────────
  async function sendCardSignal(sym, dir, channel) {
    const symU = (sym || '').toUpperCase();
    const dirU = (dir || '').toUpperCase();
    const ch   = (channel || '').toLowerCase();

    if (!symU || !dirU) {
      return { ok: false, error: 'sym_dir_required' };
    }
    if (ch !== 'free' && ch !== 'vip') {
      return { ok: false, error: 'invalid_channel' };
    }
    if (!window.TelegramDispatcher) {
      return { ok: false, error: 'dispatcher_unavailable' };
    }

    const signal = _findSignalData(symU, dirU);
    if (!signal) {
      _warn(`analysis data not found: ${symU} ${dirU}`);
      _addHistory({ sym: symU, dir: dirU, channel: ch, ok: false, error: 'signal_not_found' });
      return { ok: false, error: 'signal_not_found' };
    }

    _log(`dispatching ${symU} ${dirU} → ${ch}`);
    const result = await window.TelegramDispatcher.sendSignal(signal, ch);

    _addHistory({
      sym: symU, dir: dirU, channel: ch,
      ok: result.ok,
      messageId: result.messageId || null,
      error: result.ok ? null : result.error,
    });

    return result;
  }

  // ── Tam sinyal objesiyle direkt gönderim (test için) ──────────────
  async function sendCustom(signalObj, channel) {
    if (!signalObj || !signalObj.sym || !signalObj.dir) {
      return { ok: false, error: 'invalid_signal' };
    }
    const ch = (channel || '').toLowerCase();
    if (!window.TelegramDispatcher) {
      return { ok: false, error: 'dispatcher_unavailable' };
    }
    const result = await window.TelegramDispatcher.sendSignal(signalObj, ch);
    _addHistory({
      sym: signalObj.sym, dir: signalObj.dir, channel: ch,
      ok: result.ok,
      messageId: result.messageId || null,
      error: result.ok ? null : result.error,
    });
    return result;
  }

  function setDebug(on) { _debug = !!on; }

  return {
    sendCardSignal,
    sendCustom,
    getHistory,
    clearHistory,
    setDebug,
  };
})();
