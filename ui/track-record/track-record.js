// ════════════════════════════════════════════════════════════════════
// ui/track-record/track-record.js  — AI Track Record Center
//
// Sistemin geçmiş performansını ŞEFFAF gösterir (başarılı + başarısız).
// Veri: mevcut Archive/Outcome (SupabaseDB.listArchive) — YENİ DB YOK.
// Setup/SMC kırılımı: window.VDInsights.computeInsights (archive ile aynı).
// Başarı tanımı: validated=1, partially_validated=.5, not_validated=0.
//
// Free   : yalnız genel başarı oranı (premium teaser).
// Premium: scorecard + en başarılı coin/tf/setup/SMC + şeffaflık listesi.
// Render-only. Scanner/Telegram/Premium kod/Dashboard motorlarına DOKUNMAZ.
// window.VDTrackRecord
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const WEIGHT = { validated: 1, partially_validated: 0.5, not_validated: 0 };
  const MIN_GROUP = 3;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const coinOf = (s) => (s ? String(s).replace(/USDT$|USDC$/i, '') : '—');

  let _days = 30, _cache = {};

  function _access() { try { if (window.VDAccess && window.VDAccess.level) return window.VDAccess.level(); } catch (e) {} return 'free'; }
  function _isPremium() { const a = _access(); return a === 'premium' || a === 'admin'; }
  const _reviewed = (r) => r && r.review_status && WEIGHT[r.review_status] != null;
  const _rate = (list) => list.length ? Math.round(list.reduce((a, r) => a + (WEIGHT[r.review_status] || 0), 0) / list.length * 100) : 0;

  function _bestWorst(records, key) {
    const g = {};
    records.forEach(r => { const k = r[key]; if (k == null || k === '') return; (g[k] = g[k] || []).push(r); });
    const arr = Object.keys(g).filter(k => g[k].length >= MIN_GROUP).map(k => ({ k, n: g[k].length, rate: _rate(g[k]) }));
    if (!arr.length) return { best: null, worst: null };
    arr.sort((a, b) => b.rate - a.rate || b.n - a.n);
    return { best: arr[0], worst: arr[arr.length - 1] };
  }

  async function _load(days) {
    if (_cache[days]) return _cache[days];
    try {
      const DB = window.SupabaseDB;
      if (!DB || !DB.listArchive) return (_cache[days] = []);
      const sinceISO = new Date(Date.now() - days * 864e5).toISOString();
      const rows = await DB.listArchive({ sinceISO, limit: 100 });
      _cache[days] = (Array.isArray(rows) ? rows : []).filter(_reviewed);
    } catch (e) { _cache[days] = []; }
    return _cache[days];
  }

  function _compute(rev) {
    const total = rev.length;
    const validated = rev.filter(r => r.review_status === 'validated').length;
    const partial   = rev.filter(r => r.review_status === 'partially_validated').length;
    const rejected  = rev.filter(r => r.review_status === 'not_validated').length;
    const overall = _rate(rev);
    const coin = _bestWorst(rev, 'sym');
    const tf = _bestWorst(rev, 'timeframe');
    let setup = null, smc = null;
    try {
      if (window.VDInsights && window.VDInsights.computeInsights) {
        const ins = window.VDInsights.computeInsights(rev);
        setup = (ins.combos && ins.combos[0]) || (ins.singles && ins.singles[0]) || null;
        smc = (ins.singles || []).find(r => /smc|bos|choch|order|fvg|sweep|liquid/i.test(r.key)) || null;
      }
    } catch (e) {}
    const recent = rev.slice(0, 12);
    return { total, validated, partial, rejected, overall, coin, tf, setup, smc, recent };
  }

  // ── UI parçaları ──
  function _statusChip(st) {
    const m = { validated:['✓ Doğrulandı','ok'], partially_validated:['~ Kısmi','warn'], not_validated:['✗ Başarısız','bad'] };
    const x = m[st] || ['—',''];
    return `<span class="tr-st tr-st-${x[1]}">${x[0]}</span>`;
  }
  function _kv(label, val, sub) {
    return `<div class="tr-kv"><div class="tr-kv-l">${esc(label)}</div><div class="tr-kv-v">${val}</div>${sub ? `<div class="tr-kv-s">${esc(sub)}</div>` : ''}</div>`;
  }

  function _render(s) {
    const host = document.getElementById('trBody'); if (!host) return;
    const premium = _isPremium();

    if (s.total < 1) {
      host.innerHTML = `<div class="tr-empty">Seçili dönemde incelenmiş analiz bulunamadı. Farklı bir zaman aralığı deneyin.</div>`;
      return;
    }

    // Genel başarı oranı (free + premium ortak)
    const gauge = `
      <div class="tr-gauge">
        <div class="tr-gauge-v">%${s.overall}</div>
        <div class="tr-gauge-l">Genel Başarı Oranı</div>
        <div class="tr-gauge-sub">${s.total} incelenmiş analiz · son ${_days} gün</div>
      </div>`;

    if (!premium) {
      host.innerHTML = `
        ${gauge}
        <div class="tr-lock">
          <div class="tr-lock-ic">🔒</div>
          <div class="tr-lock-tx">Doğrulanan / kısmi / başarısız kırılımı, <b>en başarılı coin · timeframe · setup · Smart Money yapıları</b> ve şeffaf analiz geçmişi <b>Premium</b> üyeler içindir.</div>
          <button class="tr-lock-btn" type="button" data-tr-premium>🚀 Premium'a Geç</button>
        </div>`;
      return;
    }

    // Scorecard (premium)
    const scorecard = `
      <div class="tr-score">
        <div class="tr-sc tr-sc-total"><div class="tr-sc-v">${s.total}</div><div class="tr-sc-l">Toplam Analiz</div></div>
        <div class="tr-sc ok"><div class="tr-sc-v">${s.validated}</div><div class="tr-sc-l">Doğrulandı</div></div>
        <div class="tr-sc warn"><div class="tr-sc-v">${s.partial}</div><div class="tr-sc-l">Kısmi</div></div>
        <div class="tr-sc bad"><div class="tr-sc-v">${s.rejected}</div><div class="tr-sc-l">Başarısız</div></div>
      </div>`;

    const cb = s.coin.best ? `${coinOf(s.coin.best.k)} · %${s.coin.best.rate}` : '—';
    const tb = s.tf.best ? `${esc(String(s.tf.best.k).toUpperCase())} · %${s.tf.best.rate}` : '—';
    const sb = s.setup ? `${esc(s.setup.label)} · %${s.setup.rate}` : 'Yeterli veri yok';
    const mb = s.smc ? `${esc(s.smc.label)} · %${s.smc.rate}` : (s.setup ? `${esc(s.setup.label)} · %${s.setup.rate}` : '—');

    const best = `
      <div class="tr-sec-ttl">🏆 En Başarılı</div>
      <div class="tr-best">
        ${_kv('En başarılı coin', cb, s.coin.best ? `${s.coin.best.n} analiz` : '')}
        ${_kv('En başarılı timeframe', tb, s.tf.best ? `${s.tf.best.n} analiz` : '')}
        ${_kv('En başarılı setup', sb, s.setup ? `${s.setup.n} örnek` : '')}
        ${_kv('Smart Money yapısı', mb, s.smc ? `${s.smc.n} örnek` : '')}
      </div>`;

    // Şeffaflık — en zayıf + son analizler (başarısızlar dahil)
    const worstCoin = s.coin.worst && s.coin.worst.k !== (s.coin.best && s.coin.best.k)
      ? `<div class="tr-trans-note">⚖️ Şeffaflık: en düşük coin <b>${coinOf(s.coin.worst.k)} · %${s.coin.worst.rate}</b> (${s.coin.worst.n} analiz)</div>` : '';
    const recent = `
      <div class="tr-sec-ttl">📋 Son Analizler <span class="tr-sec-sub">(başarılı + başarısız, şeffaf)</span></div>
      ${worstCoin}
      <div class="tr-recent">
        ${s.recent.map(r => `
          <div class="tr-row">
            <span class="tr-row-coin">${esc(coinOf(r.sym))}</span>
            <span class="tr-row-tf">${esc(String(r.timeframe || '').toUpperCase())}</span>
            <span class="tr-row-sum">${esc((r.analysis_summary || r.direction_bias || '').toString().slice(0, 60))}</span>
            ${_statusChip(r.review_status)}
          </div>`).join('')}
      </div>`;

    host.innerHTML = gauge + scorecard + best + recent;
  }

  function _renderFilters() {
    const w = document.getElementById('trFilters'); if (!w) return;
    const opt = (d, lbl) => `<button class="tr-filter${_days === d ? ' active' : ''}" data-days="${d}" type="button">${lbl}</button>`;
    w.innerHTML = opt(7, 'Son 7 gün') + opt(30, 'Son 30 gün') + opt(90, 'Son 90 gün');
  }

  async function _refresh() {
    const host = document.getElementById('trBody');
    if (host) host.innerHTML = '<div class="tr-empty">Yükleniyor…</div>';
    const rev = await _load(_days);
    _render(_compute(rev));
  }

  function _wire() {
    document.getElementById('trFilters')?.addEventListener('click', e => {
      const b = e.target.closest('.tr-filter'); if (!b) return;
      _days = +b.dataset.days; _renderFilters(); _refresh();
    });
    document.getElementById('trBody')?.addEventListener('click', e => {
      if (e.target.closest('[data-tr-premium]')) {
        if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
        else location.href = 'index.html#premium';
      }
    });
    window.addEventListener('vd:access:changed', _refresh);
  }

  function init() {
    const lvl = document.getElementById('trAccess');
    if (lvl) { const a = _access(); const m = { admin:'◈ Admin', premium:'◈ Premium', teaser:'◈ Önizleme', free:'◈ Free' }; lvl.textContent = m[a] || m.free; lvl.className = 'tr-access tr-access-' + a; }
    _renderFilters(); _wire(); _refresh();
  }

  // Academy entegrasyonu: bir ders/yapı için tek satır geçmiş başarı (opsiyonel kullanım)
  async function rateForLesson(lesson) {
    try { return window.VDAcademyBridge ? window.VDAcademyBridge.outcomeFor(lesson) : null; } catch (e) { return null; }
  }

  window.VDTrackRecord = { init, _refresh, rateForLesson };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
