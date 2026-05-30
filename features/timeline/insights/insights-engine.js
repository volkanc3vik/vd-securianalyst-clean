// ════════════════════════════════════════════════════════════════════
// features/insights/insights-engine.js
// OUTCOME FAZ 4 — İSTATİSTİKSEL ÖĞRENME (ML/AI API YOK)
//
// Archive'daki İNCELENMİŞ kayıtlardan (validated/partial/not_validated)
// hangi özellik kombinasyonlarının daha yüksek doğrulama oranı verdiğini
// SALT-OKUNUR istatistikle çıkarır. Yeni endpoint/DB yazma/maliyet yok.
//
// window.VDInsights = { load, getRecords, computeInsights, noteForSync, _features }
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDInsights) return;

  const MIN_SAMPLE = 5;            // bir kombinasyonun gösterilmesi için min örnek
  const NOTE_MIN_SAMPLE = 5;       // Internal Review notu için min benzer örnek
  const WEIGHT = { validated: 1, partially_validated: 0.5, not_validated: 0 };

  let _cache = null;               // çekilen incelenmiş kayıtlar
  let _loading = null;

  function _num(v) { const n = Number(v); return isNaN(n) ? null : n; }

  // Confidence bandı (analysis_score)
  function _band(score) {
    const s = _num(score);
    if (s == null) return null;
    if (s >= 85) return 'conf:>85';
    if (s >= 70) return 'conf:70-85';
    return 'conf:<70';
  }

  // market_context'ten güvenli özellik çıkarımı (varsa)
  function _mcFeatures(mc) {
    const out = [];
    if (!mc || typeof mc !== 'object') return out;
    // risk
    let risk = mc.risk != null ? mc.risk : (mc.riskLevel != null ? mc.riskLevel : null);
    if (risk != null) {
      const rn = _num(risk);
      let lvl = null;
      if (rn != null) lvl = rn >= 70 ? 'high' : rn >= 40 ? 'med' : 'low';
      else { const rs = String(risk).toLowerCase(); if (/high|yüksek/.test(rs)) lvl = 'high'; else if (/med|orta/.test(rs)) lvl = 'med'; else if (/low|düşük/.test(rs)) lvl = 'low'; }
      if (lvl) out.push('risk:' + lvl);
    }
    // regime
    if (mc.regime) out.push('regime:' + String(mc.regime).toLowerCase().slice(0, 16));
    // smart money / likidite (concepts dizisi ya da metin)
    const blob = JSON.stringify([mc.concepts, mc.tags, mc.smc, mc.note, mc.msg]).toLowerCase();
    if (/smart money|order block|\bfvg\b|akıllı para|kurumsal/.test(blob)) out.push('smart:yes');
    if (/likidite|liquidity|sweep|süpürme/.test(blob)) out.push('liq:yes');
    return out;
  }

  // Bir kayıttan özellik token'ları
  function _features(rec) {
    const f = [];
    if (rec.direction_bias) f.push('bias:' + rec.direction_bias);
    const b = _band(rec.analysis_score); if (b) f.push(b);
    if (rec.timeframe) f.push('tf:' + String(rec.timeframe).toLowerCase());
    _mcFeatures(rec.market_context).forEach(t => f.push(t));
    return f;
  }

  // Token → okunabilir etiket
  function _label(tok) {
    const [k, v] = tok.split(':');
    switch (k) {
      case 'bias': return v === 'bullish' ? 'Bullish' : v === 'bearish' ? 'Bearish' : 'Nötr';
      case 'conf': return 'Confidence ' + v;
      case 'tf': return v;
      case 'risk': return 'Risk ' + (v === 'high' ? 'High' : v === 'med' ? 'Orta' : 'Low');
      case 'regime': return 'Rejim: ' + v;
      case 'smart': return 'Smart Money';
      case 'liq': return 'Likidite Sweep';
      default: return tok;
    }
  }

  function _isReviewed(r) {
    return r && r.review_status && WEIGHT[r.review_status] != null;
  }

  function _rate(list) {
    if (!list.length) return 0;
    const w = list.reduce((a, r) => a + (WEIGHT[r.review_status] || 0), 0);
    return Math.round(w / list.length * 100);
  }

  // 2'li kombinasyonlar (farklı boyutlardan) üret
  function _pairs(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++)
      for (let j = i + 1; j < tokens.length; j++) {
        const a = tokens[i].split(':')[0], b = tokens[j].split(':')[0];
        if (a === b) continue; // aynı boyut (ör. iki bias) atlanır
        out.push([tokens[i], tokens[j]].sort().join(' & '));
      }
    return out;
  }

  // ── Ana hesap: kombinasyon → {n, validated, partial, rejected, rate} ──
  function computeInsights(records) {
    const rev = (records || []).filter(_isReviewed);
    const map = new Map(); // comboKey → {records:[]}
    const bump = (key, rec) => { if (!map.has(key)) map.set(key, []); map.get(key).push(rec); };

    rev.forEach(rec => {
      const toks = _features(rec);
      toks.forEach(t => bump(t, rec));        // tekli
      _pairs(toks).forEach(p => bump(p, rec)); // ikili
    });

    const rows = [];
    map.forEach((list, key) => {
      if (list.length < MIN_SAMPLE) return;
      const validated = list.filter(r => r.review_status === 'validated').length;
      const partial = list.filter(r => r.review_status === 'partially_validated').length;
      const rejected = list.filter(r => r.review_status === 'not_validated').length;
      const label = key.split(' & ').map(_label).join(' + ');
      rows.push({ key, label, n: list.length, validated, partial, rejected, rate: _rate(list) });
    });

    rows.sort((a, b) => b.rate - a.rate || b.n - a.n);
    // tekli olanları ayrı, kombinasyonları öne çıkar (bilgi değeri yüksek)
    const combos = rows.filter(r => r.key.includes(' & '));
    const singles = rows.filter(r => !r.key.includes(' & '));
    return { total: rev.length, rows, combos, singles };
  }

  // ── Internal Review için tarihsel not (mevcut kayda benzer geçmiş) ──
  function noteForSync(rec) {
    try {
      const rev = (_cache || []).filter(_isReviewed).filter(r => r.id !== rec.id);
      if (!rev.length) return null;
      const bias = rec.direction_bias;
      const band = _band(rec.analysis_score);
      // 1) bias + band benzerleri
      let similar = rev.filter(r => r.direction_bias === bias && _band(r.analysis_score) === band && band);
      let labelParts = [_label('bias:' + bias)];
      if (band) labelParts.push(_label(band));
      // yeterli değilse yalnız bias
      if (similar.length < NOTE_MIN_SAMPLE) { similar = rev.filter(r => r.direction_bias === bias); labelParts = [_label('bias:' + bias)]; }
      if (similar.length < NOTE_MIN_SAMPLE) return null;
      const rate = _rate(similar);
      return `Bu setup (${labelParts.join(' + ')}) son ${similar.length} benzer analizde %${rate} doğrulama oranı göstermiştir.`;
    } catch (e) { return null; }
  }

  // ── Veri yükleme (anon listArchive; yalnız incelenmiş kayıtlar döner) ──
  async function load(force) {
    if (_cache && !force) return _cache;
    if (_loading) return _loading;
    _loading = (async () => {
      try {
        const db = window.SupabaseDB;
        if (!db || typeof db.listArchive !== 'function') { _cache = []; return _cache; }
        const rows = await db.listArchive({ limit: 100 });
        _cache = Array.isArray(rows) ? rows.filter(_isReviewed) : [];
      } catch (e) { _cache = []; }
      _loading = null;
      return _cache;
    })();
    return _loading;
  }

  function getRecords() { return _cache || []; }

  window.VDInsights = { load, getRecords, computeInsights, noteForSync, _features, MIN_SAMPLE };
})();
