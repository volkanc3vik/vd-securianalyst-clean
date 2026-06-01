// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Admin Code Management Panel
// Sadece admin aktifken render edilir. Tüm API çağrıları x-admin-key ile.
// ═══════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const NS = window.TelegramUI || (window.TelegramUI = {});
  const ENDPOINT = '/api/admin-codes';
  const OVERLAY_ID = 'vd-admin-codes-overlay';
  let _state = {
    rows: [],
    filterStatus: 'all', // all | unused | active | expired | revoked | sales
    filterPlan: 'all',   // all | daily | weekly | monthly
    loading: false,
  };

  // ── Helpers ─────────────────────────────────────────────────────
  function _adminKey() {
    try { return window.TelegramDispatcher?.getAdminKey?.() || null; } catch (e) { return null; }
  }
  // Fallback: dispatcher getAdminKey döndürmüyorsa, doğrudan _adminKey scope'dan alınamaz.
  // Bu durumda API call'ları için fetch'i dispatcher'ın kendi gönderdiği gibi yapacağız.
  // Alternatif: dispatcher'a yeni bir helper ekleyelim — ama biz ona dokunmuyoruz.
  // Çözüm: panel.open() çağrıldığında dispatcher'dan key'i indirekt almak için bir hook.
  // Pratikte dispatcher zaten setAdminKey'i set ediyor; biz isActive() ile kontrol edip
  // dispatcher.fetchWithAdmin sarmalı oluşturuyoruz.

  async function _apiCall(actionOrParams, opts = {}) {
    // Strateji: dispatcher'ın admin key'i kendi başına ekleyebileceği bir helper'ı varsa kullan,
    // yoksa kullanıcıdan key'i talep edemiyoruz → ama panel sadece admin aktifken açılır.
    // Bu nedenle window.TelegramDispatcher._fetchWithAdminKey gibi private bir helper yok.
    // En temiz çözüm: dispatcher'a sadece BU panel için adminKey getter'ı eklemek.
    // YENİ: Hız uğruna dispatcher.proxyAdminFetch sarmalı kullanmıyoruz; admin key
    // session-only olduğu için sayfa kapanınca uçar. Burada doğrudan dispatcher
    // üzerinden çağırırız.
    if (!window.TelegramDispatcher) throw new Error('dispatcher_missing');
    if (typeof window.TelegramDispatcher.adminFetch !== 'function') {
      throw new Error('adminFetch_missing');
    }
    return window.TelegramDispatcher.adminFetch(ENDPOINT, actionOrParams, opts);
  }

  // ── Stil yardımcıları ────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function _fmtDate(s) {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return d.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return s; }
  }
  function _daysLeft(expiresAt) {
    if (!expiresAt) return '—';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '0';
    const d = ms / 86400000;
    if (d >= 1) return d.toFixed(1) + ' gün';
    return Math.round(d * 24) + ' saat';
  }
  function _statusBadge(s) {
    const map = {
      unused:   { c: '#7aaac8', t: 'KULLANILABİLİR' },
      active:   { c: '#00e5a0', t: 'AKTİF' },
      expired:  { c: '#ff9b4d', t: 'SÜRESİ DOLMUŞ' },
      revoked:  { c: '#ff3d6b', t: 'İPTAL' },
      assigned: { c: '#9d7dfa', t: 'ATANMIŞ' },
    };
    const m = map[s] || { c: '#7aaac8', t: (s||'?').toUpperCase() };
    return `<span class="acp-badge" style="color:${m.c};border-color:${m.c}40;background:${m.c}14">${m.t}</span>`;
  }

  // ── Render ───────────────────────────────────────────────────────
  function _open() {
    _close();
    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.className = 'acp-overlay';
    root.innerHTML = _shellHTML();
    document.body.appendChild(root);
    _bindEvents(root);
    _loadList();
    // ESC ile kapat
    _escHandler = (e) => { if (e.key === 'Escape') _close(); };
    document.addEventListener('keydown', _escHandler);
  }
  let _escHandler = null;

  function _close() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    if (_escHandler) document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }

  function _shellHTML() {
    return `
      <div class="acp-modal" role="dialog" aria-modal="true">
        <div class="acp-header">
          <div class="acp-title">🔑 Premium Kod Yönetimi</div>
          <button class="acp-close" data-acp-act="close" aria-label="Kapat">✕</button>
        </div>

        <div class="acp-body">
          <!-- CREATE FORM -->
          <details class="acp-create" open>
            <summary class="acp-create-title">Yeni Kod Oluştur</summary>
            <div class="acp-create-grid">
              <label class="acp-field">
                <span>Plan</span>
                <select data-acp-create="plan_id">
                  <optgroup label="Premium Kod">
                    <option value="daily">Daily ($20 / 1 gün)</option>
                    <option value="weekly" selected>Weekly ($100 / 7 gün)</option>
                    <option value="monthly">Monthly ($300 / 30 gün)</option>
                  </optgroup>
                  <optgroup label="Elite Kod">
                    <option value="elite7">⭐ Elite Pass (7 gün)</option>
                  </optgroup>
                </select>
              </label>
              <label class="acp-field">
                <span>Adet</span>
                <input type="number" min="1" max="50" value="1" data-acp-create="count">
              </label>
              <label class="acp-field">
                <span>Kaynak</span>
                <select data-acp-create="source">
                  <option value="manual">Manuel</option>
                  <option value="sale">Satış</option>
                </select>
              </label>
              <label class="acp-field acp-field-wide">
                <span>Kime atandı (opsiyonel)</span>
                <input type="text" maxlength="200" placeholder="Ahmet / @kullanici / e-posta" data-acp-create="assigned_to">
              </label>
              <label class="acp-field acp-field-full">
                <span>Notlar (opsiyonel)</span>
                <input type="text" maxlength="500" placeholder="Not..." data-acp-create="notes">
              </label>
            </div>
            <div class="acp-create-actions">
              <button class="acp-btn acp-btn-primary" data-acp-act="create">+ Kod Oluştur</button>
            </div>
            <div class="acp-create-result" data-acp-result hidden></div>
          </details>

          <!-- FILTERS -->
          <div class="acp-filters">
            <div class="acp-tabs" data-acp-tabs>
              <button class="acp-tab acp-tab-active" data-status="all">Tümü</button>
              <button class="acp-tab" data-status="unused">Kullanılabilir</button>
              <button class="acp-tab" data-status="active">Aktif</button>
              <button class="acp-tab" data-status="expired">Süresi Dolan</button>
              <button class="acp-tab" data-status="revoked">İptal</button>
              <button class="acp-tab" data-status="sales">Manuel/Satış</button>
            </div>
            <div class="acp-filter-right">
              <select data-acp-plan-filter>
                <option value="all">Tüm planlar</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <button class="acp-btn acp-btn-ghost" data-acp-act="refresh">↻ Yenile</button>
            </div>
          </div>

          <!-- TABLE -->
          <div class="acp-table-wrap" data-acp-table>
            <div class="acp-loading">Yükleniyor…</div>
          </div>
        </div>
      </div>
    `;
  }

  function _renderTable(rows) {
    const wrap = document.querySelector('[data-acp-table]');
    if (!wrap) return;

    // Filtreleme
    let list = rows.slice();
    if (_state.filterStatus === 'sales') {
      list = list.filter(r => r.source === 'manual' || r.source === 'sale');
    } else if (_state.filterStatus !== 'all') {
      list = list.filter(r => r.status === _state.filterStatus);
    }
    if (_state.filterPlan !== 'all') {
      list = list.filter(r => r.plan_id === _state.filterPlan);
    }

    if (list.length === 0) {
      wrap.innerHTML = `<div class="acp-empty">Bu filtreyle eşleşen kod yok.</div>`;
      return;
    }

    const rowsHTML = list.map(r => `
      <tr data-acp-row data-id="${_esc(r.id)}">
        <td><code class="acp-code">${_esc(r.code_preview)}</code></td>
        <td>${_esc(r.plan_name || r.plan_id || '—')}</td>
        <td>${_statusBadge(r.status)}</td>
        <td>${_fmtDate(r.created_at)}</td>
        <td>${_fmtDate(r.activated_at)}</td>
        <td>${_fmtDate(r.expires_at)}</td>
        <td>${_daysLeft(r.expires_at)}</td>
        <td>${(r.active_devices ?? 0)}/${(r.max_devices ?? 2)}</td>
        <td>${_esc(r.source || '—')}</td>
        <td>${_esc(r.assigned_to || '—')}</td>
        <td class="acp-actions">
          ${r.status !== 'revoked'
            ? `<button class="acp-mini acp-mini-danger" data-acp-act="revoke" data-id="${_esc(r.id)}" title="İptal Et">⊘</button>` : ''}
          <button class="acp-mini" data-acp-act="reset_devices" data-id="${_esc(r.id)}" title="Cihazları Sıfırla">⟲</button>
          <button class="acp-mini" data-acp-act="extend" data-id="${_esc(r.id)}" title="Süre Uzat">+gün</button>
        </td>
      </tr>
    `).join('');

    wrap.innerHTML = `
      <table class="acp-table">
        <thead>
          <tr>
            <th>Kod</th><th>Plan</th><th>Durum</th><th>Oluşturuldu</th>
            <th>Aktivasyon</th><th>Bitiş</th><th>Kalan</th>
            <th>Cihaz</th><th>Kaynak</th><th>Atanan</th><th>Aksiyon</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      <div class="acp-table-footer">${list.length} kayıt</div>
    `;
  }

  // ── Events ───────────────────────────────────────────────────────
  function _bindEvents(root) {
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-acp-act], [data-status]');
      if (!t) {
        // Overlay dışı tıklama → kapat
        if (e.target === root) _close();
        return;
      }
      const act = t.getAttribute('data-acp-act');
      const status = t.getAttribute('data-status');

      if (status) {
        // Sekme değişimi
        _state.filterStatus = status;
        root.querySelectorAll('.acp-tab').forEach(b => b.classList.toggle('acp-tab-active', b === t));
        _renderTable(_state.rows);
        return;
      }

      if (act === 'close') return _close();
      if (act === 'refresh') return _loadList();
      if (act === 'create') return _doCreate(root);
      if (act === 'revoke') return _doRevoke(t.getAttribute('data-id'));
      if (act === 'reset_devices') return _doResetDevices(t.getAttribute('data-id'));
      if (act === 'extend') return _doExtend(t.getAttribute('data-id'));
    });

    const planSel = root.querySelector('[data-acp-plan-filter]');
    if (planSel) planSel.addEventListener('change', () => {
      _state.filterPlan = planSel.value;
      _renderTable(_state.rows);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────
  async function _loadList() {
    const wrap = document.querySelector('[data-acp-table]');
    if (wrap) wrap.innerHTML = `<div class="acp-loading">Yükleniyor…</div>`;
    try {
      const r = await _apiCall({ action: 'list' });
      if (!r.ok) throw new Error(r.error || 'list_failed');
      _state.rows = r.rows || [];
      _renderTable(_state.rows);
    } catch (e) {
      if (wrap) wrap.innerHTML = `<div class="acp-error">Yükleme hatası: ${_esc(e.message || e)}</div>`;
    }
  }

  async function _doCreate(root) {
    const get = (k) => root.querySelector(`[data-acp-create="${k}"]`)?.value;
    const params = {
      action: 'create',
      plan_id: get('plan_id'),
      count: Number(get('count') || 1),
      source: get('source'),
      assigned_to: get('assigned_to') || null,
      notes: get('notes') || null,
    };
    const resultBox = root.querySelector('[data-acp-result]');
    resultBox.hidden = false;
    resultBox.innerHTML = `<div class="acp-loading">Oluşturuluyor…</div>`;

    try {
      const r = await _apiCall(params);
      if (!r.ok) throw new Error(r.error || 'create_failed');
      const codes = r.created || [];
      resultBox.innerHTML = `
        <div class="acp-result-title">✓ ${codes.length} kod oluşturuldu — KODLARI ŞİMDİ KOPYALA, BİR DAHA GÖSTERİLMEYECEK:</div>
        <ul class="acp-code-list">
          ${codes.map(c => `
            <li>
              <code class="acp-code-full">${_esc(c.code)}</code>
              <button class="acp-mini" data-copy="${_esc(c.code)}">Kopyala</button>
            </li>`).join('')}
        </ul>
        <button class="acp-btn acp-btn-ghost" data-copy-all="${_esc(codes.map(c=>c.code).join('\n'))}">Tümünü Kopyala</button>
      `;
      // Kopyala butonları
      resultBox.querySelectorAll('[data-copy]').forEach(b => {
        b.addEventListener('click', () => _copy(b.getAttribute('data-copy')));
      });
      const all = resultBox.querySelector('[data-copy-all]');
      if (all) all.addEventListener('click', () => _copy(all.getAttribute('data-copy-all')));
      _loadList();
    } catch (e) {
      resultBox.innerHTML = `<div class="acp-error">Hata: ${_esc(e.message || e)}</div>`;
    }
  }

  function _copy(text) {
    try {
      navigator.clipboard.writeText(text);
      NS.Toast?.success?.('Kopyalandı');
    } catch { NS.Toast?.error?.('Kopyalanamadı'); }
  }

  async function _doRevoke(id) {
    if (!id) return;
    const reason = prompt('İptal nedeni (opsiyonel):', '') || '';
    if (!confirm('Bu kod iptal edilecek. Emin misin?')) return;
    try {
      const r = await _apiCall({ action: 'revoke', id, reason });
      if (!r.ok) throw new Error(r.error || 'revoke_failed');
      NS.Toast?.success?.('Kod iptal edildi');
      _loadList();
    } catch (e) {
      NS.Toast?.error?.('Hata: ' + (e.message || e));
    }
  }

  async function _doResetDevices(id) {
    if (!id) return;
    if (!confirm('Bu kodun cihaz listesi sıfırlanacak. Kullanıcı tekrar 2 cihaza kadar giriş yapabilir. Emin misin?')) return;
    try {
      const r = await _apiCall({ action: 'reset_devices', id });
      if (!r.ok) throw new Error(r.error || 'reset_failed');
      NS.Toast?.success?.('Cihazlar sıfırlandı');
      _loadList();
    } catch (e) {
      NS.Toast?.error?.('Hata: ' + (e.message || e));
    }
  }

  async function _doExtend(id) {
    if (!id) return;
    const days = parseInt(prompt('Kaç gün eklensin? (1-365)', '7') || '0', 10);
    if (!days || days < 1 || days > 365) return;
    try {
      const r = await _apiCall({ action: 'extend', id, days });
      if (!r.ok) throw new Error(r.error || 'extend_failed');
      NS.Toast?.success?.(`+${days} gün eklendi`);
      _loadList();
    } catch (e) {
      NS.Toast?.error?.('Hata: ' + (e.message || e));
    }
  }

  // ── Public API ───────────────────────────────────────────────────
  NS.AdminCodesPanel = {
    open: _open,
    close: _close,
  };
})();
