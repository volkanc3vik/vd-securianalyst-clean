// ════════════════════════════════════════════════════════════════════
// VDArchive · DETAIL MODAL
// open(id) → getArchiveById → render. ESC / dış tıklama / kapat butonu.
// Erişilebilir: role=dialog, focus, body scroll-lock.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
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

  function _render(rec) {
    const m = U.statusMeta(rec.review_status);
    const reviewed = rec.review_status && rec.review_status !== 'pending';

    const kvCells = [
      _kv('Timeframe', rec.timeframe || '—'),
      _kv('Analiz Tarihi', U.fmtDate(rec.created_at)),
      _kv('Yön Eğilimi (Bias)', U.directionLabel(rec.direction_bias)),
      _kv('Gerçekleşen Yön', reviewed ? U.directionLabel(rec.direction_realized) : 'Beklemede'),
      _kv('Analiz Anı Fiyatı', U.fmtPrice(rec.price_at_analysis)),
      _kv('İnceleme Fiyatı', U.fmtPrice(rec.price_at_review)),
      _kv('Max Hareket', U.fmtPct(rec.max_move_pct), U.pctClass(rec.max_move_pct)),
      _kv('Min Hareket', U.fmtPct(rec.min_move_pct), U.pctClass(rec.min_move_pct)),
      _kv('Pencere Sonu Hareket', U.fmtPct(rec.end_move_pct), U.pctClass(rec.end_move_pct)),
      _kv('Tutarlılık Skoru', rec.validation_score != null ? `${rec.validation_score}/100` : '—'),
    ].join('');

    const aiLearned = rec.ai_learned
      ? `<div class="aic-ai-learned"><div class="k">🧠 AI Learned</div><div class="v">${U.esc(rec.ai_learned)}</div></div>`
      : '';

    const sharedBadge = rec.shared_to_telegram
      ? `<div class="aic-shared-badge">✔ Telegram'da paylaşıldı${rec.shared_at ? ' · ' + U.esc(U.fmtDate(rec.shared_at)) : ''}</div>`
      : '';

    return `
      <div class="aic-modal" role="dialog" aria-modal="true" aria-label="${U.esc(rec.sym)} analiz detayı">
        <div class="aic-modal-header">
          <span class="aic-modal-sym">${U.esc(rec.sym)}</span>
          <span class="aic-badge" style="--status-color:${m.color}"><span class="dot"></span>${U.esc(m.label)}</span>
          <button class="aic-modal-close" data-aic="close" aria-label="Kapat" type="button">✕</button>
        </div>
        <div class="aic-modal-body">
          <p class="aic-modal-text">${U.esc(rec.analysis_text || rec.analysis_summary || '—')}</p>
          <div class="aic-kv-grid">${kvCells}</div>
          ${aiLearned}
          <!-- Telegram paylaş slotu — Aşama 4'te aktifleşir -->
          <div class="aic-modal-tg-slot" data-aic-tg-slot></div>
          ${sharedBadge}
          ${(NS.Admin && NS.Admin.isAdmin()) ? NS.Admin.sectionHTML(rec) : ''}
          <div class="aic-modal-legal">
            Bu içerik yatırım tavsiyesi değildir. Geçmiş analizlerin retrospektif
            değerlendirmesidir; gelecekteki sonuçların göstergesi sayılamaz.
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
    root.innerHTML = `<div class="aic-modal"><div class="aic-modal-body"><div class="aic-loading">Yükleniyor…</div></div></div>`;
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

    if (!rec) {
      root.innerHTML = `<div class="aic-modal"><div class="aic-modal-header"><span class="aic-modal-sym">—</span><button class="aic-modal-close" data-aic="close" type="button">✕</button></div><div class="aic-modal-body"><div class="aic-empty"><div class="icon">⚠</div>Kayıt bulunamadı veya görüntülenemiyor.</div></div></div>`;
    } else {
      root.innerHTML = _render(rec);
      if (NS.Admin && NS.Admin.isAdmin()) { try { NS.Admin.wire(root, rec); } catch (e) {} }
    }

    root.querySelectorAll('[data-aic="close"]').forEach(b => b.addEventListener('click', _close));
    const closeBtn = root.querySelector('.aic-modal-close');
    if (closeBtn) { try { closeBtn.focus(); } catch (e) {} }
  }

  NS.Modal = { open, close: _close };
})();
