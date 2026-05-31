// ════════════════════════════════════════════════════════════════════
// ui/archive/archive-insights.js
// OUTCOME FAZ 4 — AI Learning Insights (İSTATİSTİKSEL ÖĞRENME, ML/AI API YOK)
//
// Motor (window.VDInsights) + admin kartı AYNI dosyada → kart render oluyorsa
// motor da kesinlikle yüklüdür (ayrı dosya/yeni-klasör deploy riski yok).
// Salt-okunur; DB yazma/yeni endpoint/maliyet yok.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const TAG = '[Insights]';

  // ─────────────────────────────────────────────────────────────
  // 1) İSTATİSTİK MOTORU — window.VDInsights (zaten varsa yeniden tanımlama)
  // ─────────────────────────────────────────────────────────────
  if (!window.VDInsights) {
    const MIN_SAMPLE = 5;
    const NOTE_MIN_SAMPLE = 5;
    const WEIGHT = { validated: 1, partially_validated: 0.5, not_validated: 0 };
    let _cache = null, _loading = null, _error = null;

    const _num = (v) => { const n = Number(v); return isNaN(n) ? null : n; };

    function _band(score) {
      const s = _num(score);
      if (s == null) return null;
      if (s >= 85) return 'conf:>85';
      if (s >= 70) return 'conf:70-85';
      return 'conf:<70';
    }
    function _mcFeatures(mc) {
      const out = [];
      try {
        if (!mc || typeof mc !== 'object') return out;
        let risk = mc.risk != null ? mc.risk : (mc.riskLevel != null ? mc.riskLevel : null);
        if (risk != null) {
          const rn = _num(risk); let lvl = null;
          if (rn != null) lvl = rn >= 70 ? 'high' : rn >= 40 ? 'med' : 'low';
          else { const rs = String(risk).toLowerCase(); if (/high|yüksek/.test(rs)) lvl = 'high'; else if (/med|orta/.test(rs)) lvl = 'med'; else if (/low|düşük/.test(rs)) lvl = 'low'; }
          if (lvl) out.push('risk:' + lvl);
        }
        if (mc.regime) out.push('regime:' + String(mc.regime).toLowerCase().slice(0, 16));
        const blob = JSON.stringify([mc.concepts, mc.tags, mc.smc, mc.note, mc.msg]).toLowerCase();
        if (/smart money|order block|\bfvg\b|akıllı para|kurumsal/.test(blob)) out.push('smart:yes');
        if (/likidite|liquidity|sweep|süpürme/.test(blob)) out.push('liq:yes');
      } catch (e) { /* bozuk market_context → yoksay */ }
      return out;
    }
    function _features(rec) {
      const f = [];
      try {
        if (rec.direction_bias) f.push('bias:' + rec.direction_bias);
        const b = _band(rec.analysis_score); if (b) f.push(b);
        if (rec.timeframe) f.push('tf:' + String(rec.timeframe).toLowerCase());
        _mcFeatures(rec.market_context).forEach(t => f.push(t));
      } catch (e) {}
      return f;
    }
    function _label(tok) {
      const [k, v] = String(tok).split(':');
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
    const _isReviewed = (r) => r && r.review_status && WEIGHT[r.review_status] != null;
    function _rate(list) {
      if (!list.length) return 0;
      const w = list.reduce((a, r) => a + (WEIGHT[r.review_status] || 0), 0);
      return Math.round(w / list.length * 100);
    }
    function _pairs(tokens) {
      const out = [];
      for (let i = 0; i < tokens.length; i++)
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[i].split(':')[0] === tokens[j].split(':')[0]) continue;
          out.push([tokens[i], tokens[j]].sort().join(' & '));
        }
      return out;
    }
    function computeInsights(records) {
      const rev = (records || []).filter(_isReviewed);
      const map = new Map();
      const bump = (k, r) => { if (!map.has(k)) map.set(k, []); map.get(k).push(r); };
      rev.forEach(rec => {
        const toks = _features(rec);
        toks.forEach(t => bump(t, rec));
        _pairs(toks).forEach(p => bump(p, rec));
      });
      const rows = [];
      map.forEach((list, key) => {
        if (list.length < MIN_SAMPLE) return;
        rows.push({
          key, label: key.split(' & ').map(_label).join(' + '), n: list.length,
          validated: list.filter(r => r.review_status === 'validated').length,
          partial: list.filter(r => r.review_status === 'partially_validated').length,
          rejected: list.filter(r => r.review_status === 'not_validated').length,
          rate: _rate(list),
        });
      });
      rows.sort((a, b) => b.rate - a.rate || b.n - a.n);
      return { total: rev.length, rows, combos: rows.filter(r => r.key.includes(' & ')), singles: rows.filter(r => !r.key.includes(' & ')) };
    }
    function noteForSync(rec) {
      try {
        const rev = (_cache || []).filter(_isReviewed).filter(r => r.id !== rec.id);
        if (!rev.length) return null;
        const bias = rec.direction_bias, band = _band(rec.analysis_score);
        let similar = rev.filter(r => r.direction_bias === bias && _band(r.analysis_score) === band && band);
        let labelParts = [_label('bias:' + bias)]; if (band) labelParts.push(_label(band));
        if (similar.length < NOTE_MIN_SAMPLE) { similar = rev.filter(r => r.direction_bias === bias); labelParts = [_label('bias:' + bias)]; }
        if (similar.length < NOTE_MIN_SAMPLE) return null;
        return `Bu setup (${labelParts.join(' + ')}) son ${similar.length} benzer analizde %${_rate(similar)} doğrulama oranı göstermiştir.`;
      } catch (e) { console.warn(TAG, 'noteForSync hata:', e); return null; }
    }
    async function load(force) {
      if (_cache && !force) return _cache;
      if (_loading) return _loading;
      _error = null;
      _loading = (async () => {
        try {
          const db = window.SupabaseDB;
          if (!db || typeof db.listArchive !== 'function') { _error = 'no_db'; console.warn(TAG, 'SupabaseDB.listArchive yok'); _cache = []; return _cache; }
          const rows = await db.listArchive({ limit: 100 });
          _cache = Array.isArray(rows) ? rows.filter(_isReviewed) : [];
        } catch (e) { _error = 'fetch'; console.error(TAG, 'Arşiv verisi alınamadı:', e); _cache = []; }
        _loading = null;
        return _cache;
      })();
      return _loading;
    }
    window.VDInsights = {
      load, computeInsights, noteForSync,
      getRecords: () => _cache || [], getError: () => _error,
      _features, MIN_SAMPLE,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2) ADMIN KARTI — VDArchive.Insights
  // ─────────────────────────────────────────────────────────────
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = () => NS.util || {};
  const esc = (s) => (U().esc ? U().esc(s) : String(s == null ? '' : s));
  const CID = 'aic-insights';
  const ENGINE = window.VDInsights;

  // PREMIUM + ADMIN görür (Free/Visitor/Teaser görmez). VDAccess.isPremium() = premium||admin.
  function _canView() {
    try {
      if (window.VDAccess && typeof window.VDAccess.isPremium === 'function') return window.VDAccess.isPremium();
    } catch (e) {}
    // Defensive fallback (VDAccess yoksa): aap_access_v1 admin veya geçerli premium
    try {
      const raw = localStorage.getItem('aap_access_v1');
      if (raw) { const d = JSON.parse(raw); if (d && (d.isAdmin === true || (typeof d.bitis === 'number' && d.bitis > Date.now()))) return true; }
    } catch (e) {}
    return false;
  }
  const _rateClass = (r) => (r >= 70 ? 'hi' : r >= 50 ? 'mid' : 'lo');
  function _rowHTML(r) {
    return `
      <div class="aic-ins-row">
        <div class="aic-ins-top">
          <span class="aic-ins-label">${esc(r.label)}</span>
          <span class="aic-ins-rate aic-ins-${_rateClass(r.rate)}">%${r.rate}</span>
        </div>
        <div class="aic-ins-bar"><span class="aic-ins-fill aic-ins-${_rateClass(r.rate)}" style="width:${Math.max(3, r.rate)}%"></span></div>
        <div class="aic-ins-meta">${r.n} örnek · ✓${r.validated} doğrulandı · ~${r.partial} kısmi · ✗${r.rejected} doğrulanmadı</div>
      </div>`;
  }
  function _card(inner) {
    return `<div class="aic-ins-card"><div class="aic-ins-hdr">🧠 AI Learning Insights <span class="aic-ins-tag">premium · istatistiksel</span></div>${inner}</div>`;
  }
  function _msg(t) { return `<div class="aic-ins-empty">${esc(t)}</div>`; }

  function _render(host, data, loadError) {
    const MIN = (ENGINE && ENGINE.MIN_SAMPLE) || 5;
    if (loadError === 'fetch') { host.innerHTML = _card(_msg('Arşiv verisi şu an alınamadı. Bağlantı düzelince otomatik denenecek; sayfayı yenileyebilirsiniz.')); return; }
    if (loadError === 'no_db') { host.innerHTML = _card(_msg('Veri kaynağı yüklenmedi. Sayfayı yenileyin.')); return; }
    const total = (data && data.total) || 0;
    if (total < MIN) { host.innerHTML = _card(_msg(`Öğrenme için en az ${MIN} incelenmiş kayıt gerekli (şu an ${total}). Sonuç hesapladıkça öğrenme başlayacak.`)); return; }
    const pool = (data.combos && data.combos.length >= 3) ? data.combos : data.rows;
    if (!pool.length) { host.innerHTML = _card(`<div class="aic-ins-sub">Son ${total} incelenmiş analiz</div>${_msg('Henüz yeterli örnekli kombinasyon yok (her örüntü için en az ' + MIN + ' örnek gerekir). Daha fazla sonuç hesaplandıkça görünecek.')}`); return; }
    const strong = pool.slice(0, 6);
    const weak = pool.slice().sort((a, b) => a.rate - b.rate).filter(r => !strong.slice(0, 4).some(s => s.key === r.key)).slice(0, 2);
    host.innerHTML = _card(`
      <div class="aic-ins-sub">Son ${total} incelenmiş analiz · doğrulama oranı = (doğrulandı + ½·kısmi) ÷ toplam</div>
      <div class="aic-ins-secttl">En güçlü setup'lar</div>
      ${strong.map(_rowHTML).join('')}
      ${weak.length ? `<div class="aic-ins-secttl">Dikkat edilecek (düşük oran)</div>${weak.map(_rowHTML).join('')}` : ''}
      <div class="aic-ins-note">⚠ Retrospektif istatistiktir; geçmiş analizlerin tutarlılığını gösterir, gelecek getiri/başarı garantisi değildir.</div>`);
  }

  async function mount() {
    const host = document.getElementById(CID);
    if (!host) return;
    if (!_canView()) { host.hidden = true; return; }
    host.hidden = false;
    if (!ENGINE || typeof ENGINE.load !== 'function') {
      console.error(TAG, 'Öğrenme motoru (VDInsights) bulunamadı — kart devre dışı.');
      host.innerHTML = _card(_msg('Öğrenme modülü yüklenemedi. Sayfayı yenileyin; sorun sürerse dağıtımı kontrol edin.'));
      return;
    }
    host.innerHTML = _card(_msg('Yükleniyor…'));
    let recs = [];
    try { recs = await ENGINE.load(); }
    catch (e) { console.error(TAG, 'load() beklenmeyen hata:', e); }
    let data = { total: 0, rows: [], combos: [] };
    try { data = ENGINE.computeInsights(recs); }
    catch (e) { console.error(TAG, 'computeInsights hata:', e); host.innerHTML = _card(_msg('İçgörüler hesaplanırken sorun oluştu (konsola bakın).')); return; }
    try { _render(host, data, ENGINE.getError && ENGINE.getError()); }
    catch (e) { console.error(TAG, 'render hata:', e); host.innerHTML = _card(_msg('İçgörüler gösterilemedi (konsola bakın).')); }
  }
  function refresh() { return mount(); }

  NS.Insights = { mount, refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.addEventListener('vd:archive:reviewed', () => { try { ENGINE && ENGINE.load(true).then(refresh); } catch (e) {} });
})();
