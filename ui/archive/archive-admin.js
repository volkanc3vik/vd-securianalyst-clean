// ════════════════════════════════════════════════════════════════════
// VDArchive · ADMIN REVIEW (Aşama 4 — DB write + Telegram review)
// Yalnızca admin'e görünür. Görünürlük: localStorage['aap_access_v1'].isAdmin.
// Gerçek yazma + Telegram: mevcut TelegramDispatcher (session admin key) +
//   POST /api/analysis-archive (service-role, x-admin-key guard)
//   POST /api/telegram-send    (mevcut, TelegramDispatcher.send ile)
// Frontend DB'ye DOĞRUDAN yazmaz; service-role key/token client'a GİRMEZ.
// localStorage taslağı (offline/yedek) korunur.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U  = NS.util || { esc: s => String(s == null ? '' : s) };

  const LS_ACCESS = 'aap_access_v1';
  const LS_DRAFTS = 'archive_admin_drafts_v1';
  const API       = '/api/analysis-archive';
  // Outcome Tracking Faz 2: son hesaplanan öneri (id eşleşirse modalda preset)
  let _suggest = null;
  const TG_CHANNEL = 'free';   // public review kanalı (mevcut telegram-send kanal anahtarı)

  const STATUS = [
    { ui: 'Pending',   db: 'pending',               tg: 'BEKLEMEDE',           tr: 'Beklemede',          desc: 'Bu analiz henüz sonuç açısından değerlendirilmedi.' },
    { ui: 'Validated', db: 'validated',             tg: 'DOĞRULANDI',          tr: 'Doğrulandı',         desc: 'Analiz yönü ve sonuçları büyük ölçüde doğrulandı.' },
    { ui: 'Partial',   db: 'partially_validated',   tg: 'KISMEN DOĞRULANDI',   tr: 'Kısmen Doğrulandı',  desc: 'Analiz kısmen doğru çıktı ancak bazı koşullar beklenen performansı göstermedi.' },
    { ui: 'Rejected',  db: 'not_validated',         tg: 'DOĞRULANMADI',        tr: 'Doğrulanmadı',       desc: 'Analiz beklenen yönde doğrulanmadı.' },
  ];
  function _tgLabel(db) { const s = STATUS.find(x => x.db === db); return s ? s.tg : (db || '—'); }

  function isAdmin() {
    try { const d = JSON.parse(localStorage.getItem(LS_ACCESS) || '{}'); return !!(d && d.isAdmin === true); }
    catch (e) { return false; }
  }
  function _disp() { return window.TelegramDispatcher || null; }
  function _hasKey() { const d = _disp(); return !!(d && typeof d.hasAdminKey === 'function' && d.hasAdminKey()); }

  // Admin: tek kayıt service-role ile (pending dahil) — modal fallback için
  async function fetchOne(id) {
    const d = _disp();
    if (!d || typeof d.adminFetch !== 'function' || !_hasKey()) return null;
    try {
      const r = await d.adminFetch(API, { action: 'get_one', id });
      return (r && r.ok && r.row) ? r.row : null;
    } catch (e) { return null; }
  }

  // ── Yerel taslak ──
  function _drafts() { try { return JSON.parse(localStorage.getItem(LS_DRAFTS) || '{}') || {}; } catch (e) { return {}; } }
  function getDraft(id) { return _drafts()[id] || null; }
  function _saveDraft(id, obj) {
    const all = _drafts(); all[id] = Object.assign({}, obj, { savedAt: Date.now() });
    try { localStorage.setItem(LS_DRAFTS, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  // ── Yardımcılar ──
  function _fmtPct(v) {
    if (v == null || isNaN(Number(v))) return '—';
    const n = Number(v); return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function _fmtDateTR(iso) {
    try { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return iso || '—'; }
  }
  // Saatli tarih: "30 Mayıs 2026 02:49"
  function _fmtDateTimeTR(iso) {
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return date + ' ' + time;
    } catch (e) { return iso || '—'; }
  }

  // Telegram review mesajı (verilen format)
  function _buildMessage(rec, vals) {
    const sym = rec.sym || '—';
    const tag = '#' + (sym || '').replace(/[^A-Za-z0-9]/g, '');
    const lines = [
      '📚 ANALYSIS REVIEW',
      '',
      '🪙 ' + sym,
      '📅 Analiz Zamanı: ' + _fmtDateTimeTR(rec.created_at),
    ];
    // İnceleme Zamanı = reviewed_at (YOKSA satır yazılmaz; created_at ASLA kullanılmaz)
    if (rec.reviewed_at) lines.push('📊 İnceleme Zamanı: ' + _fmtDateTimeTR(rec.reviewed_at));
    // Paylaşım Zamanı = shared_at (YOKSA satır yazılmaz)
    if (rec.shared_at)   lines.push('📤 Paylaşım Zamanı: ' + _fmtDateTimeTR(rec.shared_at));
    lines.push(
      '',
      '🎯 Sonuç: ' + _tgLabel(vals.review_status),
      '📈 Hareket: ' + _fmtPct(rec.end_move_pct),
      '🚀 Maksimum Hareket: ' + _fmtPct(rec.max_move_pct),
      '📊 Tutarlılık: ' + (rec.validation_score != null ? rec.validation_score + '/100' : '—'),
      '',
      '📝 Admin Notu:',
      (vals.admin_note || '—'),
      '',
      '🧠 AI Learned:',
      (rec.ai_learned || '—'),
      '',
      '🚀 Premium Kripto Analiz Platformunu Aç',
      '🔗 Detaylı Analiz: https://vd-securianalyst.com/archive.html',
      '',
      '#AnalysisReview',
      tag,
      '#VDSecuriAnalyst'
    );
    return lines.join('\n');
  }

  // ── Bölüm HTML ──
  function sectionHTML(rec) {
    if (_suggest && _suggest.id !== rec.id) _suggest = null;       // farklı kayıt → temizle
    const sug       = (_suggest && _suggest.id === rec.id) ? _suggest : null;
    const draft     = getDraft(rec.id) || {};
    const curStatus = sug ? sug.review_status : (draft.review_status != null ? draft.review_status : (rec.review_status || 'pending'));
    const note      = sug ? sug.note : (draft.admin_note != null ? draft.admin_note : (rec.admin_note || ''));
    const internal  = draft.internal_review != null ? draft.internal_review : (rec.internal_review || '');
    const prep      = !!draft.prep_telegram;
    const opts = STATUS.map(s =>
      `<option value="${s.db}" ${s.db === curStatus ? 'selected' : ''}>${s.ui} — ${s.tr}</option>`).join('');
    const draftFlag = draft.savedAt ? `<span class="aic-admin-draft-flag">• yerel taslak</span>` : '';

    // Review Status açıklama (legend) tooltip — DB/değer değişmez, yalnızca bilgilendirme
    const legend = STATUS.map(s =>
      `<div class="aic-tip-row"><b>${U.esc(s.ui)}</b> <span class="aic-tip-tr">(${U.esc(s.tr)})</span><br>${U.esc(s.desc)}</div>`).join('');
    const statusLabel = `Review Status
      <span class="aic-tip-wrap">
        <button class="aic-tip-btn" type="button" data-tip-toggle aria-label="Durum açıklamaları">ⓘ</button>
        <span class="aic-tip" role="tooltip"><div class="aic-tip-title">Durum açıklamaları</div>${legend}</span>
      </span>`;

    const hasKey = _hasKey();
    const keyArea = hasKey
      ? `<div class="aic-admin-keyok">🔑 Admin anahtarı aktif (oturum)</div>`
      : `<div class="aic-admin-keyrow">
           <input type="password" class="aic-admin-key" data-aic-key placeholder="Admin Key (oturum — DB yazma/Telegram için)" autocomplete="off">
           <button class="aic-admin-keybtn" data-aic-keyset type="button">Etkinleştir</button>
         </div>`;

    const shared = rec.shared_to_telegram
      ? `<div class="aic-admin-shared">✔ Telegram'da Paylaşıldı
           <span class="aic-admin-shared-meta">Mesaj ID: ${U.esc(rec.telegram_msg_id != null ? rec.telegram_msg_id : '—')} · ${U.esc(rec.shared_at ? _fmtDateTR(rec.shared_at) : '—')}</span>
         </div>`
      : '';

    // Outcome Tracking Faz 2: "Sonucu Hesapla" — yalnız Outcome Ready (pending + due geçmiş)
    const due = rec.review_due_at ? Date.parse(rec.review_due_at) : null;
    const outcomeReady = rec.review_status === 'pending' && due && !isNaN(due) && due <= Date.now();
    const calcTitle = !outcomeReady ? 'Yalnızca inceleme zamanı gelmiş (Outcome Ready) pending kayıtlar için'
                    : !hasKey ? 'Admin anahtarı gerekli' : 'Binance verisinden retrospektif sonuç hesaplar (otomatik kayıt YOK)';
    const calcMsg = sug
      ? `✓ Otomatik hesap uygulandı — öneri: <b>${U.esc(sug.review_status)}</b>. Alanları kontrol edip Kaydet ile onaylayın.`
      : '';
    const calcRow = `
      <div class="aic-admin-calcrow">
        <button class="aic-admin-calc" data-aic-calc type="button" ${(hasKey && outcomeReady) ? '' : 'disabled'} title="${calcTitle}">📊 Sonucu Hesapla</button>
        <span class="aic-admin-calcmsg" data-aic-calcmsg aria-live="polite">${calcMsg}</span>
      </div>`;

    return `
      <div class="aic-admin" data-aic-admin>
        <div class="aic-admin-hdr">🛡️ Admin Review <span class="aic-admin-tag">yalnızca admin</span>${draftFlag}</div>
        ${shared}
        ${calcRow}
        <label class="aic-admin-l">${statusLabel}</label>
        <select class="aic-admin-select" data-aic-status>${opts}</select>
        <label class="aic-admin-l">Admin Note</label>
        <textarea class="aic-admin-ta" data-aic-note rows="3"
          placeholder="Örn: Likidite tespiti doğru ancak momentum kısmı beklenenden zayıf gerçekleşti.">${U.esc(note)}</textarea>
        <label class="aic-admin-l">Internal Review</label>
        <textarea class="aic-admin-ta" data-aic-internal rows="2"
          placeholder="Örn: Benzer yapı tekrar görülürse confidence artırılabilir.">${U.esc(internal)}</textarea>
        <label class="aic-admin-chk">
          <input type="checkbox" data-aic-prep ${prep ? 'checked' : ''}>
          Telegram paylaşımına hazır olarak işaretle
        </label>
        ${keyArea}
        <div class="aic-admin-actions">
          <button class="aic-admin-save" data-aic-save type="button">Kaydet</button>
          <button class="aic-admin-tg" data-aic-send type="button" ${(hasKey && curStatus !== 'pending') ? '' : 'disabled'} title="${curStatus === 'pending' ? 'Bu analiz henüz sonuçlanmadı — önce bir sonuç durumu seçip kaydedin.' : ''}">${rec.shared_to_telegram ? 'Yeniden Gönder' : "Telegram'a Gönder"}</button>
          <span class="aic-admin-status" data-aic-savemsg aria-live="polite"></span>
        </div>
        <div class="aic-admin-info">
          ⚠ "Kaydet" review alanlarını veritabanına yazar (admin anahtarı gerekir); ayrıca yerel taslak tutulur.
          "Telegram'a Gönder" mevcut Telegram sistemini kullanır ve başarılı olursa kaydı paylaşıldı olarak işaretler.
        </div>
      </div>`;
  }

  function _readVals(sec) {
    return {
      review_status:   sec.querySelector('[data-aic-status]').value,
      admin_note:      sec.querySelector('[data-aic-note]').value,
      internal_review: sec.querySelector('[data-aic-internal]').value,
      prep_telegram:   sec.querySelector('[data-aic-prep]').checked,
    };
  }
  function _msg(sec, text, ok) {
    const m = sec.querySelector('[data-aic-savemsg]');
    if (!m) return;
    m.textContent = text;
    m.style.color = ok === false ? 'var(--v4-danger)' : (ok === true ? 'var(--v4-success)' : 'var(--v4-text-2)');
    if (ok !== null) setTimeout(() => { if (m) m.textContent = ''; }, 3200);
  }
  function _rerender(root, rec) {
    const sec = root.querySelector('[data-aic-admin]');
    if (!sec) return;
    sec.outerHTML = sectionHTML(rec);
    wire(root, rec);
  }

  function _calcMsg(sec, text, ok) {
    const m = sec.querySelector('[data-aic-calcmsg]');
    if (!m) return;
    m.innerHTML = U.esc(text);
    m.style.color = ok === false ? 'var(--v4-danger)' : (ok === true ? 'var(--v4-success)' : 'var(--v4-text-2)');
  }

  function wire(root, rec) {
    const sec = root.querySelector('[data-aic-admin]');
    if (!sec) return;

    // Outcome Tracking Faz 2: "Sonucu Hesapla" (Binance kline → outcome; otomatik kayıt YOK)
    const calcBtn = sec.querySelector('[data-aic-calc]');
    if (calcBtn) {
      calcBtn.addEventListener('click', async () => {
        if (!_hasKey()) { _calcMsg(sec, 'Önce admin anahtarını etkinleştirin', false); return; }
        const d = _disp();
        if (!d || typeof d.adminFetch !== 'function') { _calcMsg(sec, 'Admin sistemi yüklenmedi', false); return; }
        calcBtn.disabled = true;
        _calcMsg(sec, 'Binance verisi çekiliyor, hesaplanıyor…', null);
        try {
          const r = await d.adminFetch(API, { action: 'set_outcome', id: rec.id });
          if (r && r.ok) {
            Object.assign(rec, r.row || {});
            const sugStatus = (r.suggestion && r.suggestion.review_status) || 'partially_validated';
            const sugNote = (rec.admin_note && String(rec.admin_note).trim())
              ? rec.admin_note
              : ((r.suggestion && r.suggestion.summary) || '');
            _suggest = { id: rec.id, review_status: sugStatus, note: sugNote };
            // Modalı taze veriyle yeniden aç → outcome alanları + öneri görünür
            if (window.VDArchive.Modal && window.VDArchive.Modal.open) window.VDArchive.Modal.open(rec.id);
          } else {
            const MAP = {
              not_ready: 'Henüz inceleme zamanı gelmedi (Outcome Ready değil).',
              not_pending: 'Kayıt zaten incelenmiş (pending değil).',
              geo_blocked: 'Sunucu bölgesi Binance Futures\'a kapalı (451). Vercel fonksiyon bölgesini EU/Asya\'ya alın (ör. fra1) ya da sonucu elle inceleyin.',
              no_price_data: 'Fiyat verisi bulunamadı — sembol Binance Futures\'ta olmayabilir.',
              price_fetch_failed: 'Binance verisine ulaşılamadı. Sonucu elle inceleyebilirsiniz.',
              bad_price_data: 'Fiyat verisi okunamadı.',
              no_entry_price: 'Analiz fiyatı yok, hesaplanamıyor.',
            };
            _calcMsg(sec, (MAP[r && r.error] || ('Hesaplanamadı: ' + ((r && r.error) || 'bilinmiyor'))), false);
            calcBtn.disabled = false;
          }
        } catch (e) { _calcMsg(sec, 'Hesaplama isteği başarısız.', false); calcBtn.disabled = false; }
      });
    }

    // Admin key etkinleştir
    const keyBtn = sec.querySelector('[data-aic-keyset]');
    if (keyBtn) {
      keyBtn.addEventListener('click', () => {
        const inp = sec.querySelector('[data-aic-key]');
        const d = _disp();
        if (!d || typeof d.setAdminKey !== 'function') { _msg(sec, 'Admin anahtar sistemi yüklenmedi', false); return; }
        const ok = d.setAdminKey((inp && inp.value || '').trim());
        if (ok) _rerender(root, rec);
        else _msg(sec, 'Geçersiz anahtar', false);
      });
    }

    // Kaydet (DB + yerel taslak)
    const saveBtn = sec.querySelector('[data-aic-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const vals = _readVals(sec);
        _saveDraft(rec.id, vals);
        if (!_hasKey()) { _msg(sec, 'Yerel taslak kaydedildi (DB için admin anahtarı girin)', true); return; }
        saveBtn.disabled = true; _msg(sec, 'Kaydediliyor…', null);
        try {
          const r = await _disp().adminFetch(API, {
            action: 'update_review', id: rec.id,
            review_status: vals.review_status, admin_note: vals.admin_note, internal_review: vals.internal_review,
          });
          if (r && r.ok) {
            if (r.row) {
              rec.review_status = r.row.review_status; rec.admin_note = r.row.admin_note;
              rec.internal_review = r.row.internal_review;
              if (r.row.reviewed_at) rec.reviewed_at = r.row.reviewed_at;
            }
            // Modal tarih bloğunu canlı yenile (İnceleme Tarihi görünür olsun)
            try {
              const tEl = root.querySelector('[data-aic-times]');
              if (tEl && window.VDArchive.Modal && window.VDArchive.Modal.timesHTML) {
                tEl.outerHTML = window.VDArchive.Modal.timesHTML(rec);
              }
            } catch (e) {}
            _msg(sec, 'Veritabanına kaydedildi ✓', true);
            _suggest = null;   // öneri uygulandı/kaydedildi
            // Pending'den çıktıysa: bekleyen paneli + feed + stats tazelensin
            if (rec.review_status && rec.review_status !== 'pending') {
              try { window.dispatchEvent(new CustomEvent('vd:archive:reviewed', { detail: { id: rec.id, review_status: rec.review_status } })); } catch (e) {}
            }
          } else { _msg(sec, 'DB hatası: ' + ((r && r.error) || 'bilinmiyor') + ' (taslak korundu)', false); }
        } catch (e) { _msg(sec, 'İstek başarısız (taslak korundu)', false); }
        finally { saveBtn.disabled = false; }
      });
    }

    // Telegram'a Gönder
    const sendBtn = sec.querySelector('[data-aic-send]');
    const statusSel = sec.querySelector('[data-aic-status]');
    // Pending iken Telegram butonu pasif (canlı) — "SONUÇ: BEKLEMEDE" gönderimi önlenir
    function _syncSendState() {
      if (!sendBtn) return;
      const pending = statusSel && statusSel.value === 'pending';
      const noKey = !_hasKey();
      sendBtn.disabled = pending || noKey;
      sendBtn.title = pending ? 'Bu analiz henüz sonuçlanmadı — önce bir sonuç durumu seçip kaydedin.' : '';
    }
    if (statusSel) statusSel.addEventListener('change', _syncSendState);
    _syncSendState();
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const vals = _readVals(sec);
        // GUARD: pending durumunda review gönderme
        if (vals.review_status === 'pending') {
          _msg(sec, 'Bu analiz henüz sonuçlanmadı. Önce bir sonuç durumu (Validated / Partial / Rejected) seçip kaydedin.', false);
          return;
        }
        if (!_hasKey()) { _msg(sec, 'Önce admin anahtarını etkinleştirin', false); return; }
        const d = _disp();
        if (!d || typeof d.send !== 'function') { _msg(sec, 'Telegram sistemi yüklenmedi', false); return; }
        const text = _buildMessage(rec, vals);
        sendBtn.disabled = true; _msg(sec, 'Telegram\'a gönderiliyor…', null);
        try {
          const sendRes = await d.send(text, TG_CHANNEL);
          if (!sendRes || !sendRes.ok) { _msg(sec, 'Telegram gönderimi başarısız: ' + ((sendRes && sendRes.error) || 'bilinmiyor'), false); sendBtn.disabled = false; return; }
          // Başarılı → DB'de paylaşıldı işaretle
          const mark = await d.adminFetch(API, { action: 'mark_shared', id: rec.id, telegram_msg_id: sendRes.messageId });
          if (mark && mark.ok && mark.row) {
            rec.shared_to_telegram = mark.row.shared_to_telegram;
            rec.telegram_msg_id    = mark.row.telegram_msg_id;
            rec.shared_at          = mark.row.shared_at;
            try {
              const tEl = root.querySelector('[data-aic-times]');
              if (tEl && window.VDArchive.Modal && window.VDArchive.Modal.timesHTML) {
                tEl.outerHTML = window.VDArchive.Modal.timesHTML(rec);
              }
            } catch (e) {}
            _rerender(root, rec);
            _msg(root.querySelector('[data-aic-admin]') || sec, 'Telegram\'da paylaşıldı ✓ (msg ' + sendRes.messageId + ')', true);
          } else {
            _msg(sec, 'Gönderildi ama DB işareti başarısız: ' + ((mark && mark.error) || 'bilinmiyor'), false);
            sendBtn.disabled = false;
          }
        } catch (e) { _msg(sec, 'Gönderim başarısız', false); sendBtn.disabled = false; }
      });
    }
  }

  NS.Admin = { isAdmin, sectionHTML, wire, getDraft, STATUS, fetchOne };
})();
