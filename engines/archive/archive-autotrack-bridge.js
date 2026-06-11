// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — ARCHIVE AUTO-TRACK BRIDGE (v1)
// Scanner'ın OTOMATİK bulduğu nitelikli setup'ları, manuel Telegram yolunun
// kullandığı AYNI create API'siyle Archive'a pending kayıt olarak açar.
//
// Kaynak olay: index.html scanner → window 'vd:scan:complete' { detail:{ results } }
// results item: { sym, price, dir:'LONG'|'SHORT'|null, lScore, sScore, risk, rsi }
//
// GÜVENLİK / TASARIM:
//  • Sadece ADMIN oturumunda çalışır (TelegramDispatcher.hasAdminKey()) — manuel yolla aynı.
//    Ziyaretçilerde tetiklenmez, arşive yazmaz.
//  • Skor eşiği (VD_AUTOTRACK_MIN_SCORE, vars. 90) altındakileri ALMAZ → arşiv çöple dolmaz.
//  • Tarama başına en çok VD_AUTOTRACK_MAX (vars. 4) setup.
//  • Dedup: aynı sym|dir için cooldown (VD_AUTOTRACK_COOLDOWN_MIN, vars. 180 dk) + endpoint dedup.
//  • Motor/scanner/outcome mantığına DOKUNMAZ; sadece mevcut create API'sini çağırır.
//  • Hata olsa bile taramayı/işleyişi ETKİLEMEZ (her şey try/catch).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const ENDPOINT = '/api/analysis-archive';
  const TAG = '[ARCHIVE_AUTOTRACK]';

  const CFG = {
    get minScore()  { return Number(window.VD_AUTOTRACK_MIN_SCORE) || 90; },
    get maxPerScan(){ return Number(window.VD_AUTOTRACK_MAX) || 4; },
    get cooldownMs(){ return (Number(window.VD_AUTOTRACK_COOLDOWN_MIN) || 180) * 60000; },
    get enabled()   { return window.VD_AUTOTRACK_ENABLED !== false; }, // varsayılan AÇIK
  };

  const _recent = new Map(); // "SYM|DIR" -> ts (cooldown)
  let _busy = false;

  function _disp() { return window.TelegramDispatcher || null; }
  function _num(v) { const n = Number(v); return isNaN(n) ? null : n; }

  function _pick(results) {
    // her setup için yöne göre etkin skor
    const cand = [];
    for (const r of (results || [])) {
      if (!r || !r.sym) continue;
      const lS = _num(r.lScore), sS = _num(r.sScore);
      // LONG adayı
      if (lS != null && lS >= CFG.minScore) cand.push({ sym: r.sym, dir: 'LONG',  score: lS, price: _num(r.price), risk: r.risk, rsi: _num(r.rsi) });
      // SHORT adayı
      if (sS != null && sS >= CFG.minScore) cand.push({ sym: r.sym, dir: 'SHORT', score: sS, price: _num(r.price), risk: r.risk, rsi: _num(r.rsi) });
    }
    // skora göre sırala, sym|dir tekille, cooldown'dakileri at, maxPerScan ile sınırla
    cand.sort((a, b) => b.score - a.score);
    const now = Date.now(), out = [], seen = new Set();
    for (const c of cand) {
      const key = c.sym + '|' + c.dir;
      if (seen.has(key)) continue; seen.add(key);
      const last = _recent.get(key);
      if (last && (now - last) < CFG.cooldownMs) continue; // cooldown
      out.push(c);
      if (out.length >= CFG.maxPerScan) break;
    }
    return out;
  }

  // ════════ PHASE 9 — VERİ ZENGİNLEŞTİRME (sadece veri toplama) ════════
  // Gerçek market bağlamını Binance futures public API'den çeker. Bulunamayan = null (UYDURMA YOK).
  // Tam defensive: her alan ayrı try/catch + timeout; hata olsa bile archive create BOZULMAZ.
  const FUT = 'https://fapi.binance.com';

  function _fetchJson(url, ms) {
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
      const t = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} fin(null); }, ms || 3500);
      fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
        .then(r => r.ok ? r.json() : null).then(d => fin(d)).catch(() => fin(null));
    });
  }
  const _n = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };
  // KURAL 7: enrichment sonucunu KISA logla
  function _enrLog(sym, e) {
    const f = (k) => (e && e[k] != null) ? e[k] : '·';
    console.log(TAG, 'enrich', sym, `fund:${f('funding_rate')} oi:${f('open_interest')} ls:${f('long_short_ratio')} atr:${f('atr')} vol:${f('volatility_band')} rejim:${f('market_regime')} yapı:${f('structure')}`);
  }

  // structure: gerçek SMC tespiti DEĞİL — rsi/dir'den dürüst türetim
  function _structure(dir, rsi) {
    if (rsi == null) return null;
    if (rsi >= 68) return 'RSI Expansion';
    if (rsi <= 32) return 'Aşırı Satım Tepkisi';
    if (dir === 'LONG' && rsi >= 52) return 'Trend + Momentum';
    if (dir === 'SHORT' && rsi <= 48) return 'Trend + Momentum';
    return 'Yapısal Denge';
  }
  // market_regime: scanner'ın hesapladığı global rejim rozetini DOM'dan oku (gerçek değer), yoksa null
  function _regime() {
    try {
      const el = document.getElementById('regimeBadge');
      if (!el) return null;
      const cls = (el.className.match(/regime-([A-Z]+)/) || [])[1];
      return cls || (el.textContent || '').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g, '').trim() || null;
    } catch (e) { return null; }
  }
  function _volBand(atrPct) {
    if (atrPct == null) return null;
    if (atrPct < 2) return 'LOW';
    if (atrPct <= 5) return 'NORMAL';
    return 'HIGH';
  }

  async function _enrich(c) {
    const sym = c.sym;
    const base = { funding_rate: null, open_interest: null, open_interest_change: null,
      long_short_ratio: null, atr: null, volatility_band: null, market_regime: null,
      timeline_event: null, liquidity_event: null, structure: null };
    try {
      base.structure = _structure(c.dir, c.rsi);
      base.market_regime = _regime();
      const [prem, oi, ls, kl] = await Promise.all([
        _fetchJson(`${FUT}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(sym)}`),
        _fetchJson(`${FUT}/fapi/v1/openInterest?symbol=${encodeURIComponent(sym)}`),
        _fetchJson(`${FUT}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(sym)}&period=5m&limit=1`),
        _fetchJson(`${FUT}/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=1d&limit=15`),
      ]);
      if (prem && prem.lastFundingRate != null) base.funding_rate = _n(prem.lastFundingRate);
      if (oi && oi.openInterest != null) base.open_interest = _n(oi.openInterest);
      if (Array.isArray(ls) && ls[0] && ls[0].longShortRatio != null) base.long_short_ratio = _n(ls[0].longShortRatio);
      if (Array.isArray(kl) && kl.length >= 5) {
        let sum = 0, n = 0;
        for (const k of kl) { const hi = _n(k[2]), lo = _n(k[3]), cl = _n(k[4]); if (hi != null && lo != null && cl) { sum += (hi - lo) / cl * 100; n++; } }
        if (n) { const atrPct = sum / n; base.atr = Math.round(atrPct * 100) / 100; base.volatility_band = _volBand(atrPct); }
      }
    } catch (e) { /* enrichment archive create'i ASLA bozmaz */ }
    return base;
  }

  async function _create(disp, c, enriched) {
    // KURAL 1: enrichment create'i ASLA bozmaz (pre-enrich gelmezse burada güvenli üret)
    if (!enriched) { try { enriched = await _enrich(c); } catch (e) { enriched = {}; } }
    _enrLog(c.sym, enriched); // KURAL 7
    // ── HYBRID V2: kayıt anında Price/Deriv/Final üçlüsü hesaplanır ve damgalanır ──
    let hyFields = {};
    try {
      const HE = window.VDHybridEngine;
      if (HE && HE.evaluate) {
        const rec = await HE.evaluate(c.sym, c.dir, c.score);
        hyFields = HE.payloadFields(rec);
      }
    } catch (e) { hyFields = (window.VDHybridEngine && window.VDHybridEngine.payloadFields) ? window.VDHybridEngine.payloadFields(null) : {}; }
    const payload = Object.assign({}, hyFields, {
      action: 'create',
      sym: c.sym,
      direction: c.dir,
      timeframe: 'auto',
      price_at_analysis: c.price != null ? c.price : 0,
      analysis_score: c.score,
      analysis_text: null,
      ai_learned: null,
      source: 'ai_engine_auto',           // manuel 'ai_engine'den AYIRT EDİLİR
      telegram_msg_id: null,
      market_context: Object.assign({
        origin: 'auto_scan',               // otomatik taramadan geldi
        dir: c.dir, price: c.price,
        risk: (c.risk && c.risk.label != null) ? c.risk.label : (c.risk != null ? c.risk : null),
        score: c.score, rsi: c.rsi,
        created_at: new Date().toISOString(),
      }, enriched),                        // funding/oi/long-short/atr/vol/regime/structure (+null'lar)
    });
    let r;
    try { r = await disp.adminFetch(ENDPOINT, payload); }
    catch (e) { console.warn(TAG, c.sym, c.dir, 'create FIRLATTI:', e && e.message); return false; }
    if (r && r.ok) {
      _recent.set(c.sym + '|' + c.dir, Date.now());
      console.log(TAG, r.deduped ? ('zaten vardı (dedup) ' + c.sym) : ('YENİ pending ✓ ' + c.sym + ' ' + c.dir + ' (skor ' + c.score + ')'), 'id=' + (r.row && r.row.id));
      try { window.dispatchEvent(new CustomEvent('vd:archive:created', { detail: { row: r.row || null, deduped: !!r.deduped, auto: true } })); } catch (e) {}
      return true;
    }
    console.warn(TAG, c.sym, 'create BAŞARISIZ:', (r && r.error) || 'bilinmiyor');
    return false;
  }

  async function _onScan(ev) {
    if (_busy) return;
    try {
      if (!CFG.enabled) return;
      const results = ev && ev.detail && ev.detail.results;
      if (!results || !results.length) return;

      const disp = _disp();
      if (!disp || typeof disp.adminFetch !== 'function') { return; } // admin köprüsü yok → sessiz
      if (!disp.hasAdminKey || !disp.hasAdminKey()) {
        // admin oturumu değil → otomatik takip YOK (ziyaretçi güvenliği). Sessiz geç.
        return;
      }

      const picks = _pick(results);
      if (!picks.length) { console.log(TAG, 'eşik üstü yeni setup yok (min skor ' + CFG.minScore + ')'); return; }

      _busy = true;
      console.log(TAG, picks.length + ' setup takibe alınıyor →', picks.map(p => p.sym + ' ' + p.dir + '(' + p.score + ')').join(', '));
      // KURAL 6: enrichment TÜM setup'lar için PARALEL (toplam gecikme ≈ tek timeout, N× değil). Create'ler sıralı kalır (dedup güvenli).
      const emap = {};
      await Promise.all(picks.map(async (c) => { try { emap[c.sym + '|' + c.dir] = await _enrich(c); } catch (e) { emap[c.sym + '|' + c.dir] = {}; } }));
      for (const c of picks) { await _create(disp, c, emap[c.sym + '|' + c.dir]); }
    } catch (e) {
      console.warn(TAG, 'beklenmeyen hata (yutuldu, tarama etkilenmez):', e && e.message);
    } finally { _busy = false; }
  }

  window.addEventListener('vd:scan:complete', _onScan);
  window.VDArchiveAutoTrack = {
    _onScan, _pick, _version: 'v1',
    // canlı ayar: window.VD_AUTOTRACK_MIN_SCORE = 85; gibi
    config: CFG,
    forceRun: function () { try { _onScan({ detail: { results: window._lastScanResults || (window.VD_STATE && window.VD_STATE.scanResults) } }); } catch (e) {} },
  };
  console.log(TAG, 'yüklendi ✓ — vd:scan:complete dinleniyor (admin oturumunda otomatik takip, min skor ' + CFG.minScore + ').');
})();
