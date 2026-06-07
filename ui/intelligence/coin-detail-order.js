// ════════════════════════════════════════════════════════════════
// coin-detail-order.js  ·  Build 150
// Coin Detail / analiz yığını (#mainPanel) panel SIRASI düzenleyici.
//
// AMAÇ: Coin açılınca AI yön özeti grafiğin HEMEN ALTINA gelsin; ardından
//   mantık sırası → Entry → Risk → Funding/OI → pozisyon → yapı/seviye
//   (SMC · S/R · formasyon · indikatör) → AI ekstra / öğrenme.
//
// GÜVENLİK (önemli):
//   • İki grafik kabı (.tv-wrap ve #lwcPanel), "Analiz Modu" çubuğu
//     (#sigCardPanel) ve zaman damgası (#tsEl) ASLA oynatılmaz.
//   • Grafik DOM'dan koparılırsa boş kalabildiği için (TradingView / LWC),
//     paneller #lwcPanel'in ARDINA insertBefore ile eklenir — grafiğe
//     hiç dokunulmaz.
//   • Hiçbir panel silinmez, hiçbir motor / skor / veri değişmez.
//     Sadece DOM sırası değişir. Geri almak = bu script satırını kaldırmak.
// ════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Yerinden oynatılmayacak sabit kaplar (grafikler + mod çubuğu + ts)
  function isAnchor(el) {
    var id = el.id || '';
    var cls = el.className || '';
    return (cls.indexOf('tv-wrap') > -1) || id === 'sigCardPanel' ||
           id === 'lwcPanel' || id === 'tsEl';
  }

  function titleText(el) {
    var t = el.querySelector('.gc-title') || el.querySelector('h2, h3') || el;
    return ((t && t.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  // Küçük rank = üstte. Aynı rank içinde orijinal sıra korunur (kararlı).
  function rank(el) {
    var id = el.id || '';
    var cls = el.className || '';
    var tt = titleText(el);

    // 1) AI yön özeti — grafiğin hemen altı
    if (cls.indexOf('analysis-panel') > -1 && cls.indexOf('analytics') < 0) return 10; // YÖN EĞİLİMİ / GÜVEN / RİSK özeti
    if (id === 'aiDecisionSection') return 11;                                          // AI Yön Değerlendirmesi
    // 2) Entry
    if (id === 'ecePanel') return 20;                                                   // Entry Confirmation Engine
    // 3) Risk
    if (id === 'riskEngineProCard') return 30;                                          // Risk Engine Pro
    if (id === 'riskEngineSection') return 31;                                          // Risk Engine — AI Önerisi
    if (id === 'tradeManSection') return 32;                                            // Risk Yönetimi AI
    // 4) Funding / OI
    if (id === 'oiFundSection') return 40;                                              // Open Interest & Funding
    // 5) Pozisyonlar
    if (/Pozisyon/.test(tt)) return 45;                                                 // Long / Short Pozisyonlar
    // 6) Yapı & seviyeler (destekleyici)
    if (id === 'smcProCard') return 50;                                                 // Smart Money Concepts Pro
    if (id === 'smcPanel') return 51;                                                   // Smart Money & Liquidity
    if (/Destek|Diren/.test(tt)) return 52;                                             // Destek & Direnç
    if (/Formasyon/.test(tt)) return 53;                                                // Tespit Edilen Formasyonlar
    if (id === 'fbDetectorCard') return 54;                                             // Fake Breakout Dedektörü
    if (/ndikat/.test(tt)) return 55;                                                   // Teknik İndikatörler
    if (id === 'intelligenceSection') return 56;                                        // Market Intelligence
    // 7) AI ekstra / öğrenme (en altta; çoğu zaten Perf workspace'e taşınır)
    if (id === 'analyticsPanel') return 80;                                             // Performance Analytics
    if (/Claude|AI Analiz/.test(tt)) return 81;                                         // AI Analiz — Claude.ai
    // Eşleşmeyen panel: orta-alt, orijinal sırasında kalsın
    return 70;
  }

  function reorder() {
    try {
      var mp = document.getElementById('mainPanel');
      if (!mp) return;
      var lwc = document.getElementById('lwcPanel'); // grafik = çıpa (taşınmaz)
      if (!lwc || lwc.parentNode !== mp) return;     // grafik beklenen yerde değilse hiç dokunma

      var kids = Array.prototype.slice.call(mp.children);
      var movable = [];
      for (var i = 0; i < kids.length; i++) {
        if (!isAnchor(kids[i])) movable.push({ el: kids[i], r: rank(kids[i]), i: i });
      }
      movable.sort(function (a, b) { return (a.r - b.r) || (a.i - b.i); });

      // Panelleri grafiğin (lwc) ARDINA, hesaplanan sırayla yerleştir.
      var prev = lwc;
      for (var j = 0; j < movable.length; j++) {
        var el = movable[j].el;
        if (el === prev) continue;
        if (prev.nextElementSibling !== el) mp.insertBefore(el, prev.nextSibling);
        prev = el;
      }

      // Zaman damgası en altta kalsın
      var ts = document.getElementById('tsEl');
      if (ts && ts.parentNode === mp && mp.lastElementChild !== ts) mp.appendChild(ts);
    } catch (e) { /* sessiz geç — sıralama kritik değil, asla sayfayı bozmasın */ }
  }

  function schedule() {
    reorder();
    // diğer modüller (control-center ~700ms, perf/ai workspace) yerleştikten
    // sonra birkaç idempotent tekrar — zaten sıralıysa hiçbir şey oynatmaz.
    [400, 1000, 2000].forEach(function (d) { setTimeout(reorder, d); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  window.addEventListener('load', reorder);
  window.addEventListener('pageshow', function () { setTimeout(reorder, 60); }); // bfcache geri dönüş

  // Dışarıdan elle tetikleme (gerekirse)
  window.VDCoinDetailOrder = { reorder: reorder };
})();
