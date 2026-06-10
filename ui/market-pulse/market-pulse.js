// ════════════════════════════════════════════════════════════════════
// MARKET PULSE BAND — 2. iş · 4 kompakt durum kartı
//
// Kartlar (PDF planı):
//   FLOW             → Taker Flow: Buyers Dominating / Sellers Dominating / Neutral
//   OI STATE         → Open Interest: Expanding / Cooling / Flat
//   FUNDING          → Funding Rate: Neutral / Longs Crowded / Shorts Crowded
//   LIQUIDATION RISK → 24h Risk: Low / Medium / High
//
// Veri kaynakları:
//   - FLOW: VDLiveFeed.flowSummary() — Binance spot aggTrade'den GERÇEK taker oranı
//   - OI / FUNDING: CoinGlassService.getMarketIntelligence(sym)
//     (proxy /api/coinglass üzerinden; key Vercel env'de — Hobbyist exchange-list)
//   - LIQ RISK: liquidation history Hobbyist'te kapalı → funding aşırılığı +
//     long/short crowding + OI genişlemesinden türetilen dürüst heuristik.
//   - Veri yoksa '—' (mock yok, graceful fallback).
//
// Konum: #tiPanelMount'tan hemen önce (PİYASA İSTİHBARAT TERMİNALİ üstü).
// Mevcut motorlara DOKUNMAZ — salt okuma + kendi render'ı.
//
// Public API: window.VDMarketPulse.mount() / .refresh() / .unmount()
// ════════════════════════════════════════════════════════════════════
window.VDMarketPulse = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const BAND_ID  = 'vdMarketPulse';
  const POLL_MS  = 60000;  // CoinGlass yenileme: 60 sn
  const FLOW_MS  = 10000;  // FLOW kartı (live feed'den): 10 sn

  let _mounted   = false;
  let _pollTimer = null;
  let _flowTimer = null;
  let _curSym    = null;
  let _prevOI    = null;   // OI delta takibi (poll'lar arası)
  let _state     = { flow: null, oi: null, fund: null, liq: null };

  // ── Durum hesaplama ────────────────────────────────────────────────
  function _calcFlow() {
    try {
      const s = (window.VDLiveFeed && window.VDLiveFeed.flowSummary) ? window.VDLiveFeed.flowSummary() : null;
      if (!s || s.n < 8) return null;                       // yeterli örnek yok
      if (Date.now() - s.ts > 120000) return null;          // akış bayat (2dk+)
      if (s.buyRatio >= 0.56) return { code: 'BUY',  k: 'mp.vBuyers',  f: 'Buyers Dominating',  cls: 'up' };
      if (s.buyRatio <= 0.44) return { code: 'SELL', k: 'mp.vSellers', f: 'Sellers Dominating', cls: 'dn' };
      return { code: 'NEUTRAL', k: 'mp.vNeutral', f: 'Neutral', cls: 'mid' };
    } catch (e) { return null; }
  }

  function _calcOI(oiData) {
    if (!oiData || oiData.oi == null || !Number.isFinite(+oiData.oi) || +oiData.oi <= 0) return null;
    const cur = +oiData.oi;
    let st = null;
    if (_prevOI != null && _prevOI > 0) {
      const chg = ((cur - _prevOI) / _prevOI) * 100;
      if (chg >= 0.4)       st = { code: 'EXP',  k: 'mp.vExpanding', f: 'Expanding', cls: 'up' };
      else if (chg <= -0.4) st = { code: 'COOL', k: 'mp.vCooling',   f: 'Cooling',   cls: 'dn' };
      else                  st = { code: 'FLAT', k: 'mp.vFlat',      f: 'Flat',      cls: 'mid' };
    } else if (oiData.oiExpanding) {
      st = { code: 'EXP', k: 'mp.vExpanding', f: 'Expanding', cls: 'up' };
    } else {
      st = { code: 'FLAT', k: 'mp.vFlat', f: 'Flat', cls: 'mid' };   // ilk poll — referans yok
    }
    _prevOI = cur;
    return st;
  }

  function _calcFunding(fundData) {
    if (!fundData || fundData.fund == null || !Number.isFinite(+fundData.fund)) return null;
    const r = +fundData.fund; // % (8 saatlik)
    if (r >= 0.03)  return { code: 'LONGS',  k: 'mp.vLongsCrowded',  f: 'Longs Crowded',  cls: 'dn', rate: r };
    if (r <= -0.03) return { code: 'SHORTS', k: 'mp.vShortsCrowded', f: 'Shorts Crowded', cls: 'up', rate: r };
    return { code: 'NEUTRAL', k: 'mp.vNeutral', f: 'Neutral', cls: 'mid', rate: r };
  }

  function _calcLiqRisk(fund, ls, oiState) {
    // Heuristik (liq history Hobbyist'te yok): aşırılık sinyallerini birleştir.
    const hasCrowd = !!(ls && ls.crowding != null);
    if (!fund && !hasCrowd) return null;   // iki gerçek sinyal de yoksa '—'
    let score = 0;
    if (fund && fund.code !== 'NEUTRAL') score += Math.abs(+fund.rate) >= 0.1 ? 2 : 1;
    const crowd = hasCrowd ? String(ls.crowding).toUpperCase() : 'NEUTRAL';
    if (crowd.indexOf('NEUTRAL') === -1) score += 1;
    if (oiState && oiState.code === 'EXP' && score >= 1) score += 1;
    if (score >= 3) return { code: 'HIGH',   k: 'mp.vHigh',   f: 'High',   cls: 'dn' };
    if (score >= 1) return { code: 'MEDIUM', k: 'mp.vMedium', f: 'Medium', cls: 'mid' };
    return { code: 'LOW', k: 'mp.vLow', f: 'Low', cls: 'up' };
  }

  // ── Render ─────────────────────────────────────────────────────────
  function _card(key, title, sub, st) {
    const val = st ? _t(st.k, null, st.f) : '—';
    const cls = st ? st.cls : 'na';
    return '<div class="vd-mp-card vd-mp-' + key + '">' +
        '<div class="vd-mp-head"><span class="vd-mp-ic"></span>' +
          '<div><div class="vd-mp-title">' + title + '</div>' +
          '<div class="vd-mp-sub">' + sub + '</div></div></div>' +
        '<div class="vd-mp-val ' + cls + '">' + val + '</div>' +
      '</div>';
  }

  function _render() {
    const band = document.getElementById(BAND_ID);
    if (!band) return;
    band.innerHTML =
      _card('flow', _t('mp.flow', null, 'FLOW'),        _t('mp.flowSub', null, 'Taker Flow'),    _state.flow) +
      _card('oi',   _t('mp.oi', null, 'OI STATE'),      _t('mp.oiSub', null, 'Open Interest'),   _state.oi) +
      _card('fund', _t('mp.funding', null, 'FUNDING'),  _t('mp.fundSub', null, 'Funding Rate'),  _state.fund) +
      _card('liq',  _t('mp.liq', null, 'LIQUIDATION RISK'), _t('mp.liqSub', null, '24h Risk'),   _state.liq);
  }

  // ── Veri toplama ───────────────────────────────────────────────────
  function _refreshFlow() {
    const f = _calcFlow();
    if (JSON.stringify(f) !== JSON.stringify(_state.flow)) {
      _state.flow = f;
      _render();
    }
  }

  async function _refreshCG() {
    const sym = window.SYM || 'BTCUSDT';
    if (sym !== _curSym) { _curSym = sym; _prevOI = null; }
    try {
      const CG = window.CoinGlassService;
      if (!CG || !CG.getMarketIntelligence) return;
      const mi = await CG.getMarketIntelligence(sym);
      _state.oi   = _calcOI(mi.oi);
      _state.fund = _calcFunding(mi.fund);
      _state.liq  = _calcLiqRisk(_state.fund, mi.ls, _state.oi);
      _render();
    } catch (e) { /* graceful — kartlar '—' kalır */ }
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function _ensureBand() {
    if (document.getElementById(BAND_ID)) return true;
    const anchor = document.getElementById('tiPanelMount');
    if (!anchor || !anchor.parentNode) return false;
    const band = document.createElement('div');
    band.id = BAND_ID;
    band.className = 'vd-mp';
    band.setAttribute('role', 'region');
    band.setAttribute('aria-label', _t('mp.aria', null, 'Piyasa nabız kartları'));
    anchor.parentNode.insertBefore(band, anchor);
    return true;
  }

  function mount() {
    if (_mounted) return;
    if (!_ensureBand()) return;       // dashboard değilse sessizce çık
    _mounted = true;
    _render();                         // ilk: '—' durumları
    _refreshFlow();
    _refreshCG();
    _flowTimer = setInterval(_refreshFlow, FLOW_MS);
    _pollTimer = setInterval(_refreshCG, POLL_MS);
    try { console.log('[MarketPulse] mount ✓'); } catch (e) {}
  }

  function refresh() { _refreshFlow(); _refreshCG(); }

  function unmount() {
    _mounted = false;
    if (_pollTimer) clearInterval(_pollTimer);
    if (_flowTimer) clearInterval(_flowTimer);
    const el = document.getElementById(BAND_ID);
    if (el) el.remove();
  }

  function getState() { return { flow: _state.flow, oi: _state.oi, fund: _state.fund, liq: _state.liq }; }

  return { mount, refresh, unmount, getState };
})();
