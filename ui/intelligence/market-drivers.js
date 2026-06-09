// ════════════════════════════════════════════════════════════════════
// MARKET DRIVERS (build 144) — BTC/ETH trend·momentum·risk CANLI
//
// Veri kaynağı: sayfada ZATEN olan gerçek veri (MarketRegime.getBTC() →
//   chg, rsi, macdHist, atrPct) + ETH için _ethData / scanResults fallback.
//   YENİ API YOK, SAHTE VERİ YOK. Metrik yoksa "—" gösterir (uydurmaz).
//
// NASDAQ: harici borsa verisi gerekir (bağlı değil) → dürüst "—".
// NEWS IMPACT: haber/makro feed gerekir (bağlı değil) → dürüst durum.
//
// Bu bir SİNYAL değil — yalnızca AI bağlam göstergesi. Yatırım tavsiyesi değildir.
// DOKUNMAZ: scanner, skorlama, motor. Sadece mevcut veriyi okur + gösterir.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDMarketDrivers) return;

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  function num(x) { var n = parseFloat(x); return isFinite(n) ? n : null; }

  function getCoinData(sym) {
    var d = null;
    try { if (sym === 'BTCUSDT' && window.MarketRegime && MarketRegime.getBTC) d = MarketRegime.getBTC(); } catch (e) {}
    try { if (!d && sym === 'BTCUSDT' && window._btcData) d = window._btcData; } catch (e) {}
    try { if (!d && sym === 'ETHUSDT' && window._ethData) d = window._ethData; } catch (e) {}
    if (!d) {
      try {
        var arr = (window.VD_STATE && VD_STATE.scanResults) || window._scanResults || [];
        if (arr && arr.length) d = arr.filter(function (it) { return it && (it.sym === sym || it.symbol === sym); })[0] || null;
      } catch (e) {}
    }
    if (!d) return null;
    var chg = num(d.chg != null ? d.chg : (d.priceChangePercent != null ? d.priceChangePercent : d.change));
    var rsi = num(d.rsi != null ? d.rsi : (d.ind && d.ind.rsi));
    var atrPct = num(d.atrPct);
    if (atrPct == null) { var p = num(d.price), a = num(d.atr); if (p && a) atrPct = a / p * 100; }
    var mh = num(d.macdHist != null ? d.macdHist : (d.ind && d.ind.macdHist));
    return { chg: chg, rsi: rsi, atrPct: atrPct, mh: mh, ok: (chg != null || rsi != null) };
  }

  function trend(chg) {
    if (chg == null) return { t: '—', c: '#5b6677' };
    if (chg >= 1.5) return { t: _t('md.trendUp', null, 'Yükseliş'), c: '#36d399' };
    if (chg <= -1.5) return { t: _t('md.trendDown', null, 'Düşüş'), c: '#f87272' };
    return { t: _t('md.trendFlat', null, 'Yatay'), c: '#9fb4d6' };
  }
  function mom(rsi, mh) {
    if (rsi == null) return { t: '—', c: '#5b6677' };
    if (rsi >= 58 || (mh != null && mh > 0 && rsi >= 52)) return { t: _t('md.momStrong', null, 'Güçlü ↑'), c: '#36d399' };
    if (rsi <= 42 || (mh != null && mh < 0 && rsi <= 48)) return { t: _t('md.momWeak', null, 'Zayıf ↓'), c: '#f87272' };
    return { t: _t('md.momNeutral', null, 'Nötr'), c: '#9fb4d6' };
  }
  function risk(atrPct) {
    if (atrPct == null) return { t: '—', c: '#5b6677' };
    if (atrPct >= 4) return { t: _t('md.riskHigh', null, 'Yüksek'), c: '#f87272' };
    if (atrPct <= 1.5) return { t: _t('md.riskLow', null, 'Düşük'), c: '#36d399' };
    return { t: _t('md.riskMid', null, 'Orta'), c: '#fbbd23' };
  }

  function chip(label, d) {
    var status, T, M, R;
    if (d && d.ok) {
      T = trend(d.chg); M = mom(d.rsi, d.mh); R = risk(d.atrPct);
      status = '<span style="color:#36d399">' + _t('md.live', null, '● canlı') + '</span>';
    } else {
      T = M = R = { t: '—', c: '#5b6677' };
      status = '<span style="color:#5b6677">' + _t('md.waiting', null, '⏳ veri bekleniyor') + '</span>';
    }
    return '<div style="background:#0e1626;border:1px solid #1e2836;border-radius:9px;padding:8px 11px;display:flex;align-items:center;gap:9px">'
      + '<span style="font-weight:800;font-size:12px;color:#e6edf6;min-width:52px">' + label + '</span>'
      + '<span style="font-size:10px;color:#8b98ac">Trend <b style="color:' + T.c + '">' + T.t + '</b> · Mom <b style="color:' + M.c + '">' + M.t + '</b> · Risk <b style="color:' + R.c + '">' + R.t + '</b></span>'
      + '<span style="margin-left:auto;font-size:9px;white-space:nowrap">' + status + '</span></div>';
  }

  function nasdaqChip() {
    return '<div style="background:#0e1626;border:1px solid #1e2836;border-radius:9px;padding:8px 11px;display:flex;align-items:center;gap:9px">'
      + '<span style="font-weight:800;font-size:12px;color:#e6edf6;min-width:52px">NASDAQ</span>'
      + '<span style="font-size:10px;color:#8b98ac">Trend <b style="color:#5b6677">—</b> · Mom <b style="color:#5b6677">—</b> · Risk <b style="color:#5b6677">—</b></span>'
      + '<span style="margin-left:auto;font-size:9px;color:#5b6677;white-space:nowrap">' + _t('md.noExt', null, 'harici veri yok') + '</span></div>';
  }

  function render() {
    var host = document.getElementById('marketDrivers');
    if (!host) return;
    var grid = document.getElementById('mdGrid');
    if (!grid) {
      host.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px"><span style="font-size:11px;font-weight:800;letter-spacing:.04em;color:#e6edf6">◈ MARKET DRIVERS</span><span style="font-size:8.5px;font-weight:800;letter-spacing:.05em;color:#3b9eff;border:1px solid rgba(59,158,255,.4);border-radius:5px;padding:1px 6px">' + _t('md.liveBadge', null, 'CANLI') + '</span><span style="font-size:9.5px;color:#8b98ac">' + _t('md.ctx', null, 'trend · momentum · risk — AI bağlamı (sinyal değil)') + '</span></div>'
        + '<div id="mdGrid" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"></div>';
      grid = document.getElementById('mdGrid');
    }
    grid.innerHTML = chip('BTC', getCoinData('BTCUSDT')) + chip('ETH', getCoinData('ETHUSDT')) + nasdaqChip();

    // News Impact: dürüst durum (feed bağlı değil)
    var news = document.getElementById('newsImpact');
    if (news) {
      var st = news.querySelector('.md-news-st');
      if (!st) { st = news.lastElementChild; if (st) st.className = (st.className || '') + ' md-news-st'; }
      if (st) { st.textContent = _t('md.newsOff', null, '○ haber/makro kaynağı bağlı değil'); st.style.color = '#5b6677'; }
    }
  }

  var _tries = 0;
  function loop() {
    render();
    _tries++;
    // BTC verisi gelene kadar sık dene, sonra periyodik tazele
    var btc = getCoinData('BTCUSDT');
    var delay = (btc && btc.ok) ? 12000 : (_tries < 12 ? 2500 : 12000);
    setTimeout(loop, delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(loop, 600); });
  else setTimeout(loop, 600);

  window.VDMarketDrivers = { render: render, _data: getCoinData };
})();
