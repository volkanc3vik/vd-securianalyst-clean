// ════════════════════════════════════════════════════════════════════
// VDArchive · ADMIN REVIEW (Aşama 3)
// Yalnızca admin'e görünür yönetim alanı. Mevcut admin code sistemi
// kullanılır (localStorage['aap_access_v1'].isAdmin). Yeni login YOK.
//
// Bu aşamada DB'ye YAZMA yok (RLS service_role ister, endpoint sonraki
// aşamada). Değişiklikler localStorage taslağı olarak saklanır:
//   archive_admin_drafts_v1 = { [recordId]: {review_status, admin_note,
//                                internal_review, prep_telegram, savedAt} }
// Telegram gönderimi / otomatik paylaşım YOK.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U  = NS.util || { esc: s => String(s == null ? '' : s) };

  const LS_ACCESS = 'aap_access_v1';        // mevcut admin code deposu (yeniden yazılmaz)
  const LS_DRAFTS = 'archive_admin_drafts_v1';

  // UI etiketi → DB review_status değeri (mevcut check constraint'e uyumlu)
  // "Rejected" şimdilik 'not_validated'e map'lenir (check'e 'rejected' eklemek
  // sonraki aşamada küçük bir migration ile yapılabilir).
  const STATUS = [
    { ui: 'Pending',   db: 'pending' },
    { ui: 'Validated', db: 'validated' },
    { ui: 'Partial',   db: 'partially_validated' },
    { ui: 'Rejected',  db: 'not_validated' },
  ];

  function isAdmin() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_ACCESS) || '{}');
      return !!(d && d.isAdmin === true);
    } catch (e) { return false; }
  }

  function _drafts() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFTS) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function getDraft(id) { return _drafts()[id] || null; }
  function _saveDraft(id, obj) {
    const all = _drafts();
    all[id] = Object.assign({}, obj, { savedAt: Date.now() });
    try { localStorage.setItem(LS_DRAFTS, JSON.stringify(all)); return true; }
    catch (e) { return false; }
  }

  // Modal içine eklenecek Admin Review bölümü (yalnızca admin çağırır)
  function sectionHTML(rec) {
    const draft     = getDraft(rec.id) || {};
    const curStatus = draft.review_status != null ? draft.review_status : (rec.review_status || 'pending');
    const note      = draft.admin_note    != null ? draft.admin_note    : (rec.admin_note || '');
    const internal  = draft.internal_review != null ? draft.internal_review : '';
    const prep      = !!draft.prep_telegram;
    const opts = STATUS.map(s =>
      `<option value="${s.db}" ${s.db === curStatus ? 'selected' : ''}>${s.ui}</option>`).join('');
    const savedNote = draft.savedAt
      ? `<span class="aic-admin-draft-flag">• yerel taslak mevcut</span>` : '';

    return `
      <div class="aic-admin" data-aic-admin>
        <div class="aic-admin-hdr">🛡️ Admin Review <span class="aic-admin-tag">yalnızca admin</span>${savedNote}</div>
        <label class="aic-admin-l">Review Status</label>
        <select class="aic-admin-select" data-aic-status>${opts}</select>
        <label class="aic-admin-l">Admin Note</label>
        <textarea class="aic-admin-ta" data-aic-note rows="3"
          placeholder="Örn: Likidite tespiti doğru ancak momentum kısmı beklenenden zayıf gerçekleşti.">${U.esc(note)}</textarea>
        <label class="aic-admin-l">Internal Review</label>
        <textarea class="aic-admin-ta" data-aic-internal rows="2"
          placeholder="Örn: Benzer yapı tekrar görülürse confidence artırılabilir.">${U.esc(internal)}</textarea>
        <label class="aic-admin-chk">
          <input type="checkbox" data-aic-prep ${prep ? 'checked' : ''}>
          Telegram paylaşımına hazırla <span class="aic-admin-muted">(gönderim yok)</span>
        </label>
        <div class="aic-admin-actions">
          <button class="aic-admin-save" data-aic-save type="button">Taslağı Kaydet</button>
          <span class="aic-admin-status" data-aic-savemsg aria-live="polite"></span>
        </div>
        <div class="aic-admin-info">
          ⚠ Değişiklikler şimdilik bu cihazda <b>taslak</b> olarak saklanır. Veritabanına yazma ve
          Telegram gönderimi sonraki aşamada (admin yazma endpoint'i) aktifleşecektir.
        </div>
      </div>`;
  }

  function wire(root, rec) {
    const sec = root.querySelector('[data-aic-admin]');
    if (!sec) return;
    const btn = sec.querySelector('[data-aic-save]');
    const msg = sec.querySelector('[data-aic-savemsg]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const obj = {
        review_status:   sec.querySelector('[data-aic-status]').value,
        admin_note:      sec.querySelector('[data-aic-note]').value,
        internal_review: sec.querySelector('[data-aic-internal]').value,
        prep_telegram:   sec.querySelector('[data-aic-prep]').checked,
      };
      const ok = _saveDraft(rec.id, obj);
      if (msg) {
        msg.textContent = ok ? 'Taslak kaydedildi ✓' : 'Kaydedilemedi';
        msg.style.color = ok ? 'var(--v4-success)' : 'var(--v4-danger)';
        setTimeout(() => { if (msg) msg.textContent = ''; }, 2600);
      }
    });
  }

  NS.Admin = { isAdmin, sectionHTML, wire, getDraft, STATUS };
})();
