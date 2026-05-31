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

  async function _create(disp, c) {
    const payload = {
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
      market_context: {
        origin: 'auto_scan',               // otomatik taramadan geldi
        dir: c.dir, price: c.price,
        risk: (c.risk && c.risk.label != null) ? c.risk.label : (c.risk != null ? c.risk : null),
        score: c.score, rsi: c.rsi,
        created_at: new Date().toISOString(),
      },
    };
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
      for (const c of picks) { await _create(disp, c); }
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
