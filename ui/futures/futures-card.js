// ════════════════════════════════════════════════════════════════════
// FUTURES CARD — Aktif Pozisyon Kart Render'ı
// 3x3 metrik grid + canlı price bar + TP/SL hit animasyonları.
// Sadece sunum katmanı; state mutasyonu yapmaz.
// ════════════════════════════════════════════════════════════════════
window.FuturesCard = (() => {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  // Format yardımcısı
  function _fmt(v, d = 2) {
    if (v === null || v === undefined || !Number.isFinite(+v)) return '—';
    return (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  // Fiyatın büyüklüğüne göre uygun ondalık
  function _autoDecimals(price) {
    const p = Math.abs(+price);
    if (!Number.isFinite(p) || p === 0) return 2;
    if (p >= 1000) return 2;
    if (p >= 10)   return 3;
    if (p >= 1)    return 4;
    if (p >= 0.01) return 5;
    return 7;
  }

  function _fmtPrice(v) {
    return _fmt(v, _autoDecimals(v));
  }

  function _fmtQty(qty, sym) {
    return _fmt(qty, qty >= 1 ? 4 : 6) + ' ' + (sym || '');
  }

  function _duration(openTs) {
    const s = Math.floor((Date.now() - (+openTs || Date.now())) / 1000);
    if (s < 60)   return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h + 'h ' + m + 'm';
  }

  // Sağlık etiketi (üst şeritte gözüken pill)
  function _healthLabel(p, distLiqPct, zone) {
    const FL = window.FuturesLiquidation;
    const liqDistPct = distLiqPct;

    if (liqDistPct < 1.5)  return { cls: 'liq', text: '⚠ '+_t('fut.liqNear',null,'LİKİDASYON YAKIN') };
    if (p.slHit)           return { cls: 'sl',  text: '🛑 STOP HIT' };
    if (p.tp3Hit)          return { cls: 'tp',  text: '🏆 TP3 HIT' };
    if (p.tp2Hit)          return { cls: 'tp',  text: '🏆 TP2 HIT' };
    if (p.tp1Hit)          return { cls: 'tp',  text: '🎯 TP1 HIT' };
    if (liqDistPct < 5)    return { cls: 'sl',  text: '⚠ '+_t('fut.liqZone',null,'LİK. BÖLGESİ') };
    return null;
  }

  // Zone'a göre alt mesaj
  function _statusMsg(zone, dir, p) {
    if (p.slHit)  return '🛑 '+_t('fut.stStopHit',null,'Stop seviyesi geçildi.');
    if (p.tp3Hit) return '🏆 '+_t('fut.stTp3',null,'TP3 hedefine ulaşıldı — kâr kilitle.');
    if (p.tp2Hit) return '🎯 '+_t('fut.stTp2',null,'TP2 hedefine ulaşıldı — TP3 izle.');
    if (p.tp1Hit) return '🎯 '+_t('fut.stTp1',null,'TP1 hedefine ulaşıldı — TP2 izle.');
    switch (zone) {
      case 'STOP':       return '⚠ '+_t('fut.zStop',null,'Stop bölgesi — risk yüksek.');
      case 'PRE_ENTRY':  return '⚡ '+_t('fut.zPre',null,'Referans bölgesinde — gözlem.');
      case 'IN_PROFIT':  return '📈 '+_t('fut.zProfit',null,'Kâr bölgesinde — momentum izle.');
      case 'PROFIT_1':   return '🎯 '+_t('fut.zTp1',null,'TP1 bölgesinde.');
      case 'PROFIT_2':   return '🏆 '+_t('fut.zTp2',null,'TP2 bölgesinde.');
      case 'PROFIT_3':   return '🚀 '+_t('fut.zTp3',null,'TP3 bölgesinde — hedef yakın.');
      case 'BEYOND':     return '🚀 '+_t('fut.zBeyond',null,'TP hedefini geçti.');
      default:           return '⚡ '+_t('fut.zActive',null,'Pozisyon aktif.');
    }
  }

  // ── Price Bar render ──────────────────────────────────────────────
  function _renderBar(p) {
    const FP = window.FuturesPnl;
    const pos = FP.priceBarPosition(p.dir, p.entry, p.markPrice, p.sl, p.tp1, p.tp2, p.tp3);

    const isLong = p.dir === 'LONG';
    const inProfit = pos.entryPct !== null && pos.pct !== null && pos.pct >= pos.entryPct;
    const markerCls = inProfit ? 'profit' : 'loss';

    // Level marker'ları
    const levels = [];
    if (p.sl)  levels.push({ cls: 'sl',    pct: 0,            label: 'SL',  price: p.sl,  hit: !!p.slHit });
    if (pos.entryPct !== null) {
      levels.push({ cls: 'entry', pct: pos.entryPct, label: 'Entry', price: p.entry, hit: false });
    }
    if (p.tp1 && pos.tp1Pct !== null) levels.push({ cls: 'tp1', pct: pos.tp1Pct, label: 'TP1', price: p.tp1, hit: !!p.tp1Hit });
    if (p.tp2 && pos.tp2Pct !== null) levels.push({ cls: 'tp2', pct: pos.tp2Pct, label: 'TP2', price: p.tp2, hit: !!p.tp2Hit });
    if (p.tp3 && pos.tp3Pct !== null) levels.push({ cls: 'tp3', pct: pos.tp3Pct, label: 'TP3', price: p.tp3, hit: !!p.tp3Hit });

    const markersHtml = levels.map(l => `
      <div class="fp-bar-level ${l.cls} ${l.hit ? 'hit' : ''}" style="left:${l.pct}%">
        <div class="fp-bar-level-tick"></div>
        <div class="fp-bar-level-label">${l.label}</div>
        <div class="fp-bar-level-price">$${_fmtPrice(l.price)}</div>
      </div>
    `).join('');

    // Üst label sırası (sol→sağ)
    const labelsHtml = `
      <span>${p.sl ? 'SL $' + _fmtPrice(p.sl) : ''}</span>
      <span>${p.tp3 ? 'TP3 $' + _fmtPrice(p.tp3) : (p.tp2 ? 'TP2 $' + _fmtPrice(p.tp2) : '')}</span>
    `;

    const markerPct = pos.pct !== null ? pos.pct : 50;

    return `
      <div class="fp-bar-wrap">
        <div class="fp-bar-labels">${labelsHtml}</div>
        <div class="fp-bar-track">
          <div class="fp-bar-bg">
            <div class="fp-bar-zone-sl" style="width:${pos.entryPct || 0}%"></div>
            <div class="fp-bar-zone-profit" style="left:${pos.entryPct || 0}%; right:0"></div>
          </div>
          ${markersHtml}
          <div class="fp-bar-marker ${markerCls}" style="left:${markerPct}%">
            <div class="fp-bar-marker-dot"></div>
            <div class="fp-bar-marker-price">$${_fmtPrice(p.markPrice)}</div>
          </div>
        </div>
        <div class="fp-status">
          <div class="fp-status-msg">${_statusMsg(pos.zone, p.dir, p)}</div>
          <div class="fp-status-legend">
            <span><i style="background:rgba(255,61,107,.5)"></i>${_t('fut.slZone',null,'SL Bölgesi')}</span>
            <span><i style="background:rgba(0,229,160,.5)"></i>${_t('fut.profitZone',null,'Kâr Bölgesi')}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Üst şerit ─────────────────────────────────────────────────────
  function _renderTop(p, healthLabel) {
    const dirCls = p.dir === 'LONG' ? 'long' : 'short';
    const dirIcon = p.dir === 'LONG' ? '▲ LONG' : '▼ SHORT';
    const warnHtml = healthLabel
      ? `<span class="fp-warn ${healthLabel.cls}">${healthLabel.text}</span>`
      : '';

    return `
      <div class="fp-card-top">
        <span class="fp-sym">${p.symFull || (p.sym + 'USDT')}</span>
        <span class="fp-meta">Perp · ${p.mode === 'CROSS' ? 'Cross' : 'Iso'} · ${p.lev}x</span>
        <span class="fp-pill ${dirCls}">${dirIcon}</span>
        ${warnHtml}
        <span class="fp-duration" data-duration="${p.openTs}">⏱ ${_duration(p.openTs)}</span>
        <button class="fp-btn-close" data-close-id="${p.id}">${_t('fut.close',null,'Kapat')} ✕</button>
      </div>
    `;
  }

  // ── 3x3 Grid ──────────────────────────────────────────────────────
  function _renderGrid(p) {
    const pnl    = +p.pnl   || 0;
    const roi    = +p.roi   || 0;
    const ratio  = +p.marginRatio || 0;
    const pnlCls = pnl >= 0 ? 'pos' : 'neg';
    const roiCls = roi >= 0 ? 'pos' : 'neg';
    const ratioCls = ratio > 80 ? 'crit' : ratio > 50 ? 'warn' : 'muted';

    return `
      <div class="fp-grid">

        <div class="fp-cell hero">
          <div class="fp-cell-label">PNL (USDT)</div>
          <div class="fp-cell-val ${pnlCls}">${pnl >= 0 ? '+' : ''}${_fmt(pnl, 2)}</div>
        </div>

        <div class="fp-cell hero">
          <div class="fp-cell-label">ROI</div>
          <div class="fp-cell-val ${roiCls}">${roi >= 0 ? '+' : ''}${_fmt(roi, 2)}%</div>
        </div>

        <div class="fp-cell hero">
          <div class="fp-cell-label">MARGIN RATIO</div>
          <div class="fp-cell-val ${ratioCls}">%${_fmt(ratio, 1)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">SIZE (USDT)</div>
          <div class="fp-cell-val muted">${_fmt(p.size || (p.margin * p.lev), 2)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">MARK PRICE</div>
          <div class="fp-cell-val">${_fmtPrice(p.markPrice)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">MARGIN</div>
          <div class="fp-cell-val muted">${_fmt(p.margin, 2)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">ENTRY PRICE</div>
          <div class="fp-cell-val muted">${_fmtPrice(p.entry)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">${_t('fut.qty',null,'MİKTAR')}</div>
          <div class="fp-cell-val muted">${_fmtQty(p.qty, p.sym)}</div>
        </div>

        <div class="fp-cell">
          <div class="fp-cell-label">LIQ. PRICE</div>
          <div class="fp-cell-val warn">${_fmtPrice(p.liq)}</div>
        </div>

      </div>
    `;
  }

  // ── Kart toplam render ────────────────────────────────────────────
  /**
   * @param {Object} p - pozisyon objesi
   * @returns {string} HTML
   */
  function render(p) {
    if (!p) return '';
    const FL = window.FuturesLiquidation;
    const distLiqPct = FL.distanceToLiqPct(p.markPrice, p.liq, p.entry);
    const FP = window.FuturesPnl;
    const barPos = FP.priceBarPosition(p.dir, p.entry, p.markPrice, p.sl, p.tp1, p.tp2, p.tp3);

    const health = _healthLabel(p, distLiqPct, barPos.zone);
    const dirCls = p.dir === 'LONG' ? 'long' : 'short';
    const liqWarn = distLiqPct < 1.5 ? 'warn-liq' : '';

    return `
      <div class="fp-card ${dirCls} ${liqWarn}" data-id="${p.id}">
        ${_renderTop(p, health)}
        ${_renderGrid(p)}
        ${_renderBar(p)}
      </div>
    `;
  }

  /**
   * Sadece duration alanını güncelle (tüm karta gerek yok — flicker engellenir).
   * Panel her saniye çağırır.
   */
  function tickDuration(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-duration]').forEach(el => {
      const ts = +el.dataset.duration;
      el.textContent = '⏱ ' + _duration(ts);
    });
  }

  return { render, tickDuration };
})();
