// ════════════════════════════════════════════════════════════════════
// ui/academy/academy-bridge.js  — Academy ↔ Timeline & Archive köprüsü
//
// SALT OKUMA. Timeline (VDEventStore) ve Archive (SupabaseDB) verilerini
// derslerle bağlar. Hiçbir yazma / event üretimi / pipeline teması YOK.
//
//   examplesFor(lessonId)  -> { coins:[...], events:[{sym,ts,msg}], count }
//   loadArchive()          -> son 30 gün public archive satırları (cache)
//   outcomeFor(lesson)     -> { total, validated, partial, rejected, rate } | null
//
// Başarı tanımı archive ile aynı: validated=1, partially_validated=.5, not=0
// window.VDAcademyBridge
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDAcademyBridge) return;

  const WEIGHT = { validated: 1, partially_validated: 0.5, not_validated: 0 };
  const COIN = (s) => String(s || '').replace(/USDT$|USDC$|BUSD$|PERP$/i, '');

  // ── lessonId → eşleşen regex'ler (event-lesson-map RULES'tan türetilir) ──
  let _lessonRe = null;
  function _lessonRegexes(lessonId) {
    if (!_lessonRe) {
      _lessonRe = {};
      const rules = (window.VDEventLessonMap && window.VDEventLessonMap.RULES) || [];
      rules.forEach(r => r.lessons.forEach(id => { (_lessonRe[id] = _lessonRe[id] || []).push(r.re); }));
    }
    return _lessonRe[lessonId] || [];
  }

  // ── TIMELINE: bu derse haritalanan olaylar ──
  function _eventsForLesson(lessonId) {
    try {
      const store = window.VDEventStore;
      const map = window.VDEventLessonMap;
      if (!store || !map) return [];
      return store.getAll().filter(ev => {
        try { return map.mapEvent(ev).includes(lessonId); } catch (e) { return false; }
      });
    } catch (e) { return []; }
  }

  function examplesFor(lessonId) {
    const evs = _eventsForLesson(lessonId);
    const seen = new Set(); const coins = [];
    evs.forEach(ev => { const c = COIN(ev.sym); if (c && !seen.has(c)) { seen.add(c); coins.push(c); } });
    return { coins, events: evs.slice(0, 8).map(e => ({ sym: COIN(e.sym), ts: e.ts, msg: e.msg })), count: evs.length };
  }

  // ── ARCHIVE: son 30 gün public kayıtlar (tek sefer cache) ──
  let _archiveCache = null, _archivePromise = null;
  function loadArchive() {
    if (_archiveCache) return Promise.resolve(_archiveCache);
    if (_archivePromise) return _archivePromise;
    _archivePromise = (async () => {
      try {
        const DB = window.SupabaseDB;
        if (!DB || !DB.listArchive) { _archiveCache = []; return _archiveCache; }
        const sinceISO = new Date(Date.now() - 30 * 864e5).toISOString();
        const rows = await DB.listArchive({ sinceISO, limit: 100 });
        _archiveCache = Array.isArray(rows) ? rows : [];
      } catch (e) { _archiveCache = []; }
      return _archiveCache;
    })();
    return _archivePromise;
  }

  // ── ARCHIVE: derse eşleşen kayıtlardan outcome ──
  function outcomeFor(lesson) {
    if (!_archiveCache || !_archiveCache.length) return null;
    const res = _lessonRegexes(lesson.id);
    if (!res.length) return null;
    const matched = _archiveCache.filter(r => {
      const txt = String(r.analysis_summary || '') + ' ' + String(r.analysis_text || '');
      return res.some(re => re.test(txt));
    });
    const reviewed = matched.filter(r => r.review_status && WEIGHT[r.review_status] != null);
    if (reviewed.length < 3) return null;   // yetersiz veri → gösterme (uydurma yok)
    const validated = reviewed.filter(r => r.review_status === 'validated').length;
    const partial   = reviewed.filter(r => r.review_status === 'partially_validated').length;
    const rejected  = reviewed.filter(r => r.review_status === 'not_validated').length;
    const rate = Math.round(reviewed.reduce((a, r) => a + (WEIGHT[r.review_status] || 0), 0) / reviewed.length * 100);
    return { total: reviewed.length, validated, partial, rejected, rate };
  }

  // ── PHASE 10: Enrichment başarı oranları (archive-stats) → ders kartı ──
  // SALT OKUMA. /api/archive-stats çıktısındaki learning.* kırılımlarını derse bağlar.
  const STAT_MAP = {
    rsi:                { src: 'byStructure', keys: ['RSI Expansion', 'Aşırı Satım Tepkisi'] },
    momentum:           { src: 'byStructure', keys: ['Trend + Momentum'] },
    trend:              { src: 'byStructure', keys: ['Trend + Momentum'] },
    funding:            { src: 'byFunding' },
    atr:                { src: 'byVolatility' },
    'long-short-ratio': { src: 'byLongShort' },
    bollinger:          { src: 'byRegime' },
  };
  let _statsCache = null, _statsPromise = null;
  function loadStats() {
    if (_statsCache) return Promise.resolve(_statsCache);
    if (_statsPromise) return _statsPromise;
    _statsPromise = (async () => {
      try { const r = await fetch('/api/archive-stats'); const d = await r.json(); _statsCache = (d && d.ok) ? d : {}; }
      catch (e) { _statsCache = {}; }
      return _statsCache;
    })();
    return _statsPromise;
  }
  // ders → { state:'ok'|'insufficient'|'collecting'|null, label, rate, n }
  function conditionStatFor(lessonId) {
    const m = STAT_MAP[lessonId];
    if (!m || !_statsCache) return null;
    const L = _statsCache.learning || {};
    const arr = L[m.src] || [];
    const minS = L.minSample || 20;
    if (!arr.length) return { state: 'collecting' };
    if (m.keys) {
      const gs = arr.filter(g => m.keys.includes(g.key));
      if (!gs.length) return { state: 'collecting' };
      const total = gs.reduce((a, g) => a + (g.total || 0), 0);
      const success = gs.reduce((a, g) => a + (g.success || 0), 0);
      if (total < minS) return { state: 'insufficient', n: total };
      return { state: 'ok', label: m.keys[0], rate: total ? Math.round(success / total * 1000) / 10 : null, n: total };
    }
    const best = arr.find(g => !g.insufficient);
    if (!best) { const top = arr[0]; return { state: 'insufficient', n: top ? top.total : 0 }; }
    return { state: 'ok', label: best.key, rate: best.successRate, n: best.total };
  }

  window.VDAcademyBridge = { examplesFor, loadArchive, outcomeFor, _eventsForLesson, loadStats, conditionStatFor };
})();
