// ════════════════════════════════════════════════════════════════════
// TI REGIME CARD — Market Regime + MM Bias üst sıra
// Sunum katmanı; state mutate etmez.
// ════════════════════════════════════════════════════════════════════
window.TIRegimeCard = (() => {
  'use strict';

  // i18n: korumalı çeviri (i18n.js yüklü değilse Türkçe yedeğe düşer)
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  // Motor Türkçe üretir; çizim anında anahtara çevrilir (motora dokunulmaz).
  // Her iki CHOPPY varyantı ayrı anahtarla ele alınır.
  var _SUMKEY = {
    'Net bir yön yok. Kırılım kovalamak yerine sabırlı ol.': 'regime.sum.choppy1',
    'Karışık teknik görünüm. Konfluans için gözlem önerilir.': 'regime.sum.choppy2',
    'Trend devamı destekleniyor. Geri çekilmeler yukarı yönlü görünüm sunabilir.': 'regime.sum.riskon',
    'Aşağı yönlü baskı sürüyor. Trende karşı long yüksek riskli.': 'regime.sum.riskoff',
    'Net trend yok ama volatilite yüksek. Fakeout riski yüksek.': 'regime.sum.liqtrap',
    'Trend var ama genişlik dar. Sadece seçici longlar.': 'regime.sum.riskonfragile',
    'Aşağı yön korunuyor ama tükenme işaretleri var. Geç aşağı yönlü görünüm riski artabilir.': 'regime.sum.riskofffragile'
  };
  var _MMKEY = {
    'Funding aşırı ısınmış — long kalabalığı risk altında.': 'mm.h.overLong',
    'Geç longlar likidasyon zincirine açık.': 'mm.d.overLong',
    'Funding aşırı negatif — short squeeze koşulları oluşuyor.': 'mm.h.overShort',
    'Short tarafı aşırı uzamış; ralliler shortları kapatmaya zorlayabilir.': 'mm.d.overShort',
    'Yükseliş short kapatmalarıyla sürüyor, yeni longlarla değil.': 'mm.h.squeezeRally',
    'OI desteği olmadan ralli kalitesi şüpheli.': 'mm.d.squeezeRally',
    'Zayıflıkta shortlar birikiyor — squeeze yakıtı toplanıyor.': 'mm.h.shortBuildup',
    'Likidite fiyatın üzerinde — devamlılık için doğal hedef.': 'mm.h.liqAboveTarget',
    'Üst taraftaki likidite hedefleri henüz vurulmadı.': 'mm.d.liqAboveTarget',
    'Likidite fiyatın üzerinde birikiyor — long tuzakları mümkün.': 'mm.h.liqAboveTrap',
    'Piyasa dönüş öncesi agresif longları avlayabilir.': 'mm.d.liqAboveTrap',
    'Likidite fiyatın altında — aşağı yön hedefleri vurulmadı.': 'mm.h.liqBelow',
    'Altta stoplar bekliyor — dönüş öncesi sweep riski var.': 'mm.h.belowStops',
    'Geç shortlar avlanabilir.': 'mm.d.belowStops',
    'Trend gerçek long pozisyonlarıyla destekleniyor.': 'mm.h.trendLong',
    'Trend gerçek short pozisyonlarıyla destekleniyor.': 'mm.h.trendShort',
    'Yön konvansiyonu yok — yapının oluşmasını bekle.': 'mm.h.noConv',
    'Piyasa davranışı mevcut trendle uyumlu.': 'mm.h.aligned',
    'Funding long tarafında yüksek seviyede.': 'mm.d.elevLong',
    'Funding short tarafında yüksek seviyede.': 'mm.d.elevShort'
  };

  function _trSummary(tr) {
    if (!tr) return '';
    var key = _SUMKEY[tr];
    return key ? _t(key, null, tr) : tr;
  }
  function _trMM(tr) {
    if (!tr) return '';
    var key = _MMKEY[tr];
    return key ? _t(key, null, tr) : tr;
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderRegime(regime) {
    if (!regime) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_t('ti.regimeLabel', null, 'PİYASA REJİMİ')}</div>
          <div class="ti-empty">${_t('ti.waitingScan', null, 'Tarama verisi bekleniyor...')}</div>
        </div>
      `;
    }

    const color = regime.color || 'yellow';
    const labelTxt = regime.code
      ? _t('regime.label.' + regime.code, null, regime.label || regime.code)
      : (regime.label || _t('ti.regimeUnknown', null, 'Bilinmiyor'));
    const sumTxt = _trSummary(regime.summary || '');

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_t('ti.regimeLabel', null, 'PİYASA REJİMİ')}</div>
        <div class="ti-regime">
          <span class="ti-regime-badge ${_esc(color)}">
            <span class="ti-regime-badge-dot"></span>
            ${_esc(labelTxt)}
          </span>
          <div class="ti-regime-summary">${_esc(sumTxt)}</div>
        </div>
      </div>
    `;
  }

  function renderMMBias(mmBias) {
    if (!mmBias || !mmBias.headline) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_t('ti.mmLabel', null, 'MARKET MAKER YÖNELİMİ')}</div>
          <div class="ti-empty">${_t('ti.mmEmpty', null, 'Henüz net konumlanma yok.')}</div>
        </div>
      `;
    }

    const details = Array.isArray(mmBias.detail) && mmBias.detail.length
      ? `<ul class="ti-mm-detail">${mmBias.detail.map(d => `<li>${_esc(_trMM(d))}</li>`).join('')}</ul>`
      : '';

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_t('ti.mmLabel', null, 'MARKET MAKER YÖNELİMİ')}</div>
        <div class="ti-mm-headline">${_esc(_trMM(mmBias.headline))}</div>
        ${details}
      </div>
    `;
  }

  return { renderRegime, renderMMBias };
})();
