// ════════════════════════════════════════════════════════════════════
// TI MAJORS CARD — BTC ve ETH analizi
// ════════════════════════════════════════════════════════════════════
window.TIMajorsCard = (() => {
  'use strict';

  // i18n: korumalı çeviri (i18n.js yüklü değilse Türkçe yedeğe düşer)
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  // Narrator motoru Türkçe üretir; çizim anında anahtara çevrilir (motora dokunulmaz).
  var _STRUCTKEY = {
    'Yükseliş yapısı güçlü devam ediyor': 'nstruct.upStrong',
    'Yükseliş yapısı sağlam': 'nstruct.upHealthy',
    'Yükseliş yapısı yorgunluk gösteriyor': 'nstruct.upWeak',
    'Yükseliş yapısı aşırı uzamış': 'nstruct.upExh',
    'Yükseliş yapısı oluşuyor': 'nstruct.upForm',
    'Düşüş yapısı güçlü devam ediyor': 'nstruct.downStrong',
    'Düşüş yapısı sağlam': 'nstruct.downHealthy',
    'Düşüş yapısı momentum kaybediyor': 'nstruct.downWeak',
    'Düşüş yapısı aşırı uzamış': 'nstruct.downExh',
    'Düşüş yapısı oluşuyor': 'nstruct.downForm',
    'Net yönlü yapı yok': 'nstruct.flat'
  };
  var _SUMKEY = {
    'Uzama riski yüksek — yukarı yönlü görünümde temkin.': 'nsum.upExh',
    'Geri çekilme riski artıyor — kârı koru.': 'nsum.upWeak',
    'Trend devamı destekleniyor.': 'nsum.upStrong',
    'Devamlılık için yapıcı koşullar.': 'nsum.upHealthy',
    'Erken aşama hareket — onay bekle.': 'nsum.upEarly',
    'Ortalama dönüş riski — geç aşağı yönlü görünüm zayıf.': 'nsum.downExh',
    'Aşağı yön momentum kaybediyor — sıçrama mümkün.': 'nsum.downWeak',
    'Aşağı yön devamı destekleniyor.': 'nsum.downStrong',
    'Düşüş yönlü bias korunuyor.': 'nsum.downHealthy',
    'Erken aşama düşüş — onay bekle.': 'nsum.downEarly',
    'Yüksek volatiliteyle range — fakeout meyilli.': 'nsum.rangeHigh',
    'Yön konvansiyonu yok — sabır gerekli.': 'nsum.noConv'
  };
  var _VSKEY = {
    "ETH momentum BTC'den daha sağlam.": 'nvs.ethStronger',
    'BTC önde — ETH yönsel olarak geride.': 'nvs.btcAhead',
    'BTC ve ETH uyumlu.': 'nvs.aligned',
    'ETH, BTC gücüne karşı zayıf ayrışıyor.': 'nvs.ethWeakDiv',
    "ETH, BTC'ye göre göreceli güç gösteriyor.": 'nvs.ethRelStrength',
    'ETH önde, BTC sıkışıyor.': 'nvs.ethAhead',
    'ETH, BTC yönüne göre geride.': 'nvs.ethBehind'
  };
  function _trStruct(tr) { if (!tr) return ''; var k = _STRUCTKEY[tr]; return k ? _t(k, null, tr) : tr; }
  function _trSum(tr)    { if (!tr) return ''; var k = _SUMKEY[tr];    return k ? _t(k, null, tr) : tr; }
  function _trVs(tr)     { if (!tr) return ''; var k = _VSKEY[tr];     return k ? _t(k, null, tr) : tr; }

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _dirClass(d) {
    if (d === 'UP')   return 'up';
    if (d === 'DOWN') return 'down';
    return 'flat';
  }

  function _dirIcon(d) {
    if (d === 'UP')   return _t('dir.up', null, '▲ Yükseliş trendi');
    if (d === 'DOWN') return _t('dir.down', null, '▼ Düşüş trendi');
    return _t('dir.flat', null, '◇ Yatay');
  }

  function _renderCoin(sym, analysis) {
    if (!analysis) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_esc(sym)}</div>
          <div class="ti-empty">${_t('ti.majorEmpty', null, 'Veri yok.')}</div>
        </div>
      `;
    }

    const momClass  = 'mom-' + (analysis.momentum || 'building').toLowerCase();
    const riskClass = 'risk-' + (analysis.risk || 'moderate').toLowerCase();
    const dirCls    = _dirClass(analysis.dir);
    const dirTxt    = _dirIcon(analysis.dir);

    const vsLine = analysis.vsBTC
      ? `<div class="ti-major-vs">${_esc(_trVs(analysis.vsBTC))}</div>`
      : '';

    return `
      <div class="ti-card">
        <div class="ti-card-label">
          <span class="ti-card-label-dot"></span>
          ${_esc(sym)}
        </div>
        <div class="ti-major">
          <div class="ti-major-top">
            <span class="ti-major-sym">${_esc(sym)}</span>
            <span class="ti-major-dir ${dirCls}">${_esc(dirTxt)}</span>
          </div>
          <div class="ti-major-structure">${_esc(_trStruct(analysis.structure || ''))}</div>
          <div class="ti-major-summary">${_esc(_trSum(analysis.summary || ''))}</div>
          <div class="ti-major-stats">
            <span class="ti-major-stat">Momentum: <b class="${momClass}">${_esc(_momentumTR(analysis.momentum))}</b></span>
            <span class="ti-major-stat">Risk: <b class="${riskClass}">${_esc(_riskTR(analysis.risk))}</b></span>
          </div>
          ${vsLine}
        </div>
      </div>
    `;
  }

  function _momentumTR(m) { return m ? _t('mom.' + m, null, m) : '—'; }

  function _riskTR(r) { return r ? _t('risk.' + r, null, r) : '—'; }

  function render(btcAnalysis, ethAnalysis) {
    return `
      <div class="ti-row-2">
        ${_renderCoin('BTC', btcAnalysis)}
        ${_renderCoin('ETH', ethAnalysis)}
      </div>
    `;
  }

  return { render };
})();
