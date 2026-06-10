// ════════════════════════════════════════════════════════════════════
// engines/market/market-event-feeder.js
// ÇOKLU-COIN MARKET EVENT BESLEYİCİ
//
// SORUN: NC.add çağrıları seçili coin analizinden tetikleniyordu → Timeline
//        sadece o coin'i gösteriyordu.
// ÇÖZÜM: Market tarayıcısı tüm coinleri 'vd:scan:complete' ile yayınlıyor
//        (window.VD_STATE.scanResults). Bu modül o sonuçlardan TÜM coinler
//        için olay türetir ve MEVCUT window.NC.add(...) ile yazar.
//
// • Aynı veri kaynağı: market_events_v1 (NC) → VDEventStore → Timeline.
// • Dedupe MEVCUT NC sistemine bırakılır (sym+kategori+msg, 30 dk).
// • Archive / Telegram / Pending / Timeline UI'a DOKUNMAZ. Mor YOK.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  if (window.VDMarketFeeder) return;
  const TAG = '[MarketFeeder]';
  const MAX_EVENTS_PER_CYCLE = 24;   // gürültüyü sınırla (dedupe ayrıca korur)
  const TOP_N = 40;                  // en hareketli ilk N coin'i değerlendir

  function _coin(sym) { return sym ? String(sym).replace('USDT', '') : ''; }
  function _num(v) { const n = Number(v); return isNaN(n) ? null : n; }

  // Bir coin için EN dikkat çekici TEK olayı türet (öncelik sırasıyla)
  function _deriveEvent(r) {
    try {
      const sym = r.sym; if (!sym) return null;
      const C = _coin(sym);
      const chg = _num(r.chg) || 0;
      const rsi = _num(r.rsi);
      const risk = _num(r.risk) || 0;
      const lSc = _num(r.lScore) || 0, sSc = _num(r.sScore) || 0;
      const closes = Array.isArray(r.closes) ? r.closes : [];
      const candles = Array.isArray(r.candles) ? r.candles : [];
      if (closes.length < 20 || !candles.length) {
        // veri zayıf → yalnızca momentum/risk chg üzerinden
      }
      const last = closes[closes.length - 1];
      const win = closes.slice(-21, -1);
      const recentHigh = win.length ? Math.max(...win) : last;
      const recentLow = win.length ? Math.min(...win) : last;
      const cd = candles[candles.length - 1] || {};
      const body = Math.abs((cd.c || 0) - (cd.o || 0));
      const range = Math.max((cd.h || 0) - (cd.l || 0), 1e-9);
      const upWick = (cd.h || 0) - Math.max(cd.o || 0, cd.c || 0);
      const loWick = Math.min(cd.o || 0, cd.c || 0) - (cd.l || 0);
      const maxWick = Math.max(upWick, loWick);
      // hacim trendi
      const vols = candles.map(k => k.v || 0);
      const vLast = vols.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, vols.length));
      const vPrior = vols.slice(-13, -3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(10, Math.max(0, vols.length - 3)));
      const vRatio = vPrior > 0 ? vLast / vPrior : 1;

      const conf = Math.round(Math.max(0, Math.min(100, Math.max(lSc, sSc, risk, Math.min(95, Math.abs(chg) * 8)))));
      const mk = (msg, level, dir) => ({ sym, msg, level, conf, dir });

      // 1) RISK — aşırı alım/satım, stop avı, sahte kırılım
      if (risk >= 72 || (rsi != null && rsi >= 80 && chg >= 6) || (upWick > 2 * body && body > 0 && chg > 4)) {
        return mk(_t('tlf.fakeRisk',{c:C},C+' aşırı uzama / stop avı riski — sahte kırılım ihtimali'), risk >= 85 ? 'critical' : 'high', 'fake');
      }
      // 2) BREAKOUT — seviye kırılımı + hacim
      if (last && last >= recentHigh && chg >= 2.5) return mk(_t('tlf.breakUp',{c:C},C+' breakout teyidi — direnç kırıldı'), 'high', 'long');
      if (last && last <= recentLow && chg <= -2.5) return mk(_t('tlf.breakDown',{c:C},C+' breakout teyidi — destek kırıldı (aşağı)'), 'high', 'short');
      // 3) FUNDING (proxy) — kalabalık taraf
      if (chg >= 7 && lSc >= 68 && rsi != null && rsi >= 70) return mk(_t('tlf.fundPos',{c:C},C+' funding aşırı pozitifleşti — long tarafı kalabalıklaşıyor'), 'medium', 'warn');
      if (chg <= -7 && sSc >= 68 && rsi != null && rsi <= 30) return mk(_t('tlf.fundNeg',{c:C},C+' funding aşırı negatifleşti — short tarafı kalabalıklaşıyor'), 'medium', 'warn');
      // 4) OPEN INTEREST (proxy) — hacim/ilgi artışı
      if (vRatio >= 1.8) return mk(_t('tlf.oiRise',{c:C},C+' open interest artıyor (OI) — açık ilgi ve hacim yükselişi'), 'medium', 'info');
      // 5) LİKİDİTE — fitil ile seviye süpürme
      if (maxWick > 1.8 * body && body > 0 && maxWick / range > 0.45) return mk(_t('tlf.liqSweep',{c:C},C+' likidite süpürmesi — fitil ile seviye temizliği'), 'medium', 'warn');
      // 6) SMART MONEY — hacim + emilim (küçük gövde)
      if (vRatio >= 1.5 && body / range < 0.32) return mk(_t('tlf.smartFlow',{c:C},C+' büyük oyuncu akışı izi (smart money emilimi)'), 'medium', 'info');
      // 7) TREND SHIFT — kısa vadeli yön dönüşü
      if (closes.length >= 12) {
        const a = closes[closes.length - 11], b = closes[closes.length - 4], c = closes[closes.length - 1];
        if (a > b && c > b && chg > 0.5) return mk(_t('tlf.trendUp',{c:C},C+' trend shift — yapı yukarı dönüyor'), 'medium', 'long');
        if (a < b && c < b && chg < -0.5) return mk(_t('tlf.trendDown',{c:C},C+' trend shift — yapı aşağı dönüyor'), 'medium', 'short');
      }
      // 8) MOMENTUM (varsayılan) — güçlü skor/değişim
      if (lSc >= 66 || chg >= 3) return mk(_t('tlf.momUp',{c:C},C+' momentum güçleniyor — yukarı ivme'), 'medium', 'long');
      if (sSc >= 66 || chg <= -3) return mk(_t('tlf.momDown',{c:C},C+' momentum güçleniyor — aşağı ivme'), 'medium', 'short');
      return null; // dikkat çekici bir şey yok → olay üretme
    } catch (e) { return null; }
  }

  function _process(results) {
    if (!window.NC || typeof window.NC.add !== 'function') return;
    if (!Array.isArray(results) || !results.length) return;
    // en hareketli coinleri önce değerlendir
    const ranked = results.slice().sort((a, b) =>
      (Math.abs(_num(b.chg) || 0) + (_num(b.risk) || 0) / 20) - (Math.abs(_num(a.chg) || 0) + (_num(a.risk) || 0) / 20)
    ).slice(0, TOP_N);
    let added = 0;
    for (const r of ranked) {
      if (added >= MAX_EVENTS_PER_CYCLE) break;
      const ev = _deriveEvent(r);
      if (!ev) continue;
      const id = window.NC.add(ev);     // null dönerse dedupe yakaladı (spam yok)
      if (id) added++;
    }
    console.log(`${TAG} ${ranked.length} coin değerlendirildi → ${added} yeni olay (dedupe filtreli).`);
  }

  function _onScan(e) {
    const results = (e && e.detail && e.detail.results) || (window.VD_STATE && window.VD_STATE.scanResults) || [];
    _process(results);
  }

  window.addEventListener('vd:scan:complete', _onScan);
  // Sayfa açıkken tarama zaten yapılmışsa bir kez işle
  try {
    if (window.VD_STATE && Array.isArray(window.VD_STATE.scanResults) && window.VD_STATE.scanResults.length) {
      setTimeout(() => _process(window.VD_STATE.scanResults), 1200);
    }
  } catch (e) {}

  window.VDMarketFeeder = { _process, _deriveEvent };
  console.log(`${TAG} yüklendi ✓ — vd:scan:complete dinleniyor (çoklu-coin event).`);
})();
