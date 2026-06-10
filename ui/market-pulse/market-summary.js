// ════════════════════════════════════════════════════════════════════
// MARKET INTELLIGENCE SUMMARY — 3. iş · AI Market Commentary paneli
//
// İçerik (PDF planı): Veri → Anlam → Sonuç zinciri
//   - Yorum paragrafı: flow + OI + funding + likidasyon + rejim (kod-tabanlı,
//     i18n şablonlarından kurulur → TR/EN her ikisi de doğal)
//   - Kısa rozetler (pulse durumlarından)
//   - İzlenecek seviyeler: LIVE FEED'den seans yüksek/düşük/son (dürüst türetme)
//   - Market Confidence: pulse uyumu + rejimden türetilen 0-100 skor (heuristik)
//
// Veri kaynakları (salt okuma — hiçbir motora dokunmaz):
//   - window.VDMarketPulse.getState()  → flow/oi/fund/liq durumları
//   - window.TIState.get()             → regime (code), mmBias
//   - window.VDLiveFeed.sessionStats() → seans seviyeleri
//
// Konum: #vdMarketPulse bandının hemen altı (tiPanelMount'tan önce).
// Veri yoksa ilgili bölüm gizlenir/'—' — mock yok.
//
// Public API: window.VDMarketSummary.mount() / .unmount()
// ════════════════════════════════════════════════════════════════════
window.VDMarketSummary = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const PANEL_ID = 'vdMarketSummary';
  const TICK_MS  = 15000;

  let _mounted = false;
  let _timer   = null;
  let _unsub   = null;

  // ── Yardımcılar ────────────────────────────────────────────────────
  function _fmtUsd(v) {
    if (v == null || !Number.isFinite(+v)) return null;
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + (+v).toFixed(0);
  }

  function _fmtP(p) {
    if (p == null) return '—';
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
    if (p >= 1)    return p.toFixed(3);
    return p.toFixed(5);
  }

  function _pulse() {
    try {
      const MP = window.VDMarketPulse;
      return (MP && MP.getState) ? MP.getState() : {};
    } catch (e) { return {}; }
  }
  function _ti() {
    try { return (window.TIState && window.TIState.get) ? window.TIState.get() : {}; }
    catch (e) { return {}; }
  }
  function _sess() {
    try { return (window.VDLiveFeed && window.VDLiveFeed.sessionStats) ? window.VDLiveFeed.sessionStats() : null; }
    catch (e) { return null; }
  }

  // ── Yorum zinciri (kod → i18n şablonu) ────────────────────────────
  function _commentary(p, ti) {
    const parts = [];
    const flow = p.flow && p.flow.code, oi = p.oi && p.oi.code,
          fund = p.fund && p.fund.code, liq = p.liq && p.liq.code;

    if (flow === 'BUY')       parts.push(_t('ms.cFlowBuy',  null, 'Piyasa genelinde alıcı taraf baskın durumda.'));
    else if (flow === 'SELL') parts.push(_t('ms.cFlowSell', null, 'Piyasa genelinde satıcı taraf baskın durumda.'));
    else if (flow === 'NEUTRAL') parts.push(_t('ms.cFlowNeutral', null, 'Alıcı-satıcı dengesi şu an nötr seyrediyor.'));

    if (oi === 'EXP')       parts.push(_t('ms.cOiExp',  null, 'Open Interest artışı yeni pozisyon girişlerini gösteriyor.'));
    else if (oi === 'COOL') parts.push(_t('ms.cOiCool', null, 'Open Interest soğuyor — pozisyonlar kapanıyor.'));
    else if (oi === 'FLAT') parts.push(_t('ms.cOiFlat', null, 'Open Interest yatay — belirgin yeni giriş yok.'));

    if (fund === 'NEUTRAL')     parts.push(_t('ms.cFundNeutral', null, 'Funding dengeli seyrediyor.'));
    else if (fund === 'LONGS')  parts.push(_t('ms.cFundLongs',  null, 'Funding long tarafında kalabalıklaşma gösteriyor.'));
    else if (fund === 'SHORTS') parts.push(_t('ms.cFundShorts', null, 'Funding short tarafında kalabalıklaşma gösteriyor.'));

    if (liq === 'LOW')         parts.push(_t('ms.cLiqLow',  null, 'Likidasyon riski şu an düşük seviyede.'));
    else if (liq === 'MEDIUM') parts.push(_t('ms.cLiqMed',  null, 'Likidasyon riski şu an orta seviyede.'));
    else if (liq === 'HIGH')   parts.push(_t('ms.cLiqHigh', null, 'Likidasyon riski yüksek — ani hareketlere dikkat.'));

    // Gerçek 24s likidasyon verisi (Pulse getState'ten gelir)
    if (p.liq24h && p.liq24h.total24h > 0) {
      const t = _fmtUsd(p.liq24h.total24h);
      if (p.liq24h.dominant === 'LONG')
        parts.push(_t('ms.cLiq24hLong', { t: t }, 'Son 24 saatte ' + t + ' likidasyon gerçekleşti — long tarafı ağırlıkta.'));
      else if (p.liq24h.dominant === 'SHORT')
        parts.push(_t('ms.cLiq24hShort', { t: t }, 'Son 24 saatte ' + t + ' likidasyon gerçekleşti — short tarafı ağırlıkta.'));
    }
    // Smart money ayrışması (top trader vs retail)
    if (p.smart && p.smart.divergence === 'TOP_LONG_RETAIL_SHORT')
      parts.push(_t('ms.cSmartTopLong', null, 'Top trader pozisyonları retail\'in tersine long tarafta — kısa sıkışması ihtimali izleniyor.'));
    else if (p.smart && p.smart.divergence === 'TOP_SHORT_RETAIL_LONG')
      parts.push(_t('ms.cSmartTopShort', null, 'Top trader pozisyonları retail\'in tersine short tarafta — uzun tasfiyesi riski izleniyor.'));

    const rc = ti.regime && ti.regime.code;
    if (rc) {
      const map = {
        RISK_ON:          ['ms.rRiskOn',        'Genel rejim Risk-On — trend devamı destekleniyor.'],
        RISK_OFF:         ['ms.rRiskOff',       'Genel rejim Risk-Off — savunmacı görünüm hakim.'],
        RISK_ON_FRAGILE:  ['ms.rRiskOnFragile', 'Temkinli Risk-On — yapı olumlu ama kırılgan.'],
        RISK_OFF_FRAGILE: ['ms.rRiskOffFragile','Temkinli Risk-Off — baskı var ama tükeniş sinyalleri izleniyor.'],
        CHOPPY:           ['ms.rChoppy',        'Piyasa yatay/belirsiz — net yön oluşmadı.'],
        LIQUIDITY_TRAP:   ['ms.rLiqTrap',       'Likidite tuzağı koşulları — sahte kırılımlara dikkat.'],
      };
      const m = map[rc];
      if (m) parts.push(_t(m[0], null, m[1]));
    }
    return parts.join(' ');
  }

  // ── Rozetler ───────────────────────────────────────────────────────
  function _badges(p) {
    const out = [];
    function add(st, prefixKey, prefixF) {
      if (!st) return;
      out.push('<span class="vd-ms-badge ' + st.cls + '">' +
        (prefixF ? _t(prefixKey, null, prefixF) + ' ' : '') + _t(st.k, null, st.f) + '</span>');
    }
    if (p.oi)   add(p.oi,   'ms.bOi',   'OI');
    if (p.flow) add(p.flow, null, null);
    if (p.liq)  out.push('<span class="vd-ms-badge ' + p.liq.cls + '">' + _t('ms.bLiq', null, 'Likidasyon:') + ' ' + _t(p.liq.k, null, p.liq.f) + '</span>');
    if (p.fund) out.push('<span class="vd-ms-badge ' + p.fund.cls + '">' + _t('ms.bFund', null, 'Funding:') + ' ' + _t(p.fund.k, null, p.fund.f) + '</span>');
    if (p.smart && p.smart.divergence === 'TOP_LONG_RETAIL_SHORT')
      out.push('<span class="vd-ms-badge up">🐋 ' + _t('ms.smartTopLong', null, 'Top trader long · retail short') + '</span>');
    else if (p.smart && p.smart.divergence === 'TOP_SHORT_RETAIL_LONG')
      out.push('<span class="vd-ms-badge dn">🐋 ' + _t('ms.smartTopShort', null, 'Top trader short · retail long') + '</span>');
    return out.join('');
  }

  // ── Market Confidence (heuristik, dürüst) ─────────────────────────
  function _confidence(p, ti) {
    let score = 50, signals = 0;
    if (p.flow) { signals++; if (p.flow.code !== 'NEUTRAL') score += 8; }
    if (p.oi)   { signals++; if (p.oi.code === 'EXP') score += 8; else if (p.oi.code === 'COOL') score -= 4; }
    if (p.fund) { signals++; if (p.fund.code === 'NEUTRAL') score += 8; else score -= 5; }
    if (p.liq)  { signals++; if (p.liq.code === 'LOW') score += 10; else if (p.liq.code === 'HIGH') score -= 12; }
    const rc = ti.regime && ti.regime.code;
    if (rc === 'RISK_ON' || rc === 'RISK_OFF') score += 10;
    else if (rc === 'RISK_ON_FRAGILE' || rc === 'RISK_OFF_FRAGILE') score += 4;
    else if (rc === 'LIQUIDITY_TRAP') score -= 8;
    if (signals < 2) return null;                 // yeterli veri yok → gösterme
    score = Math.max(5, Math.min(95, Math.round(score)));
    const lvl = score >= 70 ? { k: 'ms.confHigh', f: 'High Confidence', cls: 'up' }
              : score >= 45 ? { k: 'ms.confMod',  f: 'Moderate',        cls: 'mid' }
              :               { k: 'ms.confLow',  f: 'Low Confidence',  cls: 'dn' };
    return { score: score, lvl: lvl };
  }

  function _gauge(conf) {
    if (!conf) return '<div class="vd-ms-gauge-na">—</div>';
    const pct = conf.score / 100;
    const C = 2 * Math.PI * 34;                   // r=34
    const dash = (C * 0.75 * pct).toFixed(1);     // 270° yay
    const col = conf.lvl.cls === 'up' ? 'var(--green,#00e5a0)'
              : conf.lvl.cls === 'dn' ? 'var(--red,#ff3d6b)' : 'var(--yellow,#ffc107)';
    return '<svg viewBox="0 0 88 88" class="vd-ms-gsvg" aria-hidden="true">' +
        '<circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="7" ' +
          'stroke-dasharray="' + (C * 0.75).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(135 44 44)" stroke-linecap="round"/>' +
        '<circle cx="44" cy="44" r="34" fill="none" stroke="' + col + '" stroke-width="7" ' +
          'stroke-dasharray="' + dash + ' ' + C.toFixed(1) + '" transform="rotate(135 44 44)" stroke-linecap="round"/>' +
        '<text x="44" y="46" text-anchor="middle" class="vd-ms-gnum">' + conf.score + '</text>' +
        '<text x="44" y="60" text-anchor="middle" class="vd-ms-gsub">/100</text>' +
      '</svg>';
  }

  // ── Render ─────────────────────────────────────────────────────────
  function _render() {
    const el = document.getElementById(PANEL_ID);
    if (!el) return;
    const p = _pulse(), ti = _ti(), sess = _sess();
    const txt = _commentary(p, ti);
    const conf = _confidence(p, ti);

    const levelsHtml = sess
      ? '<div class="vd-ms-lv"><span class="vd-ms-lv-i r">◉</span>' + _t('ms.lvHigh', null, 'Seans Yükseği') + ': <b>$' + _fmtP(sess.high) + '</b></div>' +
        '<div class="vd-ms-lv"><span class="vd-ms-lv-i s">◉</span>' + _t('ms.lvLow', null, 'Seans Düşüğü') + ': <b>$' + _fmtP(sess.low) + '</b></div>' +
        '<div class="vd-ms-lv"><span class="vd-ms-lv-i c">◉</span>' + _t('ms.lvLast', null, 'Son Fiyat') + ': <b>$' + _fmtP(sess.last) + '</b></div>' +
        '<div class="vd-ms-lv-src">' + _t('ms.lvSrc', null, 'Canlı akıştan türetilmiştir') + '</div>'
      : '<div class="vd-ms-lv-na">' + _t('ms.lvWaiting', null, 'Seviye verisi bekleniyor…') + '</div>';

    el.innerHTML =
      '<div class="vd-ms-col vd-ms-main">' +
        '<div class="vd-ms-head">' +
          '<span class="vd-ms-ic">◎</span>' +
          '<div><div class="vd-ms-title">' + _t('ms.title', null, 'MARKET INTELLIGENCE SUMMARY') + '</div>' +
          '<div class="vd-ms-sub">' + _t('ms.sub', null, 'AI Piyasa Yorumu') + '</div></div>' +
        '</div>' +
        '<div class="vd-ms-text">' + (txt || _t('ms.waiting', null, 'Piyasa verileri toplanıyor — yorum kısa süre içinde oluşacak.')) + '</div>' +
        '<div class="vd-ms-badges">' + _badges(p) + '</div>' +
        '<div class="vd-ms-micro">' + _t('ms.micro', null, 'Algoritmik gözlem · yatırım tavsiyesi değildir.') + '</div>' +
      '</div>' +
      '<div class="vd-ms-col vd-ms-levels">' +
        '<div class="vd-ms-col-t">' + _t('ms.lvTitle', null, 'İzlenecek Seviyeler') + '</div>' +
        levelsHtml +
      '</div>' +
      '<div class="vd-ms-col vd-ms-conf">' +
        '<div class="vd-ms-col-t">' + _t('ms.confTitle', null, 'Market Confidence') + '</div>' +
        _gauge(conf) +
        (conf ? '<div class="vd-ms-conf-lbl ' + conf.lvl.cls + '">' + _t(conf.lvl.k, null, conf.lvl.f) + '</div>' : '') +
      '</div>';
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function _ensure() {
    if (document.getElementById(PANEL_ID)) return true;
    const band = document.getElementById('vdMarketPulse');
    const anchor = band || document.getElementById('tiPanelMount');
    if (!anchor || !anchor.parentNode) return false;
    const el = document.createElement('section');
    el.id = PANEL_ID;
    el.className = 'vd-ms';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', _t('ms.aria', null, 'Piyasa istihbarat özeti'));
    if (band) band.parentNode.insertBefore(el, band.nextSibling);  // bandın hemen altı
    else anchor.parentNode.insertBefore(el, anchor);
    return true;
  }

  function mount() {
    if (_mounted) return;
    if (!_ensure()) return;
    _mounted = true;
    _render();
    _timer = setInterval(_render, TICK_MS);
    try {
      if (window.TIState && window.TIState.subscribe) {
        _unsub = window.TIState.subscribe(function () { _render(); });
      }
    } catch (e) {}
    try { console.log('[MarketSummary] mount ✓'); } catch (e) {}
  }

  function unmount() {
    _mounted = false;
    if (_timer) clearInterval(_timer);
    if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }

  return { mount, unmount };
})();
