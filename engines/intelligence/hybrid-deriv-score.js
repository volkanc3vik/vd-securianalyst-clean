// ════════════════════════════════════════════════════════════════════
// HYBRID ENGINE V2 — Price + Derivative → Final Hybrid (tek karar)
//
// Mimari plan onaylı (Volkan). İlkeler:
//   • PriceScore mevcut tarayıcıdan AYNEN gelir (parametre olarak alınır).
//   • DerivScore 4 faktör (CoinGlass): Funding 25 · OI 30 · Positioning 25 ·
//     Liquidation 20. Veri yoksa faktör havuzdan DÜŞER, kalan normalize edilir.
//     <2 faktör → deriv N/A (uydurma yok).
//   • Final Hybrid = 0.6·Price + 0.4·Deriv (CFG). Deriv N/A → hybrid=price,
//     deriv_available=false damgası.
//   • Final verdict YALNIZ hybrid skordan: CONFIRMED≥80 · ARMED≥65 · WATCH≥50.
//   • ALT-FAKTÖR SKORLARI AYRI KAYDEDİLİR (funding_score, oi_score,
//     positioning_score, liquidation_score) → Learning Engine hammaddesi.
//
// API:
//   evaluate(sym, dir, priceScore) → Promise<rec>   (CG'den hesaplar + cache)
//   get(sym, dir) → rec|null                        (senkron cache okuma)
//   verdictOf(score) → 'CONFIRMED'|'ARMED'|'WATCH'|null
//   payloadFields(rec) → arşiv kaydına eklenecek düz alan objesi
//   CFG → ağırlık/eşik ayarları (araştırma dönemi sonunda kalibre edilir)
// ════════════════════════════════════════════════════════════════════
window.VDHybridEngine = (function () {
  'use strict';

  const CFG = {
    W_PRICE: 0.6, W_DERIV: 0.4,            // onaylı başlangıç ağırlıkları
    CONFIRMED_MIN: 80, ARMED_MIN: 65, WATCH_MIN: 50,
    TOP_N: 10,                              // Stage-2 derinliği (rate limit)
    MIN_FACTORS: 2,                         // bundan az faktör → deriv N/A
    TTL: 300000,                            // değerlendirme cache (5 dk)
    RESEARCH_PERIOD: 'hybrid_research_v1',
  };

  const FW = { funding: 25, oi: 30, positioning: 25, liquidation: 20 };

  const _cache = new Map();                 // 'SYM|DIR' → { rec, ts }
  const _inflight = new Map();
  const _requested = new Set();             // bu oturumda Stage-2'ye GİRMİŞ anahtarlar
  // ── 10. İŞ: VERDICT-GEÇİŞ ZAMANLARI ──
  // Bölüm (episode) = tarafın kesintisiz ≥ARMED kaldığı dönem.
  // armed_at = bölüme giriş anı; confirmed_at = bölüm içinde CONFIRMED'a İLK değiş.
  // Taraf ARMED altına düşerse bölüm biter, damgalar sıfırlanır (yeni bölüm yeni ölçüm).
  const _trans = new Map();                 // key → { price:{armed_at,confirmed_at}, deriv:{...} }
  const _RANK = { CONFIRMED: 3, ARMED: 2, WATCH: 1 };
  function _stepSide(st, verdict, now) {
    const r = verdict ? (_RANK[verdict] || 0) : 0;
    if (r >= 2) {                                  // ≥ARMED: bölüm içi
      if (st.armed_at == null) st.armed_at = now;  // bölüme giriş
      if (r >= 3 && st.confirmed_at == null) st.confirmed_at = now;
    } else {                                        // ARMED altı: bölüm bitti
      st.armed_at = null; st.confirmed_at = null;
    }
  }
  function _track(key, priceVerdict, derivVerdict, derivAvail, now) {
    let t = _trans.get(key);
    if (!t) { t = { price: { armed_at: null, confirmed_at: null }, deriv: { armed_at: null, confirmed_at: null } }; _trans.set(key, t); }
    _stepSide(t.price, priceVerdict, now);
    if (derivAvail) _stepSide(t.deriv, derivVerdict, now);  // deriv N/A ise bölümüne DOKUNMA (veri yokluğu ≠ düşüş)
    return t;
  }

  function verdictOf(score) {
    if (score == null || !Number.isFinite(+score)) return null;
    if (score >= CFG.CONFIRMED_MIN) return 'CONFIRMED';
    if (score >= CFG.ARMED_MIN) return 'ARMED';
    if (score >= CFG.WATCH_MIN) return 'WATCH';
    return null;
  }

  const _clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // ── Faktör 1: FUNDING ALIGNMENT (0-100) ────────────────────────────
  // Yön lehine/dengeli funding → yüksek; yön tarafı kalabalık → düşük.
  function _fundingScore(fund, dir) {
    if (!fund || fund.fund == null || !Number.isFinite(+fund.fund)) return null;
    const r = +fund.fund;                          // % / 8h
    const withDir = (dir === 'LONG') ? -r : r;     // + → rüzgar arkamızda
    let s;
    if (withDir >= 0.01) s = 90;                   // karşı taraf ödüyor
    else if (withDir >= -0.01) s = 65;             // dengeli
    else if (withDir >= -0.05) s = 40;             // bizim taraf ödüyor
    else s = 15;                                   // bizim taraf AŞIRI kalabalık
    return { score: _clamp(s), aligned: s >= 60, raw: r };
  }

  // ── Faktör 2: OI EXPANSION (0-100) ─────────────────────────────────
  // Taze pozisyon girişi hareketi besler (yönden bağımsız); soğuma zayıflatır.
  function _oiScore(oi) {
    if (!oi) return null;
    const c = (oi.oiChange4h != null && Number.isFinite(+oi.oiChange4h)) ? +oi.oiChange4h
            : (oi.oiChange24h != null && Number.isFinite(+oi.oiChange24h)) ? +oi.oiChange24h / 4 : null;
    if (c == null) return null;
    let s;
    if (c >= 1) s = 85 + Math.min(15, (c - 1) * 5);
    else if (c >= 0.25) s = 65;
    else if (c > -1) s = 50;
    else s = 30;                                   // belirgin soğuma
    return { score: _clamp(s), expanding: c >= 1, raw: c };
  }

  // ── Faktör 3: POSITIONING / SMART MONEY (0-100) ────────────────────
  // Top trader bizim yönde, retail karşıda → en güçlü; tersi → en zayıf.
  function _positioningScore(ls, top, dir) {
    if (!ls || !top || ls.longPct == null || top.longPct == null) return null;
    let diff = top.longPct - ls.longPct;           // + → top daha long
    if (dir === 'SHORT') diff = -diff;             // yönümüze çevir
    let s, ctx;
    if (diff >= 8)       { s = 88; ctx = 'SMART_WITH'; }
    else if (diff > -8)  { s = 55; ctx = 'NEUTRAL'; }
    else                 { s = 22; ctx = 'SMART_AGAINST'; }
    return { score: _clamp(s), context: ctx, topLong: top.longPct, retailLong: ls.longPct };
  }

  // ── Faktör 4: LIQUIDATION CONTEXT (0-100) ──────────────────────────
  // Fırtına sürüyorsa risk; karşı taraf yeni temizlendiyse yol daha açık.
  function _liquidationScore(liq, dir) {
    if (!liq || liq.total24h == null || !(liq.total24h > 0)) return null;
    const pace = liq.pace != null ? +liq.pace : null;
    const domWith = liq.dominant === dir;          // baskın tasfiye bizim taraf mı
    let s, ctx;
    if (pace != null && pace >= 1.6)        { s = 32; ctx = 'STORM'; }          // fırtına sürüyor
    else if (domWith && pace != null && pace >= 1) { s = 40; ctx = 'PRESSURE_WITH'; }
    else if (!domWith)                       { s = 75; ctx = 'CLEAN'; }         // karşı taraf süpürülmüş
    else                                     { s = 60; ctx = 'BALANCED'; }
    return { score: _clamp(s), context: ctx, pace: pace, dominant: liq.dominant };
  }

  // ── DerivScore: faktörleri topla + normalize ───────────────────────
  function _composeDeriv(parts) {
    const present = Object.keys(parts).filter(k => parts[k] != null);
    if (present.length < CFG.MIN_FACTORS) {
      return { score: null, available: false, factors: parts, nFactors: present.length };
    }
    let wSum = 0, acc = 0;
    present.forEach(k => { wSum += FW[k]; acc += FW[k] * parts[k].score; });
    return { score: _clamp(acc / wSum), available: true, factors: parts, nFactors: present.length };
  }

  async function _calcDeriv(sym, dir) {
    const CG = window.CoinGlassService;
    if (!CG || !CG.isEnabled || !CG.isEnabled()) {
      return { score: null, available: false, factors: {}, nFactors: 0 };
    }
    const r = await Promise.allSettled([
      CG.getFundingExtreme(sym), CG.getOI(sym),
      CG.getLSRatio(sym), CG.getTopTraderRatio(sym), CG.getLiquidation24h(sym),
    ]);
    const F = x => x.status === 'fulfilled' ? x.value : null;
    return _composeDeriv({
      funding:     _fundingScore(F(r[0]), dir),
      oi:          _oiScore(F(r[1])),
      positioning: _positioningScore(F(r[2]), F(r[3]), dir),
      liquidation: _liquidationScore(F(r[4]), dir),
    });
  }

  function _combine(priceScore, deriv) {
    const p = Number.isFinite(+priceScore) ? +priceScore : null;
    if (p == null) return null;
    const d = (deriv && deriv.available) ? deriv.score : null;
    const hybrid = d == null ? Math.round(p)
      : Math.round(CFG.W_PRICE * p + CFG.W_DERIV * d);
    return {
      price: Math.round(p), priceVerdict: verdictOf(p),
      deriv: deriv || { score: null, available: false, factors: {}, nFactors: 0 },
      derivVerdict: d == null ? null : verdictOf(d),
      hybrid: hybrid, hybridVerdict: verdictOf(hybrid),
      ts: Date.now(),
    };
  }

  // ── Public ─────────────────────────────────────────────────────────
  async function evaluate(sym, dir, priceScore) {
    const key = sym + '|' + (dir || '');
    _requested.add(key);
    const c = _cache.get(key);
    if (c && Date.now() - c.ts < CFG.TTL) {
      // taze deriv ile yeni price'ı birleştir (deriv 5 dk geçerli)
      const rec = _combine(priceScore, c.rec.deriv);
      if (rec) {
        rec.trans = _track(key, rec.priceVerdict, rec.derivVerdict, rec.deriv && rec.deriv.available, Date.now());
        _cache.set(key, { rec, ts: c.ts }); return rec;
      }
      return c.rec;
    }
    if (_inflight.has(key)) { await _inflight.get(key).catch(() => {}); return get(sym, dir) || _combine(priceScore, null); }
    const p = (async () => {
      const deriv = await _calcDeriv(sym, dir);
      const rec = _combine(priceScore, deriv);
      if (rec) {
        rec.trans = _track(key, rec.priceVerdict, rec.derivVerdict, rec.deriv && rec.deriv.available, Date.now());
        _cache.set(key, { rec, ts: Date.now() });
      }
      return rec;
    })();
    _inflight.set(key, p);
    try { return await p; } finally { _inflight.delete(key); }
  }

  function get(sym, dir) {
    const c = _cache.get(sym + '|' + (dir || ''));
    return (c && Date.now() - c.ts < CFG.TTL * 2) ? c.rec : null;
  }

  // Arşiv/araştırma kaydına eklenecek düz alanlar (Volkan onaylı şema)
  function payloadFields(rec) {
    if (!rec) return { research_period: CFG.RESEARCH_PERIOD };
    const f = rec.deriv && rec.deriv.factors ? rec.deriv.factors : {};
    const sub = k => (f[k] && f[k].score != null) ? f[k].score : null;
    return {
      price_score: rec.price, deriv_score: rec.deriv && rec.deriv.available ? rec.deriv.score : null,
      hybrid_score: rec.hybrid,
      price_verdict: rec.priceVerdict, deriv_verdict: rec.derivVerdict, hybrid_verdict: rec.hybridVerdict,
      deriv_available: !!(rec.deriv && rec.deriv.available),
      // Alt-faktör skorları AYRI alanlar (Volkan ek-1)
      funding_score: sub('funding'), oi_score: sub('oi'),
      positioning_score: sub('positioning'), liquidation_score: sub('liquidation'),
      deriv_factors: {
        funding_aligned: f.funding ? !!f.funding.aligned : null,
        funding_rate: f.funding ? f.funding.raw : null,
        oi_expanding: f.oi ? !!f.oi.expanding : null,
        oi_chg: f.oi ? f.oi.raw : null,
        positioning: f.positioning ? f.positioning.context : null,
        top_long: f.positioning ? f.positioning.topLong : null,
        retail_long: f.positioning ? f.positioning.retailLong : null,
        liq_context: f.liquidation ? f.liquidation.context : null,
        liq_pace: f.liquidation ? f.liquidation.pace : null,
        n_factors: rec.deriv ? rec.deriv.nFactors : 0,
      },
      research_period: CFG.RESEARCH_PERIOD,
      // ── 10. İŞ: geçiş damgaları + öncülük (pozitif = DERIV ÖNDE) ──
      price_armed_at: _iso(rec.trans && rec.trans.price.armed_at),
      price_confirmed_at: _iso(rec.trans && rec.trans.price.confirmed_at),
      deriv_armed_at: _iso(rec.trans && rec.trans.deriv.armed_at),
      deriv_confirmed_at: _iso(rec.trans && rec.trans.deriv.confirmed_at),
      deriv_lead_armed_min: _leadMin(rec.trans && rec.trans.deriv.armed_at, rec.trans && rec.trans.price.armed_at),
      deriv_lead_confirmed_min: _leadMin(rec.trans && rec.trans.deriv.confirmed_at, rec.trans && rec.trans.price.confirmed_at),
    };
  }
  function _iso(ms) { return (ms != null) ? new Date(ms).toISOString() : null; }
  function _leadMin(derivMs, priceMs) {
    if (derivMs == null || priceMs == null) return null;
    return Math.round((priceMs - derivMs) / 60000);   // + → deriv önce vardı
  }

  // Bu sym/dir bu oturumda Stage-2 değerlendirmesine girdi mi? (kart durum metni için)
  function requested(sym, dir) { return _requested.has(sym + '|' + (dir || '')); }

  return { evaluate, get, verdictOf, payloadFields, requested, CFG };
})();
