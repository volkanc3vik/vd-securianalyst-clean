// ════════════════════════════════════════════════════════════════════
// FUTURES LIQUIDATION ENGINE
// Binance Futures USDT-M perpetual likidasyon mantığı (basitleştirilmiş).
//
// ISOLATED:
//   Sadece pozisyonun kendi marginini risk altında tutar.
//   liqPrice = entry × (1 ± (1 - MMR) / leverage)   [yaklaşık]
//   Daha hassas: cüzdandaki maintenance margin'i çıkararak.
//
// CROSS:
//   Tüm cüzdan bakiyesi pozisyona destek olur.
//   Cüzdandaki "kullanılabilir bakiye" da margin'e eklenir gibi davranır.
//   liqPrice = entry × (1 ± (margin + freeBalance × bufferFactor) / size + MMR)
//
// MMR (Maintenance Margin Rate): leverage'a göre kademeli.
//   Burada basit bir lookup: yüksek lev → yüksek MMR.
// ════════════════════════════════════════════════════════════════════
window.FuturesLiquidation = (() => {
  'use strict';

  /**
   * Binance benzeri maintenance margin rate (USDT-M Perpetual, yaklaşık).
   * Notional size'a değil, leverage'a göre basitleştirilmiş tablo.
   * Gerçek Binance tablosu çok daha detaylı; bu eğitim/simülasyon amaçlı yaklaşım.
   *
   * Tier 1 (BTC, ETH gibi major pair'ler, küçük pozisyonlar) referans alındı.
   */
  function maintMarginRate(leverage) {
    const l = +leverage || 1;
    if (l <= 5)   return 0.004;   // %0.4
    if (l <= 10)  return 0.005;   // %0.5
    if (l <= 20)  return 0.005;   // %0.5
    if (l <= 25)  return 0.005;   // %0.5
    if (l <= 50)  return 0.0065;  // %0.65
    if (l <= 75)  return 0.0075;  // %0.75
    if (l <= 100) return 0.0075;  // %0.75
    return 0.01;                  // 100x+ : %1.0
  }

  /**
   * ISOLATED mode liquidation price.
   *
   * Mantık:
   *   PNL_liq = -(margin - maintenanceMargin)
   *   qty × (liq - entry) = PNL_liq    (LONG için)
   *   liq = entry - (margin - mm) / qty
   *
   *   mm = size × MMR = entry × qty × MMR
   *   → LONG  : liq = entry × (1 - 1/lev + MMR)
   *   → SHORT : liq = entry × (1 + 1/lev - MMR)
   */
  function isolatedLiqPrice({ dir, entry, leverage }) {
    const e = +entry, l = +leverage;
    if (!Number.isFinite(e) || e <= 0) return 0;
    if (!Number.isFinite(l) || l <= 0) return 0;

    const mmr     = maintMarginRate(l);
    const isLong  = (dir || '').toUpperCase() === 'LONG';
    const factor  = (1 / l) - mmr;   // pozitif kalmalı; çok yüksek lev'de mmr büyüyor

    if (factor <= 0) {
      // teorik olarak hemen liquid — entry'ye çok yakın
      return isLong ? e * 0.999 : e * 1.001;
    }

    const liq = isLong ? e * (1 - factor) : e * (1 + factor);
    return +liq.toFixed(8);
  }

  /**
   * CROSS mode liquidation price.
   *
   * Tüm cüzdan bakiyesi pozisyonu destekler:
   *   etkin_margin = margin + freeBalance
   *   freeBalance = walletBalance - (diğer pozisyonların toplam margini) - bu pozisyonun margini
   *
   * @param {Object} p
   *   - dir, entry, leverage, margin
   *   - walletBalance: toplam cüzdan
   *   - usedMargin: bu pozisyon HARİÇ kullanılan toplam margin (varsa)
   */
  function crossLiqPrice({ dir, entry, leverage, margin, walletBalance, usedMargin = 0 }) {
    const e = +entry, l = +leverage, m = +margin, w = +walletBalance, u = +usedMargin;
    if (!Number.isFinite(e) || e <= 0) return 0;
    if (!Number.isFinite(l) || l <= 0) return 0;
    if (!Number.isFinite(m) || m <= 0) return 0;
    if (!Number.isFinite(w) || w < 0)  return 0;

    // Free balance = cüzdan - başka pozisyonlardaki margin - bu pozisyonun margini
    const free = Math.max(0, w - u - m);
    // Etkin margin: pozisyon margini + serbest bakiye desteği
    // (Binance gerçekte unrealized PNL'i de katar; biz pozisyonun açılış anını hesaplıyoruz)
    const effectiveMargin = m + free;

    // size = margin × leverage; qty = size / entry
    const size = m * l;
    const qty  = size / e;
    if (qty <= 0) return 0;

    const mmr = maintMarginRate(l);
    const mm  = size * mmr;  // maintenance margin

    // Liq olduğunda: effectiveMargin + qty × (liq - entry) [LONG] = mm
    //   → liq = entry + (mm - effectiveMargin) / qty
    //   LONG: mm < effectiveMargin → liq < entry (mantıklı)
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const liq = isLong
      ? e + (mm - effectiveMargin) / qty
      : e - (mm - effectiveMargin) / qty;

    // Sınırla — negatif fiyat olmaz
    return +Math.max(0, liq).toFixed(8);
  }

  /**
   * Mod'a göre doğru hesaplamayı seç.
   * @param {Object} params - { mode, dir, entry, leverage, margin, walletBalance, usedMargin }
   */
  function compute(params) {
    const mode = (params.mode || 'CROSS').toUpperCase();
    if (mode === 'ISOLATED') {
      return isolatedLiqPrice(params);
    }
    return crossLiqPrice(params);
  }

  /**
   * Hem LONG hem SHORT için tahmini liq fiyatları döner (modal'da preview için).
   */
  function preview(params) {
    return {
      long:  compute({ ...params, dir: 'LONG'  }),
      short: compute({ ...params, dir: 'SHORT' }),
      mmr:   maintMarginRate(params.leverage),
    };
  }

  /**
   * Pozisyonun likidasyona ne kadar yakın olduğu (yüzde).
   * Düşük değer = tehlike. Mark price → liq mesafesi entry'ye göre.
   */
  function distanceToLiqPct(markPrice, liqPrice, entry) {
    const m = +markPrice, l = +liqPrice, e = +entry;
    if (!Number.isFinite(m) || !Number.isFinite(l) || !Number.isFinite(e) || e === 0) return 100;
    return +(Math.abs(m - l) / e * 100).toFixed(2);
  }

  return {
    maintMarginRate,
    isolatedLiqPrice,
    crossLiqPrice,
    compute,
    preview,
    distanceToLiqPct,
  };
})();
