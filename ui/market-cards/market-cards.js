// ════════════════════════════════════════════════════════════════════
// MARKET CARDS — 6. iş · Piyasa Durumu sırasına 3 gerçek-veri kartı
//
// Mock'taki OPEN INTEREST / FUNDING RATE / LIQUIDATION (24H) kartları.
// Mevcut .market-overview grid'ine (BITCOIN/ETHEREUM/BTC DOMINANCE
// kartlarının yanına) JS ile eklenir — index.html yapısına dokunmaz.
// Mevcut .mkt-card sınıf ailesi yeniden kullanılır → görsel dil birebir.
//
// Veri (hepsi BTC bazlı, CoinGlassService — 5. işte doğrulanan v4 yollar):
//   OI:      getOI (oiUsd + 24s%) + getOIOhlc (sparkline) + getLSRatio (L/S bar)
//   FUNDING: getFundingExtreme (oran) + getFundingOhlc (sparkline)
//   LIQ:     getLiquidation24h (toplam, önceki 24s'e göre %, long/short donut,
//            en yoğun 4s dilimi)
// 120 sn'de bir tazelenir; veri yoksa '—' (mock yok). Sinyal/tavsiye yok.
//
// Public API: window.VDMarketCards.mount() / .unmount() / .refresh()
// ════════════════════════════════════════════════════════════════════
window.VDMarketCards = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const SYM = 'BTCUSDT';        // Piyasa Durumu satırı BTC bazlı sabittir
  const POLL_MS = 120000;
  let _mounted = false;
  let _timer = null;

  // ── Format yardımcıları ────────────────────────────────────────────
  function _usd(v) {
    if (v == null || !Number.isFinite(+v)) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + (+v).toFixed(0);
  }
  function _pct(v, plus) {
    if (v == null || !Number.isFinite(+v)) return '—';
    return (plus && v > 0 ? '+' : '') + (+v).toFixed(v >= 10 || v <= -10 ? 1 : 2) + '%';
  }

  // Mevcut kartlardaki sparkline deseniyle aynı: polyline, viewBox 0 0 120 40
  function _sparkline(series, color) {
    if (!Array.isArray(series) || series.length < 2) return '';
    const min = Math.min.apply(null, series), max = Math.max.apply(null, series);
    const span = (max - min) || 1;
    const step = 120 / (series.length - 1);
    const pts = series.map(function (v, i) {
      const x = (i * step).toFixed(1);
      const y = (36 - ((v - min) / span) * 32).toFixed(1);   // 4-36 bandı
      return x + ',' + y;
    }).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  // Long/Short donut (likidasyon kartı)
  function _donut(longUsd, shortUsd) {
    const total = (longUsd || 0) + (shortUsd || 0);
    if (!(total > 0)) return '<div class="vd-mc-donut-na">—</div>';
    const lp = (longUsd / total);
    const C = 2 * Math.PI * 26;
    const lDash = (C * lp).toFixed(1);
    return '<svg viewBox="0 0 64 64" class="vd-mc-donut" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="var(--red,#ff3d6b)" stroke-width="9"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="var(--green,#00e5a0)" stroke-width="9" ' +
        'stroke-dasharray="' + lDash + ' ' + C.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="30" text-anchor="middle" class="vd-mc-donut-t">' + Math.round(lp * 100) + '%</text>' +
      '<text x="32" y="41" text-anchor="middle" class="vd-mc-donut-s">LONG</text>' +
    '</svg>';
  }

  // ── Kart iskeletleri ───────────────────────────────────────────────
  function _html() {
    return '' +
    // OPEN INTEREST
    '<div class="mkt-card vd-mc-oi" id="vdMcOi">' +
      '<div class="mkt-card-glow"></div>' +
      '<div class="mkt-header">' +
        '<div class="mkt-icon vd-mc-ic-oi">◎</div>' +
        '<div><div class="mkt-name">' + _t('mc.oiName', null, 'OPEN INTEREST') + '</div>' +
        '<div class="mkt-sub">' + _t('mc.oiSub', null, 'BTC · Tüm Borsalar') + '</div></div>' +
        '<div class="mkt-badge vd-mc-bdg-oi" id="vdMcOiBadge">—</div>' +
      '</div>' +
      '<div class="mkt-price" id="vdMcOiVal" style="color:var(--cyan,#00d4ff)">—</div>' +
      '<div class="mkt-chg" id="vdMcOiChg">—</div>' +
      '<svg class="sparkline" id="vdMcOiSpark" viewBox="0 0 120 40" preserveAspectRatio="none"></svg>' +
      '<div class="vd-mc-ratio">' +
        '<div class="vd-mc-ratio-lbl">' + _t('mc.oiRatio', null, 'Hesap Oranı (L/S)') + '</div>' +
        '<div class="vd-mc-ratio-track"><div class="vd-mc-ratio-fill" id="vdMcOiLsFill" style="width:50%"></div></div>' +
        '<div class="vd-mc-ratio-pcts"><span class="up" id="vdMcOiLsL">—</span><span class="dn" id="vdMcOiLsS">—</span></div>' +
      '</div>' +
      '<div class="mkt-signal" id="vdMcOiSig">—</div>' +
    '</div>' +
    // FUNDING RATE
    '<div class="mkt-card vd-mc-fr" id="vdMcFr">' +
      '<div class="mkt-card-glow"></div>' +
      '<div class="mkt-header">' +
        '<div class="mkt-icon vd-mc-ic-fr">⚡</div>' +
        '<div><div class="mkt-name">' + _t('mc.frName', null, 'FUNDING RATE') + '</div>' +
        '<div class="mkt-sub">' + _t('mc.frSub', null, 'BTC · OI Ağırlıklı') + '</div></div>' +
        '<div class="mkt-badge vd-mc-bdg-fr" id="vdMcFrBadge">—</div>' +
      '</div>' +
      '<div class="mkt-price" id="vdMcFrVal" style="color:var(--yellow,#ffc107)">—</div>' +
      '<div class="mkt-chg" id="vdMcFrChg">' + _t('mc.per8h', null, '8 saatlik dönem') + '</div>' +
      '<svg class="sparkline" id="vdMcFrSpark" viewBox="0 0 120 40" preserveAspectRatio="none"></svg>' +
      '<div class="vd-mc-sent" id="vdMcFrSent">—</div>' +
      '<div class="mkt-signal" id="vdMcFrSig">' + _t('mc.frNote', null, 'Pozitif funding → longlar shortlara öder') + '</div>' +
    '</div>' +
    // LIQUIDATION 24H
    '<div class="mkt-card vd-mc-lq" id="vdMcLq">' +
      '<div class="mkt-card-glow"></div>' +
      '<div class="mkt-header">' +
        '<div class="mkt-icon vd-mc-ic-lq">⌁</div>' +
        '<div><div class="mkt-name">' + _t('mc.lqName', null, 'LIQUIDATION (24S)') + '</div>' +
        '<div class="mkt-sub">' + _t('mc.lqSub', null, 'BTC · Binance+OKX+Bybit') + '</div></div>' +
        '<div class="mkt-badge vd-mc-bdg-lq" id="vdMcLqBadge">—</div>' +
      '</div>' +
      '<div class="vd-mc-lq-body">' +
        '<div class="vd-mc-lq-left">' +
          '<div class="mkt-price" id="vdMcLqVal" style="color:var(--orange,#ff9100)">—</div>' +
          '<div class="mkt-chg" id="vdMcLqChg">—</div>' +
          '<div class="vd-mc-lq-split">' +
            '<div><span class="vd-mc-dot up"></span>Long <b id="vdMcLqLong">—</b></div>' +
            '<div><span class="vd-mc-dot dn"></span>Short <b id="vdMcLqShort">—</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="vd-mc-lq-right" id="vdMcLqDonut"></div>' +
      '</div>' +
      '<div class="mkt-signal" id="vdMcLqSig">—</div>' +
    '</div>';
  }

  // ── Veri tazeleme ──────────────────────────────────────────────────
  async function refresh() {
    const CG = window.CoinGlassService;
    if (!CG || !CG.isEnabled || !CG.isEnabled()) return;
    let oi = null, ls = null, fund = null, liq = null, oih = null, frh = null;
    try {
      const r = await Promise.allSettled([
        CG.getOI(SYM), CG.getLSRatio(SYM), CG.getFundingExtreme(SYM),
        CG.getLiquidation24h(SYM), CG.getOIOhlc(SYM), CG.getFundingOhlc(SYM),
      ]);
      const F = x => x.status === 'fulfilled' ? x.value : null;
      oi = F(r[0]); ls = F(r[1]); fund = F(r[2]); liq = F(r[3]); oih = F(r[4]); frh = F(r[5]);
    } catch (e) { return; }
    _renderOI(oi, ls, oih);
    _renderFR(fund, frh);
    _renderLQ(liq);
  }

  function _el(id) { return document.getElementById(id); }
  function _set(id, txt, cls) {
    const e = _el(id); if (!e) return;
    e.textContent = txt;
    if (cls != null) e.className = cls;
  }

  function _renderOI(oi, ls, oih) {
    if (oi && oi.oiUsd != null) {
      _set('vdMcOiVal', _usd(oi.oiUsd));
      const c = oi.oiChange24h;
      _set('vdMcOiChg', c != null ? _pct(c, true) + ' (24s)' : '—', 'mkt-chg ' + (c > 0 ? 'up' : c < 0 ? 'dn' : ''));
      _set('vdMcOiBadge', c != null ? (c >= 0.5 ? '▲' : c <= -0.5 ? '▼' : '◆') : '—');
      const sig = c == null ? '—'
        : c >= 0.5  ? _t('mc.sigOiUp', null, 'OI artıyor — yeni pozisyon girişi')
        : c <= -0.5 ? _t('mc.sigOiDn', null, 'OI azalıyor — pozisyon kapanışı')
        :             _t('mc.sigOiFlat', null, 'OI yatay seyrediyor');
      _set('vdMcOiSig', sig);
    }
    if (ls && ls.longPct != null) {
      const f = _el('vdMcOiLsFill'); if (f) f.style.width = ls.longPct + '%';
      _set('vdMcOiLsL', 'L %' + ls.longPct);
      _set('vdMcOiLsS', 'S %' + ls.shortPct);
    }
    const sp = _el('vdMcOiSpark');
    if (sp && oih && oih.series && oih.series.length >= 2) {
      sp.innerHTML = _sparkline(oih.series, 'var(--cyan,#00d4ff)');
    }
  }

  function _renderFR(fund, frh) {
    if (fund && fund.fund != null && Number.isFinite(+fund.fund)) {
      const r = +fund.fund;
      _set('vdMcFrVal', (r > 0 ? '+' : '') + r.toFixed(4) + '%');
      _set('vdMcFrBadge', r > 0.005 ? '▲' : r < -0.005 ? '▼' : '◆');
      const sent = r > 0.005
        ? { t: _t('mc.longsPaying', null, 'Longlar Ödüyor'), cls: 'vd-mc-sent dn' }
        : r < -0.005
        ? { t: _t('mc.shortsPaying', null, 'Shortlar Ödüyor'), cls: 'vd-mc-sent up' }
        : { t: _t('mc.balanced', null, 'Dengeli'), cls: 'vd-mc-sent mid' };
      _set('vdMcFrSent', sent.t, sent.cls);
    }
    const sp = _el('vdMcFrSpark');
    if (sp && frh && frh.series && frh.series.length >= 2) {
      sp.innerHTML = _sparkline(frh.series, 'var(--yellow,#ffc107)');
    }
  }

  function _renderLQ(liq) {
    if (!liq || liq.total24h == null || !(liq.total24h > 0)) return;
    _set('vdMcLqVal', _usd(liq.total24h));
    const c = liq.change24h;
    _set('vdMcLqChg',
      c != null ? _pct(c, true) + ' ' + _t('mc.vs24h', null, 'önceki 24s\'e göre') : '—',
      'mkt-chg ' + (c > 0 ? 'dn' : c < 0 ? 'up' : ''));   // likidasyon artışı = olumsuz ton
    _set('vdMcLqLong', _usd(liq.long24h));
    _set('vdMcLqShort', _usd(liq.short24h));
    _set('vdMcLqBadge', liq.dominant === 'LONG' ? 'L' : liq.dominant === 'SHORT' ? 'S' : '—');
    const d = _el('vdMcLqDonut');
    if (d) d.innerHTML = _donut(liq.long24h, liq.short24h);
    const parts = [];
    if (liq.dominant === 'LONG') parts.push(_t('mc.sigLqLong', null, 'Long tarafı ağırlıkta'));
    else if (liq.dominant === 'SHORT') parts.push(_t('mc.sigLqShort', null, 'Short tarafı ağırlıkta'));
    if (liq.maxBucket && liq.maxBucket.total > 0)
      parts.push(_t('mc.maxBucket', null, 'En yoğun 4s') + ': ' + _usd(liq.maxBucket.total));
    _set('vdMcLqSig', parts.join(' · ') || '—');
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    const grid = document.querySelector('.market-overview');
    if (!grid) return;
    if (!document.getElementById('vdMcOi')) {
      grid.insertAdjacentHTML('beforeend', _html());
    }
    _mounted = true;
    refresh();
    _timer = setInterval(refresh, POLL_MS);
    try { console.log('[MarketCards] mount ✓ (BTC metrik kartları)'); } catch (e) {}
  }

  function unmount() {
    _mounted = false;
    if (_timer) clearInterval(_timer);
    ['vdMcOi', 'vdMcFr', 'vdMcLq'].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.remove();
    });
  }

  return { mount, unmount, refresh };
})();
