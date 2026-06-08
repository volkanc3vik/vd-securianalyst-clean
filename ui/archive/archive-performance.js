// ════════════════════════════════════════════════════════════════════
// ui/archive/archive-performance.js
// PERFORMANCE DASHBOARD FAZ 1 — admin-only performans özeti
// Salt-okunur; mevcut Archive verisini (VDInsights paylaşılan cache) kullanır.
// DB yazma/yeni endpoint/AI API yok. VDArchive.Perf
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const TAG = '[Perf]';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = () => NS.util || {};
  const esc = (s) => (U().esc ? U().esc(s) : String(s == null ? '' : s));
  const CID = 'aic-performance';
  const MIN_TOTAL = 5;     // kart için min incelenmiş kayıt
  const MIN_GROUP = 3;     // coin/timeframe sıralaması için min örnek
  const WEIGHT = { validated: 1, partially_validated: 0.5, not_validated: 0 };

  // PREMIUM + ADMIN görür (Free/Visitor/Teaser görmez). VDAccess.isPremium() = premium||admin.
  function _canView() {
    try {
      if (window.VDAccess && typeof window.VDAccess.isPremium === 'function') return window.VDAccess.isPremium();
    } catch (e) {}
    try {
      const raw = localStorage.getItem('aap_access_v1');
      if (raw) { const d = JSON.parse(raw); if (d && (d.isAdmin === true || (typeof d.bitis === 'number' && d.bitis > Date.now()))) return true; }
    } catch (e) {}
    return false;
  }
  const _num = (v) => { const n = Number(v); return isNaN(n) ? null : n; };
  const _isReviewed = (r) => r && r.review_status && WEIGHT[r.review_status] != null && !r.excluded_from_learning;
  function _rate(list) {
    if (!list.length) return 0;
    return Math.round(list.reduce((a, r) => a + (WEIGHT[r.review_status] || 0), 0) / list.length * 100);
  }
  const _coin = (s) => (s ? String(s).replace('USDT', '') : '—');
  const _rateClass = (r) => (r >= 70 ? 'hi' : r >= 50 ? 'mid' : 'lo');

  // En iyi / en zayıf grup (sym ya da timeframe) — min örnekli gruplar arasında
  function _bestWorst(records, key) {
    const map = new Map();
    records.forEach(r => {
      const k = r[key]; if (!k) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    const groups = [];
    map.forEach((list, k) => { if (list.length >= MIN_GROUP) groups.push({ k, n: list.length, rate: _rate(list) }); });
    if (!groups.length) return { best: null, worst: null };
    groups.sort((a, b) => b.rate - a.rate || b.n - a.n);
    return { best: groups[0], worst: groups[groups.length - 1] };
  }

  function _summary(records) {
    const rev = (records || []).filter(_isReviewed);
    const total = rev.length;
    const validated = rev.filter(r => r.review_status === 'validated').length;
    const partial = rev.filter(r => r.review_status === 'partially_validated').length;
    const rejected = rev.filter(r => r.review_status === 'not_validated').length;
    const overall = _rate(rev);
    const scored = rev.map(r => _num(r.validation_score)).filter(v => v != null);
    const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
    const coin = _bestWorst(rev, 'sym');
    const tf = _bestWorst(rev, 'timeframe');
    // en başarılı setup kombinasyonu — VDInsights combo (varsa)
    let bestCombo = null;
    try {
      if (window.VDInsights && typeof window.VDInsights.computeInsights === 'function') {
        const ins = window.VDInsights.computeInsights(rev);
        bestCombo = (ins.combos && ins.combos[0]) || (ins.rows && ins.rows[0]) || null;
      }
    } catch (e) { console.warn(TAG, 'combo hesabı atlandı:', e); }
    return { total, validated, partial, rejected, overall, avgScore, coin, tf, bestCombo };
  }

  // ── Render parçaları ──
  function _card(inner) {
    return `<div class="aic-perf-card"><div class="aic-perf-hdr">📈 Performans Özeti <span class="aic-perf-tag">premium</span></div>${inner}</div>`;
  }
  const _empty = (t) => `<div class="aic-perf-empty">${esc(t)}</div>`;
  function _tile(label, value, cls) {
    return `<div class="aic-perf-tile ${cls || ''}"><div class="aic-perf-tval">${esc(value)}</div><div class="aic-perf-tlbl">${esc(label)}</div></div>`;
  }
  function _kv(label, value, sub, cls) {
    return `<div class="aic-perf-row">
      <span class="aic-perf-k">${esc(label)}</span>
      <span class="aic-perf-v ${cls || ''}">${esc(value)}${sub ? ` <small>${esc(sub)}</small>` : ''}</span>
    </div>`;
  }

  function _render(host, s) {
    if (s.total < MIN_TOTAL) {
      host.innerHTML = _card(_empty(`Yeterli veri yok. Performans özeti için en az ${MIN_TOTAL} incelenmiş analiz gerekli (şu an ${s.total}).`));
      return;
    }
    const coinBest = s.coin.best ? `${_coin(s.coin.best.k)} · %${s.coin.best.rate}` : '—';
    const coinBestSub = s.coin.best ? `${s.coin.best.n} analiz` : '';
    const coinWorst = s.coin.worst ? `${_coin(s.coin.worst.k)} · %${s.coin.worst.rate}` : '—';
    const coinWorstSub = s.coin.worst ? `${s.coin.worst.n} analiz` : '';
    const tfBest = s.tf.best ? `${s.tf.best.k} · %${s.tf.best.rate}` : '—';
    const tfBestSub = s.tf.best ? `${s.tf.best.n} analiz` : '';
    const combo = s.bestCombo ? `${s.bestCombo.label} · %${s.bestCombo.rate}` : '—';
    const comboSub = s.bestCombo ? `${s.bestCombo.n} örnek` : 'yeterli örnekli kombinasyon yok';

    host.innerHTML = _card(`
      <div class="aic-perf-tiles">
        ${_tile('Toplam İncelenen', s.total, 'tot')}
        ${_tile('Doğrulandı', s.validated, 'ok')}
        ${_tile('Kısmi', s.partial, 'mid')}
        ${_tile('Doğrulanmadı', s.rejected, 'no')}
      </div>
      <div class="aic-perf-big">
        <div class="aic-perf-bigitem">
          <div class="aic-perf-bigval aic-perf-${_rateClass(s.overall)}">%${s.overall}</div>
          <div class="aic-perf-biglbl">Genel doğrulama oranı</div>
        </div>
        <div class="aic-perf-bigitem">
          <div class="aic-perf-bigval">${s.avgScore != null ? s.avgScore + '<small>/100</small>' : '—'}</div>
          <div class="aic-perf-biglbl">Ort. validation score</div>
        </div>
      </div>
      <div class="aic-perf-rows">
        ${_kv('En başarılı coin', coinBest, coinBestSub, s.coin.best ? 'aic-perf-' + _rateClass(s.coin.best.rate) : '')}
        ${_kv('En zayıf coin', coinWorst, coinWorstSub, s.coin.worst ? 'aic-perf-' + _rateClass(s.coin.worst.rate) : '')}
        ${_kv('En başarılı timeframe', tfBest, tfBestSub, s.tf.best ? 'aic-perf-' + _rateClass(s.tf.best.rate) : '')}
        ${_kv('En başarılı setup', combo, comboSub, s.bestCombo ? 'aic-perf-' + _rateClass(s.bestCombo.rate) : '')}
      </div>
      <div class="aic-perf-note">⚠ Retrospektif performans özeti; geçmiş analizlerin tutarlılığını gösterir, gelecek getiri/başarı garantisi değildir. Doğrulama oranı = (doğrulandı + ½·kısmi) ÷ toplam.</div>`);
  }

  async function _loadRecords() {
    // Paylaşılan VDInsights cache'ini kullan; yoksa doğrudan SupabaseDB
    try {
      if (window.VDInsights && typeof window.VDInsights.load === 'function') {
        const _cached = await window.VDInsights.load();
        return Array.isArray(_cached) ? _cached.filter(_isReviewed) : _cached;
      }
    } catch (e) { console.warn(TAG, 'VDInsights.load hata, fallback:', e); }
    try {
      const db = window.SupabaseDB;
      if (db && typeof db.listArchive === 'function') {
        const rows = await db.listArchive({ limit: 100 });
        return Array.isArray(rows) ? rows.filter(_isReviewed) : [];
      }
    } catch (e) { console.error(TAG, 'Arşiv verisi alınamadı:', e); }
    return null; // veri kaynağı yok
  }

  async function mount() {
    const host = document.getElementById(CID);
    if (!host) return;
    if (!_canView()) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = _card(_empty('Yükleniyor…'));
    let recs = null;
    try { recs = await _loadRecords(); }
    catch (e) { console.error(TAG, 'yükleme hatası:', e); }
    if (recs == null) { host.innerHTML = _card(_empty('Arşiv verisi şu an alınamadı. Sayfayı yenileyebilirsiniz.')); return; }
    try { _render(host, _summary(recs)); }
    catch (e) { console.error(TAG, 'render hatası:', e); host.innerHTML = _card(_empty('Performans özeti gösterilemedi (konsola bakın).')); }
  }
  function refresh() { return mount(); }

  NS.Perf = { mount, refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.addEventListener('vd:archive:reviewed', () => {
    try { if (window.VDInsights && window.VDInsights.load) window.VDInsights.load(true).then(refresh); else refresh(); } catch (e) {}
  });
})();
