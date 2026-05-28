// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · ENGINE
// Trade lifecycle yöneticisi:
//   - Telegram VIP gönderim eventini dinler → addTrade
//   - 5sn polling (sadece aktif trade varsa)
//   - Hit detection (LONG/SHORT mantığı)
//   - TP1 hit → breakeven SL
//   - TP3 hit → FINAL mesaj + trade closed
//   - STOP hit → trade stopped
//   - 24h expire kontrolü
//
// Public API:
//   TradeWatcher.start()
//   TradeWatcher.stop()
//   TradeWatcher.list()
//   TradeWatcher.clear()
//   TradeWatcher.simulatePrice(sym, price)
//   TradeWatcher.clearSimulation(sym?)
//   TradeWatcher.addTradeFromSignal(signal, channel, messageId)
//   TradeWatcher.checkOnce()        // anlık tek tur kontrol (test için)
//
// Test mode:
//   window.ENABLE_TRADE_WATCHER_TELEGRAM = false  (default — sadece console)
//   true: Aşama 5'te Telegram update için
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const POLL_INTERVAL = 5000;  // 5 saniye
  const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 saat
  const TARGETS = ['TP1', 'TP2', 'TP3'];

  let _timer = null;
  let _running = false;
  let _polling = false; // overlap koruma
  let _started = false;

  // Telegram update flag (Aşama 5 için, şimdilik false)
  window.ENABLE_TRADE_WATCHER_TELEGRAM = window.ENABLE_TRADE_WATCHER_TELEGRAM || false;

  function _debug(...args) {
    if (window.VipTrackerDebug) console.debug('[VIP-Track:Engine]', ...args);
  }

  // ── Public: VIP sinyalinden trade oluştur ──────────────────────
  function addTradeFromSignal(signal, channel, messageId) {
    if (!signal || channel !== 'vip') return null;
    if (!signal.sym || !signal.dir) return null;
    if (!signal.entry || !signal.sl) {
      _debug('skip: entry/sl missing', signal.sym, signal.dir);
      return null;
    }

    const direction = String(signal.dir).toUpperCase();
    const isShort = direction === 'SHORT';
    const entry = +signal.entry;
    const sl = isShort
      ? +(signal.slShort ?? signal.sl)
      : +signal.sl;

    const tp1 = isShort ? +(signal.tp1Short ?? signal.tp1) : +signal.tp1;
    const tp2 = isShort ? +(signal.tp2Short ?? signal.tp2) : +signal.tp2;
    const tp3 = isShort ? +(signal.tp3Short ?? signal.tp3) : +signal.tp3;

    if (![entry, sl].every(Number.isFinite)) {
      _debug('skip: invalid entry/sl', signal.sym);
      return null;
    }
    const tps = [tp1, tp2, tp3].filter(Number.isFinite);
    if (tps.length === 0) {
      _debug('skip: no valid TPs', signal.sym);
      return null;
    }

    const now = Date.now();
    const trade = {
      signalId: `${signal.sym}_${direction}_${now}_${Math.random().toString(36).slice(2, 8)}`,
      symbol:   String(signal.sym).toUpperCase(),
      direction,
      entry,
      stopLoss: sl,
      originalStopLoss: sl,
      takeProfits: tps,
      confidence: signal.score || 0,
      risk: signal.risk || null,
      telegramMessageId: messageId || null,
      status: 'active',
      hitTargets: [],
      breakevenApplied: false,
      createdAt: now,
      updatedAt: now,
      lastCheckedPrice: null,
      expiresAt: now + EXPIRE_MS,
    };

    const ok = window.TradeWatcherState.add(trade);
    if (ok) {
      window.TradeWatcherLogger.tradeAdded(trade);
      _maybeStartPolling();
    }
    return ok ? trade : null;
  }

  // ── Hit detection ──────────────────────────────────────────────
  function _checkTrade(trade, price) {
    if (!trade || trade.status !== 'active') return;
    if (!Number.isFinite(+price)) return;

    trade.lastCheckedPrice = price;

    // Expire kontrolü
    if (Date.now() >= trade.expiresAt) {
      window.TradeWatcherState.update(trade.signalId, { status: 'expired' });
      window.TradeWatcherLogger.tradeExpired(trade);
      return;
    }

    const isLong  = trade.direction === 'LONG';
    const isShort = trade.direction === 'SHORT';

    // STOP kontrolü öncelikli — bir mumda hem TP hem STOP olamaz mantıken
    // (ticker price tek nokta olduğu için sadece o anlık değer)
    const stopHit = (isLong  && price <= trade.stopLoss) ||
                    (isShort && price >= trade.stopLoss);

    if (stopHit) {
      // Eğer breakeven aktifse "stop" yerine "breakeven exit" sayılır ama
      // teknik olarak STOP hit, status='stopped' veriyoruz
      window.TradeWatcherState.update(trade.signalId, { status: 'stopped' });
      window.TradeWatcherLogger.stopHit(trade, price);
      return;
    }

    // TP kontrolü — sırayla TP1, TP2, TP3
    for (let i = 0; i < trade.takeProfits.length; i++) {
      const label = TARGETS[i];
      if (trade.hitTargets.includes(label)) continue;
      const tp = trade.takeProfits[i];
      const tpHit = (isLong  && price >= tp) ||
                    (isShort && price <= tp);
      if (!tpHit) break; // sıralı kontrol — bir TP olmadıysa sonrakine bakma

      // Hit
      trade.hitTargets.push(label);
      window.TradeWatcherLogger.tpHit(trade, label, price);

      // TP1 hit → breakeven
      if (label === 'TP1' && !trade.breakevenApplied) {
        trade.stopLoss = trade.entry;
        trade.breakevenApplied = true;
        window.TradeWatcherLogger.breakeven(trade);
      }

      // TP3 → FINAL
      if (label === 'TP3') {
        window.TradeWatcherState.update(trade.signalId, { status: 'closed' });
        window.TradeWatcherLogger.finalMessage(trade, price);
        return;
      }
    }

    // State sync
    window.TradeWatcherState.update(trade.signalId, {
      hitTargets: trade.hitTargets,
      stopLoss: trade.stopLoss,
      breakevenApplied: trade.breakevenApplied,
      lastCheckedPrice: price,
    });
  }

  // ── Polling tek tur ────────────────────────────────────────────
  async function checkOnce() {
    if (_polling) return; // overlap koruma
    _polling = true;
    try {
      const active = window.TradeWatcherState.findActive();
      window.TradeWatcherLogger.pollSummary(active.length);

      if (active.length === 0) {
        _maybeStopPolling();
        return;
      }

      // Fresh price fetch (simulatePrice override'larını ezmez — getPrice katmanında handle ediliyor)
      await window.TradeWatcherPrice.fetchAll();

      // Active snapshot — checkTrade içinde status değişebilir, kopya üzerinden geç
      for (const trade of active.slice()) {
        // Trade'in güncel halini her zaman state'ten al — _checkTrade içinde mutasyon olabilir
        const fresh = window.TradeWatcherState.findById(trade.signalId);
        if (!fresh || fresh.status !== 'active') continue;
        const price = window.TradeWatcherPrice.getPrice(fresh.symbol);
        if (price == null) {
          _debug('no price for', fresh.symbol);
          continue;
        }
        _checkTrade(fresh, price);
      }
    } catch (e) {
      _debug('checkOnce error', e.message);
    } finally {
      _polling = false;
    }
  }

  // ── Polling lifecycle ──────────────────────────────────────────
  function _maybeStartPolling() {
    if (_running) return;
    const active = window.TradeWatcherState.findActive();
    if (active.length === 0) return;
    start();
  }

  function _maybeStopPolling() {
    if (!_running) return;
    const active = window.TradeWatcherState.findActive();
    if (active.length === 0) {
      stop();
      _debug('no active trades, polling stopped');
    }
  }

  function start() {
    if (_running) return;
    _running = true;
    _debug('polling started');
    // İlk tur hemen
    checkOnce();
    _timer = setInterval(checkOnce, POLL_INTERVAL);
  }

  function stop() {
    if (!_running) return;
    _running = false;
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
    _debug('polling stopped');
  }

  // ── Init — Telegram event listener ─────────────────────────────
  function init() {
    if (_started) return;
    _started = true;
    window.addEventListener('vd:telegram:sent', (e) => {
      const d = e.detail || {};
      if (d.channel !== 'vip') return;
      if (!d.signal) return;
      addTradeFromSignal(d.signal, d.channel, d.messageId);
    });
    _debug('engine initialized, listening for vd:telegram:sent');
  }

  // ── Public API ─────────────────────────────────────────────────
  window.TradeWatcher = {
    start,
    stop,
    list: () => window.TradeWatcherState.list(),
    clear: () => {
      stop();
      window.TradeWatcherState.clear();
    },
    simulatePrice: async (sym, price) => {
      window.TradeWatcherPrice.simulatePrice(sym, price);
      // simulatePrice manuel test API — devam eden polling'i beklet, sonra tur at
      while (_polling) {
        await new Promise(r => setTimeout(r, 10));
      }
      return checkOnce();
    },
    clearSimulation: (sym) => window.TradeWatcherPrice.clearSimulation(sym),
    addTradeFromSignal,  // manuel test için
    checkOnce,           // manuel test için
    isRunning: () => _running,
    init,
  };
})();
