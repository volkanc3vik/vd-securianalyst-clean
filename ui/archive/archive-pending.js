// ════════════════════════════════════════════════════════════════════
// VDArchive · BEKLEYEN İNCELEMELER (Aşama 6 — admin-only pending panel)
// Sadece admin (localStorage['aap_access_v1'].isAdmin) görür. Pending kayıtlar
// public feed'de GÖRÜNMEZ (RLS); bu panel onları service-role endpoint
// (POST /api/analysis-archive {action:'list_pending'}, x-admin-key) ile çeker.
// Normal kullanıcı bu paneli HİÇ görmez (render edilmez).
// Karta tıklayınca mevcut modal açılır (modal pending için get_one fallback yapar).
// Review sonrası kayıt pending'den çıkınca: panel + feed + stats tazelenir.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U  = NS.util || { esc: s => String(s == null ? '' : s) };
  const API = '/api/analysis-archive';
  const CONTAINER = 'aic-pending';

  function _isAdmin() { return !!(NS.Admin && NS.Admin.isAdmin && NS.Admin.isAdmin()); }
  function _disp() { return window.TelegramDispatcher || null; }
  function _hasKey() { const d = _disp(); return !!(d && d.hasAdminKey && d.hasAdminKey()); }
  function _dirLabel(b) { return (U.directionLabel ? U.directionLabel(b) : (b || '—')); }
  function _fmtDT(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
             d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }
  function _price(v) { return (U.fmtPrice ? U.fmtPrice(v) : (v != null ? v : '—')); }
  // Belirsiz/fallback fiyatı (0, null, NaN) GÖSTERME → "—"
  function _priceSafe(v) {
    const n = Number(v);
    if (v == null || isNaN(n) || n === 0) return '—';
    return _price(v);
  }
  // "az kaldı" / "3 saat sonra" / "2 gün sonra" (gelecek zaman)
  function _relFuture(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = t - Date.now();
    if (diff <= 0) return 'şimdi';
    const min = Math.floor(diff / 60000);
    if (min < 60) return min + ' dakika sonra';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' saat sonra';
    const day = Math.floor(hr / 24);
    const remHr = hr % 24;
    return day + ' gün' + (remHr ? ' ' + remHr + ' saat' : '') + ' sonra';
  }
  // "az önce" / "3 saat önce" / "1 gün önce"
  function _relTime(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 0) return 'az önce';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'az önce';
    if (min < 60) return min + ' dakika önce';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' saat önce';
    const day = Math.floor(hr / 24);
    return day + ' gün önce';
  }

  function _shell(inner) {
    const keyArea = _hasKey()
      ? ''
      : `<div class="aic-pend-keyrow">
           <input type="password" class="aic-pend-key" data-pend-key placeholder="Admin Key (oturum)" autocomplete="off">
           <button class="aic-pend-keybtn" data-pend-keyset type="button">Etkinleştir</button>
         </div>`;
    return `
      <div class="aic-pend">
        <div class="aic-pend-hdr">
          <span class="aic-pend-title">🕓 Bekleyen İncelemeler <span class="aic-pend-tag">yalnızca admin</span></span>
          <button class="aic-pend-refresh" data-pend-load type="button">Yükle / Yenile</button>
        </div>
        ${keyArea}
        <div class="aic-pend-body" data-pend-body>${inner || ''}</div>
      </div>`;
  }

  function _cardHTML(rec) {
    const score = rec.analysis_score != null ? `${rec.analysis_score}/100` : '—';
    // Telegram gönderim zamanı: market_context.sent_at (varsa) ya da created_at (kayıt anı ≈ gönderim)
    const mc = rec.market_context || {};
    const sentISO = mc.sent_at || rec.created_at;
    // Outcome Tracking Faz 1: review_due_at geçtiyse "Outcome Ready" (türetilmiş; hesaplama YOK)
    const due = rec.review_due_at ? new Date(rec.review_due_at).getTime() : null;
    const ready = (rec.review_status === 'pending') && due != null && !isNaN(due) && due <= Date.now();
    const statusPill = ready
      ? `<span class="aic-pend-pill aic-pend-ready">🟢 Outcome Ready</span>`
      : `<span class="aic-pend-pill aic-pend-wait">⏳ Beklemede</span>`;
    const dueLine = due != null && !isNaN(due)
      ? (ready
          ? `<span class="aic-pend-due ready">📊 İncelemeye hazır</span>`
          : `<span class="aic-pend-due">⏳ İnceleme: ${U.esc(_relFuture(rec.review_due_at))}</span>`)
      : '';
    return `
      <button class="aic-pend-card${ready ? ' is-ready' : ''}" data-pend-id="${U.esc(rec.id)}" type="button">
        <span class="aic-pend-toprow">
          <span class="aic-pend-sym">${U.esc(rec.sym)}</span>
          ${statusPill}
        </span>
        <span class="aic-pend-meta">${U.esc(rec.timeframe || '—')} · ${U.esc(_dirLabel(rec.direction_bias))}</span>
        <span class="aic-pend-meta">Analiz Fiyatı: ${U.esc(_priceSafe(rec.price_at_analysis))} · Skor: ${U.esc(score)}</span>
        <span class="aic-pend-rel">⏱ Gönderildi: ${U.esc(_relTime(sentISO))}</span>
        ${dueLine}
        <span class="aic-pend-date">${U.esc(_fmtDT(sentISO))}</span>
        <span class="aic-pend-go">İncele →</span>
      </button>`;
  }

  let _busy = false;
  async function _load(root) {
    if (_busy) return;
    const body = root.querySelector('[data-pend-body]');
    const d = _disp();
    if (!_hasKey()) { if (body) body.innerHTML = `<div class="aic-pend-empty">İncelemek için admin anahtarını etkinleştirin.</div>`; return; }
    if (!d || typeof d.adminFetch !== 'function') { if (body) body.innerHTML = `<div class="aic-pend-empty">Admin sistemi yüklenmedi.</div>`; return; }
    _busy = true;
    if (body) body.innerHTML = `<div class="aic-pend-empty">Yükleniyor…</div>`;
    try {
      const r = await d.adminFetch(API, { action: 'list_pending', limit: 300, newest: true });  // en yeni açılan ÜSTTE, tüm bekleyenler
      if (r && r.ok && Array.isArray(r.rows)) {
        if (!r.rows.length) { if (body) body.innerHTML = `<div class="aic-pend-empty">Bekleyen kayıt yok.</div>`; }
        else if (body) {
          body.innerHTML = `<div class="aic-pend-grid">${r.rows.map(_cardHTML).join('')}</div>`;
          body.querySelectorAll('[data-pend-id]').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-pend-id');
              if (id && NS.Modal && NS.Modal.open) NS.Modal.open(id);
            });
          });
        }
      } else if (body) {
        body.innerHTML = `<div class="aic-pend-empty">Yüklenemedi: ${U.esc((r && r.error) || 'bilinmiyor')}</div>`;
      }
    } catch (e) {
      if (body) body.innerHTML = `<div class="aic-pend-empty">İstek başarısız.</div>`;
    } finally { _busy = false; }
  }

  function _wire(root) {
    const loadBtn = root.querySelector('[data-pend-load]');
    if (loadBtn) loadBtn.addEventListener('click', () => _load(root));
    const keyBtn = root.querySelector('[data-pend-keyset]');
    if (keyBtn) {
      keyBtn.addEventListener('click', () => {
        const inp = root.querySelector('[data-pend-key]');
        const d = _disp();
        if (d && typeof d.setAdminKey === 'function' && d.setAdminKey((inp && inp.value || '').trim())) {
          mount(); // yeniden çiz (key alanı kalkar) + otomatik yükle
          const r2 = document.getElementById(CONTAINER);
          if (r2) _load(r2);
        }
      });
    }
  }

  function mount() {
    const el = document.getElementById(CONTAINER);
    if (!el) return;
    if (!_isAdmin()) { el.innerHTML = ''; el.hidden = true; return; }  // normal kullanıcı: hiç görmez
    el.hidden = false;
    el.innerHTML = _shell('<div class="aic-pend-empty">"Yükle / Yenile" ile bekleyen kayıtları getirin.</div>');
    _wire(el);
    if (_hasKey()) _load(el);  // key hazırsa otomatik getir
  }

  // Review sonrası kayıt pending'den çıktı → paneli + feed + stats tazele
  function _refreshAll() {
    const el = document.getElementById(CONTAINER);
    if (el && _isAdmin()) _load(el);
    try { if (NS.Stats && NS.Stats.render) NS.Stats.render('aic-stats'); } catch (e) {}
    try {
      if (NS.Feed && NS.Feed.load) {
        const st = (NS.Filters && NS.Filters.getState) ? NS.Filters.getState() : { range: 'all', sinceISO: null };
        NS.Feed.load('aic-feed', st);
      }
    } catch (e) {}
  }

  window.addEventListener('vd:archive:reviewed', _refreshAll);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  NS.Pending = { mount, refresh: _refreshAll };
})();
