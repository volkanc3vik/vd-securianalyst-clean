// ════════════════════════════════════════════════════════════════════
// VDArchive · DETAIL MODAL
// open(id) → getArchiveById → render. ESC / dış tıklama / kapat butonu.
// Erişilebilir: role=dialog, focus, body scroll-lock.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = NS.util;
  const OVERLAY_ID = 'aic-modal-overlay';
  let _escHandler = null;
  let _lastFocus = null;

  function _close() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    document.body.style.overflow = '';
    if (_escHandler) { document.removeEventListener('keydown', _escHandler); _escHandler = null; }
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} }
    if (location.hash.indexOf('id=') !== -1) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function _kv(k, v, cls) {
    return `<div class="aic-kv"><div class="k">${U.esc(k)}</div><div class="v ${cls || ''}">${U.esc(v)}</div></div>`;
  }

  // Saatli tarih: "30 Mayıs 2026 02:49"
  function _fmtDT(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return date + ' ' + time;
    } catch (e) { return String(iso); }
  }

  // 3 bağımsız zaman: Analiz (created_at), İnceleme (reviewed_at), Telegram Paylaşım (shared_at).
  // Boş olanın satırı GÖSTERİLMEZ. created_at ASLA reviewed_at yerine kullanılmaz.
  // ── OUTCOME INTELLIGENCE bloğu (alanlar kayıtta varsa; yoksa hiç görünmez) ──
  function _oiHTML(rec) {
    const os = rec.outcome_status;
    if (!os || os === 'pending') return '';
    const QM = {
      clean_confirmed:            { t: _t('rp.qClean', null, 'Temiz Confirm'),           c: '#36d399' },
      confirmed_then_reversed:    { t: _t('rp.qReversed', null, 'Confirm → Geri Döndü'), c: '#ff8a3d' },
      invalidated_then_recovered: { t: _t('rp.qRecovered', null, 'Invalid → Toparladı'), c: '#00d4ff' },
      clean_invalidated:          { t: _t('rp.qCleanInv', null, 'Temiz Invalid'),        c: '#9aa4b2' },
    };
    const q = QM[rec.outcome_quality];
    const pct = (v) => (v != null && !isNaN(Number(v))) ? ((Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%') : null;
    const li = (k, v, col) => v != null ? `<div class="aic-oi-row"><span class="k">${k}</span><span class="v"${col ? ` style="color:${col}"` : ''}>${v}</span></div>` : '';
    const osTxt = os === 'confirmed' ? 'CONFIRMED' : os === 'invalidated' ? 'INVALIDATED' : String(os).toUpperCase();
    const osCol = os === 'confirmed' ? '#36d399' : os === 'invalidated' ? '#f85149' : 'var(--v4-text-2)';
    const mae = rec.max_adverse_move_pct;
    return `<div class="aic-oi" data-aic-oi>
      <div class="aic-oi-title">${_t('arc.oiTitle', null, 'OUTCOME INTELLIGENCE')}</div>
      ${li(_t('arc.oiOutcome', null, 'Outcome'), osTxt, osCol)}
      ${q ? li(_t('arc.oiQuality', null, 'Outcome Quality'), q.t, q.c) : ''}
      ${li('MFE', pct(rec.max_favorable_move_pct), '#3fb950')}
      ${li('MAE', mae != null ? pct(-Math.abs(Number(mae))) : null, '#f85149')}
      ${li(_t('arc.oiClose', null, 'Window Close'), pct(rec.window_close_pct), (rec.window_close_pct != null && rec.window_close_pct >= 0) ? '#3fb950' : '#f85149')}
      ${li(_t('arc.oiTtc', null, 'Time To Confirm'), rec.time_to_confirm_min != null ? rec.time_to_confirm_min + ' dk' : null)}
      ${li(_t('arc.oiTti', null, 'Time To Invalid'), rec.time_to_invalid_min != null ? rec.time_to_invalid_min + ' dk' : null)}
    </div>`;
  }

  function _timesHTML(rec) {
    const row = (icon, label, iso) =>
      `<div class="aic-time-row"><span class="ic">${icon}</span><span class="k">${label}</span><span class="v">${U.esc(_fmtDT(iso))}</span></div>`;
    let rows = row('📅', 'Analiz Tarihi', rec.created_at);
    if (rec.reviewed_at) rows += row('📊', _t('arc.reviewDate', null, 'İnceleme Tarihi'), rec.reviewed_at);
    if (rec.shared_at)   rows += row('📤', _t('arc.tgDate', null, 'Telegram Paylaşım Tarihi'), rec.shared_at);
    return `<div class="aic-times" data-aic-times>${rows}</div>`;
  }

  // PHASE 3: teaser oturumunda linkteki coin dışı kayıt engellenir
  function _teaserBlocked(rec) {
    try {
      if (!rec || !window.VDAccess || !window.VDTeaser) return false;
      if (window.VDAccess.level() !== 'teaser') return false;
      const co = window.VDTeaser.coinOf;
      return co(rec.sym) !== co(window.VDTeaser.symbol());
    } catch (e) { return false; }
  }

  function _render(rec) {
    const m = U.statusMeta(rec.review_status);
    const reviewed = rec.review_status && rec.review_status !== 'pending';

    const kvCells = [
      _kv('Timeframe', rec.timeframe || '—'),
      _kv(_t('arc.biasLabel', null, 'Yön Eğilimi (Bias)'), U.directionLabel(rec.direction_bias)),
      _kv(_t('arc.actualDir', null, 'Gerçekleşen Yön'), rec.direction_realized ? U.directionLabel(rec.direction_realized) : 'Beklemede'),
      _kv(_t('arc.priceAt', null, 'Analiz Anı Fiyatı'), U.fmtPrice(rec.price_at_analysis)),
      _kv(_t('arc.reviewPrice', null, 'İnceleme Fiyatı'), U.fmtPrice(rec.price_at_review)),
      _kv('Max Hareket', U.fmtPct(rec.max_move_pct), U.pctClass(rec.max_move_pct)),
      _kv('Min Hareket', U.fmtPct(rec.min_move_pct), U.pctClass(rec.min_move_pct)),
      _kv('Pencere Sonu Hareket', U.fmtPct(rec.end_move_pct), U.pctClass(rec.end_move_pct)),
      _kv(_t('arc.consistScore', null, 'Tutarlılık Skoru'), rec.validation_score != null ? `${rec.validation_score}/100` : '—'),
    ].join('');

    const aiLearned = rec.ai_learned
      ? `<div class="aic-ai-learned"><div class="k">🧠 AI Learned</div><div class="v">${U.esc(rec.ai_learned)}</div></div>`
      : '';

    const sharedBadge = rec.shared_to_telegram
      ? `<div class="aic-shared-badge">${_t('arc.sharedTg', null, "✔ Telegram'da paylaşıldı")}</div>`
      : '';

    return `
      <div class="aic-modal" role="dialog" aria-modal="true" aria-label="${U.esc(rec.sym)} ${_t('arc.analysisDetail', null, 'analiz detayı')}">
        <div class="aic-modal-header">
          <span class="aic-modal-sym">${U.esc(rec.sym)}</span>
          <span class="aic-badge" style="--status-color:${m.color}"><span class="dot"></span>${U.esc(m.label)}</span>${m.desc ? `<span class="aic-tip-wrap"><button class="aic-tip-btn" type="button" data-tip-toggle aria-label="${_t('arc.statusDesc', null, 'Durum açıklaması')}">ⓘ</button><span class="aic-tip" role="tooltip"><b>${U.esc(m.en || m.label)}</b><br>${U.esc(m.desc)}</span></span>` : ''}
          <button class="aic-modal-close" data-aic="close" aria-label="Kapat" type="button">✕</button>
        </div>
        <div class="aic-modal-body">
          <p class="aic-modal-text">${U.esc(rec.analysis_text || rec.analysis_summary || '—')}</p>
          ${_timesHTML(rec)}${_oiHTML(rec)}
          <div class="aic-kv-grid">${kvCells}</div>
          ${aiLearned}
          <!-- Telegram paylaş slotu — Aşama 4'te aktifleşir -->
          <div class="aic-modal-tg-slot" data-aic-tg-slot></div>
          ${sharedBadge}
          ${(NS.Admin && NS.Admin.isAdmin()) ? NS.Admin.sectionHTML(rec) : ''}
          <div class="aic-modal-legal">
            ${_t('arc.disc1', null, 'Bu içerik yatırım tavsiyesi değildir. Geçmiş analizlerin retrospektif')}
            ${_t('arc.disc2', null, 'değerlendirmesidir; gelecekteki sonuçların göstergesi sayılamaz.')}
          </div>
        </div>
      </div>`;
  }

  async function open(id) {
    if (!id) return;
    _lastFocus = document.activeElement;
    _close();

    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.className = 'aic-modal-overlay';
    root.innerHTML = `<div class="aic-modal"><div class="aic-modal-body"><div class="aic-loading">${_t('arc.loading', null, 'Yükleniyor…')}</div></div></div>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';

    // Dış tıklama
    root.addEventListener('click', (e) => { if (e.target === root) _close(); });
    // ESC
    _escHandler = (e) => { if (e.key === 'Escape') _close(); };
    document.addEventListener('keydown', _escHandler);

    let rec = null;
    try {
      rec = window.SupabaseDB ? await window.SupabaseDB.getArchiveById(id) : null;
    } catch (e) { rec = null; }

    // Pending kayıt anon okumada görünmez → admin ise service-role get_one fallback
    if (!rec && NS.Admin && NS.Admin.isAdmin() && typeof NS.Admin.fetchOne === 'function') {
      try { rec = await NS.Admin.fetchOne(id); } catch (e) { rec = null; }
    }

    if (!rec) {
      root.innerHTML = `<div class="aic-modal"><div class="aic-modal-header"><span class="aic-modal-sym">—</span><button class="aic-modal-close" data-aic="close" type="button">✕</button></div><div class="aic-modal-body"><div class="aic-empty"><div class="icon">⚠</div>${_t('arc.notFound', null, 'Kayıt bulunamadı veya görüntülenemiyor.')}</div></div></div>`;
    } else if (_teaserBlocked(rec)) {
      // PHASE 3: teaser oturumunda linkteki coin dışındaki analiz açılamaz
      const msg = (window.VDTeaser && window.VDTeaser.SCOPE_MSG) || _t('arc.premOnly', null, 'Bu analiz yalnızca Premium üyeler için kullanılabilir.');
      root.innerHTML = `<div class="aic-modal"><div class="aic-modal-header"><span class="aic-modal-sym">🔒 ${U.esc(rec.sym || '')}</span><button class="aic-modal-close" data-aic="close" type="button">✕</button></div>
        <div class="aic-modal-body"><div class="aic-teaser-block">
          <div class="aic-teaser-block-ic">🔒</div>
          <div class="aic-teaser-block-msg">${U.esc(msg)}</div>
          <button class="aic-teaser-block-btn" data-teaser-premium type="button">${_t('arc.enterCode', null, 'Premium Erişim Kodu Gir')}</button>
        </div></div></div>`;
      const pb = root.querySelector('[data-teaser-premium]');
      if (pb) pb.addEventListener('click', () => { _close(); if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin(); else window.location.href = 'index.html#premium'; });
    } else {
      root.innerHTML = _render(rec);
      if (NS.Admin && NS.Admin.isAdmin()) { try { NS.Admin.wire(root, rec); } catch (e) {} }
    }

    root.querySelectorAll('[data-aic="close"]').forEach(b => b.addEventListener('click', _close));
    // ⓘ tooltip toggle (dokunmatik/tıklama) — public rozet + admin legend
    root.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip-toggle]');
      if (!t) return;
      e.stopPropagation();
      const w = t.closest('.aic-tip-wrap');
      if (!w) return;
      const wasOpen = w.classList.contains('open');
      root.querySelectorAll('.aic-tip-wrap.open').forEach(o => o.classList.remove('open'));
      if (!wasOpen) w.classList.add('open');
    });
    const closeBtn = root.querySelector('.aic-modal-close');
    if (closeBtn) { try { closeBtn.focus(); } catch (e) {} }
  }

  NS.Modal = { open, close: _close, timesHTML: _timesHTML };
})();
