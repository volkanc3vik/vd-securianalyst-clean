// ════════════════════════════════════════════════════════════════════
// AGREEMENT MATRIX — Faz 3 · Research Engine V2 (ADMIN, salt-okunur)
//
// "Hangi taraf daha doğru?" sorusunun ekranı:
//   1) TARAF KARŞILAŞTIRMASI: Price vs Derivative vs Hybrid — CONFIRMED
//      verdict'lerinin doğrulanma oranı yan yana (manşet cevap).
//   2) 3×4 MATRİS: Price verdict × Deriv verdict (NA dahil) hücreleri —
//      her hücrede doğrulanma %, örnek sayısı, ort. MFE/MAE, kurtulan sayısı.
//   3) FAKTÖR ETKİNLİĞİ: Funding/OI/Positioning/Liq — "varken vs yokken"
//      doğrulanma oranları (Faz 5 sorularının ham cevabı).
//
// Veri: /api/analysis-archive action:'hybrid_matrix' (sunucu agregasyonu,
// research_period filtreli). Yalnız admin oturumunda mount edilir.
// n<5 hücreler "yetersiz örnek" — erken dönem yanıltmasın.
//
// Public API: window.VDAgreementMatrix.mount() / .unmount() / .refresh()
// ════════════════════════════════════════════════════════════════════
window.VDAgreementMatrix = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const PANEL_ID = 'vdAgreementMatrix';
  const MIN_N = 5;                       // bu altı örnek → oran gösterme
  let _mounted = false;
  let _data = null;
  let _loading = false;

  function _isAdmin() {
    try { return !!(window.TelegramDispatcher && window.TelegramDispatcher.hasAdminKey && window.TelegramDispatcher.hasAdminKey()); }
    catch (e) { return false; }
  }

  function _rateCls(rate, n) {
    if (n < MIN_N || rate == null) return 'na';
    if (rate >= 60) return 'good';
    if (rate >= 40) return 'mid';
    return 'bad';
  }
  function _rateTxt(c) {
    if (!c || c.n < MIN_N) return '—';
    if (c.confirmRate == null) return '—';
    return '%' + c.confirmRate;
  }

  function _vLabel(v) {
    return v === 'CONFIRMED' ? _t('am.conf', null, 'Confirmed')
         : v === 'ARMED' ? _t('am.armed', null, 'Armed')
         : v === 'WATCH' ? _t('am.watch', null, 'Watch')
         : _t('am.na', null, 'Deriv yok');
  }

  // ── 1) Taraf karşılaştırma şeridi ──────────────────────────────────
  function _sidesHtml(sides) {
    const defs = [
      ['price', _t('am.sidePrice', null, 'Price Intelligence')],
      ['deriv', _t('am.sideDeriv', null, 'Derivative Intelligence')],
      ['hybrid', _t('am.sideHybrid', null, 'Final Hybrid')],
    ];
    return '<div class="vd-am-sides">' + defs.map(function (d) {
      const c = sides && sides[d[0]] ? sides[d[0]].CONFIRMED : null;
      const cls = c ? _rateCls(c.confirmRate, c.n) : 'na';
      return '<div class="vd-am-side ' + (d[0] === 'hybrid' ? 'vd-am-side-h' : '') + '">' +
        '<div class="vd-am-side-t">' + d[1] + '</div>' +
        '<div class="vd-am-side-r ' + cls + '">' + _rateTxt(c) + '</div>' +
        '<div class="vd-am-side-s">' + _t('am.confRateOf', null, 'CONFIRMED doğrulanma') + ' · n=' + (c ? c.resolved : 0) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ── 2) 3×4 matris ───────────────────────────────────────────────────
  function _matrixHtml(matrix) {
    const P = ['CONFIRMED', 'ARMED', 'WATCH'];
    const D = ['CONFIRMED', 'ARMED', 'WATCH', 'NA'];
    let h = '<div class="vd-am-grid" style="grid-template-columns:110px repeat(' + D.length + ',1fr)">';
    h += '<div class="vd-am-corner">' + _t('am.priceVsDeriv', null, 'Price ↓ · Deriv →') + '</div>';
    D.forEach(function (d) { h += '<div class="vd-am-colh">' + _vLabel(d) + '</div>'; });
    P.forEach(function (p) {
      h += '<div class="vd-am-rowh">' + _vLabel(p) + '</div>';
      D.forEach(function (d) {
        const c = matrix && matrix[p] ? matrix[p][d] : null;
        const cls = c ? _rateCls(c.confirmRate, c.n) : 'na';
        if (!c || c.n === 0) {
          h += '<div class="vd-am-cell na"><div class="vd-am-cr">—</div><div class="vd-am-cn">' + _t('am.noData', null, 'kayıt yok') + '</div></div>';
        } else if (c.n < MIN_N) {
          h += '<div class="vd-am-cell na"><div class="vd-am-cr">…</div><div class="vd-am-cn">n=' + c.n + ' · ' + _t('am.lowN', null, 'yetersiz örnek') + '</div></div>';
        } else {
          h += '<div class="vd-am-cell ' + cls + '">' +
            '<div class="vd-am-cr">' + _rateTxt(c) + '</div>' +
            '<div class="vd-am-cn">n=' + c.resolved + (c.recovered ? ' · ↺' + c.recovered : '') + '</div>' +
            '<div class="vd-am-cm">MFE ' + (c.avgMfe != null ? '+' + c.avgMfe + '%' : '—') +
              ' · MAE ' + (c.avgMae != null ? '-' + c.avgMae + '%' : '—') + '</div>' +
          '</div>';
        }
      });
    });
    h += '</div>';
    return h;
  }

  // ── 3) Faktör etkinliği ─────────────────────────────────────────────
  function _factorRow(label, a, aLbl, b, bLbl) {
    function half(c, lbl) {
      const cls = c ? _rateCls(c.confirmRate, c.n) : 'na';
      return '<span class="vd-am-f-half"><b class="' + cls + '">' + _rateTxt(c) + '</b> ' + lbl + ' <i>(n=' + (c ? c.resolved : 0) + ')</i></span>';
    }
    return '<div class="vd-am-f-row"><span class="vd-am-f-lbl">' + label + '</span>' +
      half(a, aLbl) + '<span class="vd-am-f-vs">vs</span>' + half(b, bLbl) + '</div>';
  }
  function _factorsHtml(f) {
    if (!f) return '';
    return '<div class="vd-am-f">' +
      '<div class="vd-am-sec-t">' + _t('am.factorTitle', null, 'FAKTÖR ETKİNLİĞİ — doğrulanma oranları') + '</div>' +
      _factorRow(_t('am.fFunding', null, 'Funding Alignment'), f.funding.with, _t('am.aligned', null, 'uyumlu'), f.funding.without, _t('am.notAligned', null, 'uyumsuz')) +
      _factorRow(_t('am.fOi', null, 'OI Expansion'), f.oi.with, _t('am.expanding', null, 'genişlerken'), f.oi.without, _t('am.notExpanding', null, 'genişlemezken')) +
      _factorRow(_t('am.fPos', null, 'Smart Money'), f.positioning.with, _t('am.smartWith', null, 'bizimle'), f.positioning.against, _t('am.smartAgainst', null, 'karşımızda')) +
      _factorRow(_t('am.fLiq', null, 'Liq Context'), f.liq.clean, 'CLEAN', f.liq.storm, 'STORM') +
    '</div>';
  }

  // ── Faz 5: Öğrenme bulguları (VDHybridInsights → cümleler) ──────────
  function _insightsHtml(data) {
    const HI = window.VDHybridInsights;
    if (!HI || !HI.derive) return '';
    let r;
    try { r = HI.derive(data); } catch (e) { return ''; }
    if (!r || !r.insights || !r.insights.length) return '';
    const rows = r.insights.map(function (i) {
      const ic = i.tone === 'strong' ? '◆' : i.tone === 'negative' ? '▼' : '○';
      const txt = _t(i.key, i.vars, i.fallback) + (i.key2 ? ' ' + _t(i.key2, null, i.fallback2) : '');
      return '<div class="vd-am-li ' + i.tone + '"><span class="vd-am-li-ic">' + ic + '</span>' +
        '<span class="vd-am-li-tx">' + txt +
        (i.evidence ? ' <i class="vd-am-li-ev">[' + i.evidence + ']</i>' : '') + '</span></div>';
    }).join('');
    return '<div class="vd-am-ins"><div class="vd-am-sec-t">' +
      _t('li.title', null, 'ÖĞRENME BULGULARI — Learning Engine') +
      (r.ready ? '' : ' <span class="vd-am-li-early">' + _t('li.earlyTag', null, 'erken dönem') + '</span>') +
      '</div>' + rows + '</div>';
  }

  // ── Render ──────────────────────────────────────────────────────────
  function _render() {
    const el = document.getElementById(PANEL_ID);
    if (!el) return;
    const head = '<div class="vd-am-head">' +
      '<div><span class="vd-am-title">◈ ' + _t('am.title', null, 'HYBRID RESEARCH — AGREEMENT MATRIX') + '</span>' +
      '<span class="vd-am-adm">ADMIN</span></div>' +
      '<button class="vd-am-refresh" id="vdAmRefresh">' + (_loading ? '…' : '⟳ ' + _t('am.refresh', null, 'Yenile')) + '</button>' +
    '</div>' +
    '<div class="vd-am-sub">' + _t('am.sub', null, 'Dönem: ') + (_data ? _data.period : 'hybrid_research_v1') +
      (_data ? ' · ' + _t('am.records', { n: _data.total, p: _data.pending }, _data.total + ' kayıt (' + _data.pending + ' beklemede)') : '') + '</div>';

    let bodyHtml;
    if (!_data) {
      bodyHtml = '<div class="vd-am-empty">' + (_loading ? _t('am.loading', null, 'Yükleniyor…') : _t('am.noLoad', null, 'Veri alınamadı — Yenile ile tekrar deneyin.')) + '</div>';
    } else if (_data.total === 0) {
      bodyHtml = '<div class="vd-am-empty">' + _t('am.empty', null, 'Bu dönemde henüz kayıt yok. Hybrid V2 deploy edildikten sonra sampler + autotrack kayıtları biriktikçe matris kendiliğinden dolacak.') + '</div>';
    } else {
      bodyHtml = _sidesHtml(_data.sides) + _insightsHtml(_data) + _matrixHtml(_data.matrix) + _factorsHtml(_data.factors);
    }
    el.innerHTML = head + bodyHtml +
      '<div class="vd-am-micro">' + _t('am.micro', null, 'Araştırma görünümü — istatistiksel gözlem; sinyal/öneri değildir. n<' + MIN_N + ' hücrelerde oran gizlenir.') + '</div>';
    const btn = document.getElementById('vdAmRefresh');
    if (btn) btn.addEventListener('click', refresh);
  }

  // ── Veri ───────────────────────────────────────────────────────────
  async function refresh() {
    if (_loading || !_isAdmin()) return;
    _loading = true; _render();
    try {
      const r = await window.TelegramDispatcher.adminFetch('/api/analysis-archive', { action: 'hybrid_matrix' });
      if (r && r.ok) _data = r;
    } catch (e) {}
    _loading = false;
    _render();
  }

  // ── Mount (yalnız admin) ───────────────────────────────────────────
  function mount() {
    if (_mounted || !_isAdmin()) return;
    if (document.getElementById(PANEL_ID)) return;
    const after = document.getElementById('vdAiTerminal') || document.getElementById('vdMarketSummary') || document.getElementById('tiPanelMount');
    if (!after || !after.parentNode) return;
    const el = document.createElement('section');
    el.id = PANEL_ID;
    el.className = 'vd-am';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Hybrid research agreement matrix');
    after.parentNode.insertBefore(el, after.nextSibling);
    _mounted = true;
    _render();
    refresh();
    try { console.log('[AgreementMatrix] mount ✓ (admin)'); } catch (e) {}
  }

  function unmount() {
    _mounted = false;
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }

  return { mount, unmount, refresh };
})();
