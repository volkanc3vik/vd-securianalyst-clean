// ════════════════════════════════════════════════════════════════════
// ui/intelligence/setup-tracker.js
// AI CANLI TAKİP — DERECELİ SETUP PANELİ  (Build 109)
//
// Sistemin OTOMATİK açtığı (pending) takip kayıtlarını okur, her birini
// arşiv ÖĞRENME istatistiğiyle (window.VDInsights) eşleştirip kademeli bir
// ROZET (A+/A/B/C/⚠) takar. En yeni açılan kayıt en üstte. Satıra tıklayınca
// o coin yüklenir (openCoin).
//
// • YALNIZCA ADMIN görür (VDAccess.isAdmin / aap_access_v1.isAdmin).
// • Pending kayıtlar RLS gereği sadece admin-key ile okunur →
//   TelegramDispatcher.adminFetch('/api/analysis-archive', {action:'list_pending'}).
// • Öğrenme verisi (doğrulanmış geçmiş) public okunur (VDInsights.load).
// • SALT-OKUNUR: çekirdek scanner/motor/outcome mantığına DOKUNMAZ, DB'ye yazmaz.
// • Hata olsa bile sayfayı/akışı ETKİLEMEZ (her şey try/catch).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const TAG = '[SetupTracker]';
  const CID = 'setupTracker';
  const MAX_ROWS = 10;          // en yeni açılan kaç kayıt gösterilsin
  const FETCH_LIMIT = 25;       // sunucudan çekilecek pending sayısı (sonra 10'a kırpılır)
  const REFRESH_MS = 90 * 1000; // periyodik tazeleme

  const _num = (v) => { const n = Number(v); return isNaN(n) ? null : n; };
  const _esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // ── Admin tespiti (site giriş admin kodu yeterli) ──────────────────
  function _isAdmin() {
    try {
      if (window.VDAccess && typeof window.VDAccess.isAdmin === 'function') return window.VDAccess.isAdmin();
    } catch (e) {}
    try {
      const raw = localStorage.getItem('aap_access_v1');
      if (raw) { const d = JSON.parse(raw); if (d && d.isAdmin === true) return true; }
    } catch (e) {}
    return false;
  }
  function _disp() { return window.TelegramDispatcher || null; }
  function _hasKey() { const d = _disp(); return !!(d && d.hasAdminKey && d.hasAdminKey()); }

  // ── Yardımcılar ────────────────────────────────────────────────────
  function _dirWord(bias) {
    if (bias === 'bullish') return { txt: 'Yukarı Yönlü', cls: 'st-up', arrow: '▲' };
    if (bias === 'bearish') return { txt: 'Aşağı Yönlü', cls: 'st-down', arrow: '▼' };
    return { txt: 'Nötr', cls: 'st-flat', arrow: '◆' };
  }
  function _sourceWord(src) {
    if (src === 'ai_engine_auto') return 'auto';
    if (src === 'ai_engine') return 'manuel';
    return src ? String(src).slice(0, 12) : '—';
  }
  function _ago(iso) {
    try {
      const t = Date.parse(iso); if (isNaN(t)) return '';
      const m = Math.max(0, Math.round((Date.now() - t) / 60000));
      if (m < 1) return 'az önce';
      if (m < 60) return m + ' dk önce';
      const h = Math.round(m / 60);
      if (h < 24) return h + ' saat önce';
      return Math.round(h / 24) + ' gün önce';
    } catch (e) { return ''; }
  }
  function _fmtPrice(p) {
    const n = _num(p); if (n == null) return '—';
    const a = Math.abs(n);
    const dec = a >= 100 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 5 : 8;
    return '$' + n.toFixed(dec).replace(/\.?0+$/, m => (m.indexOf('.') === 0 ? '' : m));
  }

  // ── DERECELENDİRME: kaydın setup'ını arşiv istatistiğiyle eşle ──────
  // VDInsights._features(rec) → ['bias:bearish','conf:>85','risk:med', ...]
  // computeInsights → satırlar {key,label,n,rate}. Kaydın tüm token'ları
  // içinde olan EN İYİ KANITLI satırı (kombo öncelikli, n yüksek) seç.
  function _grade(rec, insights) {
    const eng = window.VDInsights;
    if (!eng || typeof eng._features !== 'function' || !insights) return null;
    let feats;
    try { feats = eng._features(rec) || []; } catch (e) { feats = []; }
    if (!feats.length) return null;
    const fset = new Set(feats);
    const rows = (insights.rows || []).filter(r => {
      const toks = String(r.key).split(' & ');
      return toks.every(t => fset.has(t));
    });
    if (!rows.length) return null;
    const MIN = eng.MIN_SAMPLE || 5;
    const ok = rows.filter(r => r.n >= MIN);
    const pool = ok.length ? ok : rows;
    // kombo (2+ token) öncelikli; sonra örnek sayısı; sonra oran
    pool.sort((a, b) => {
      const ca = a.key.includes(' & ') ? 1 : 0, cb = b.key.includes(' & ') ? 1 : 0;
      return cb - ca || b.n - a.n || b.rate - a.rate;
    });
    return pool[0] || null;
  }
  function _badge(match) {
    if (!match || match.n < ((window.VDInsights && window.VDInsights.MIN_SAMPLE) || 5)) {
      return { g: '—', cls: 'st-gray', tip: 'yetersiz veri' };
    }
    const r = match.rate;
    if (r >= 90 && match.n >= 10) return { g: 'A+', cls: 'st-aplus', tip: 'çok yüksek tutarlılık' };
    if (r >= 80) return { g: 'A', cls: 'st-a', tip: 'yüksek tutarlılık' };
    if (r >= 65) return { g: 'B', cls: 'st-b', tip: 'orta-iyi tutarlılık' };
    if (r >= 50) return { g: 'C', cls: 'st-c', tip: 'orta tutarlılık' };
    return { g: '⚠', cls: 'st-warn', tip: 'düşük tutarlılık' };
  }

  // ── Stil (tek sefer enjekte) ───────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('st-style')) return;
    const css = `
    #${CID}{margin:0 0 20px;}
    .st-card{background:var(--glass);border:1px solid var(--border);border-radius:12px;
      padding:12px 14px;backdrop-filter:blur(20px);}
    .st-hdr{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;}
    .st-title{font-size:13px;font-weight:800;color:var(--text);letter-spacing:.3px;}
    .st-tag{font-size:10px;font-weight:700;color:var(--purple);border:1px solid rgba(157,125,250,.4);
      border-radius:6px;padding:2px 7px;background:rgba(157,125,250,.08);}
    .st-count{font-size:11px;color:var(--text3);margin-left:auto;}
    .st-refresh{font-size:11px;font-weight:700;color:var(--text2);background:transparent;
      border:1px solid var(--border);border-radius:7px;padding:3px 9px;cursor:pointer;}
    .st-refresh:hover{border-color:var(--green);color:var(--green);}
    .st-sub{font-size:11px;color:var(--text3);margin:2px 0 9px;}
    .st-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;
      padding:9px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:7px;
      cursor:pointer;transition:border-color .15s,background .15s;background:rgba(255,255,255,.015);}
    .st-row:hover{border-color:var(--green);background:rgba(0,229,160,.05);}
    .st-badge{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      font-weight:900;font-size:15px;flex-shrink:0;border:1.5px solid;}
    .st-aplus{color:#04101f;background:linear-gradient(135deg,#ffd76a,#ffb020);border-color:#ffd76a;
      box-shadow:0 0 14px rgba(255,200,80,.35);}
    .st-a{color:var(--green);background:rgba(0,229,160,.12);border-color:rgba(0,229,160,.5);}
    .st-b{color:var(--yellow);background:rgba(255,193,7,.1);border-color:rgba(255,193,7,.45);}
    .st-c{color:var(--yellow);background:rgba(255,193,7,.06);border-color:rgba(255,193,7,.3);}
    .st-warn{color:var(--red);background:rgba(255,61,107,.1);border-color:rgba(255,61,107,.45);}
    .st-gray{color:var(--text3);background:rgba(255,255,255,.04);border-color:var(--border);font-size:18px;}
    .st-mid{min-width:0;}
    .st-line1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
    .st-sym{font-size:14px;font-weight:800;color:var(--text);}
    .st-dir{font-size:11px;font-weight:700;}
    .st-up{color:var(--green);} .st-down{color:var(--red);} .st-flat{color:var(--text2);}
    .st-setup{font-size:11px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .st-meta{font-size:10px;color:var(--text3);margin-top:3px;}
    .st-right{text-align:right;flex-shrink:0;}
    .st-rate{font-size:13px;font-weight:800;}
    .st-rate.hi{color:var(--green);} .st-rate.mid{color:var(--yellow);} .st-rate.lo{color:var(--red);} .st-rate.na{color:var(--text3);}
    .st-rate-sub{font-size:10px;color:var(--text3);margin-top:1px;}
    .st-empty{font-size:12px;color:var(--text3);padding:10px 2px;text-align:center;}
    .st-note{font-size:10px;color:var(--text3);margin-top:8px;line-height:1.4;}
    `;
    const el = document.createElement('style');
    el.id = 'st-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function _rateClass(r) { return r == null ? 'na' : r >= 70 ? 'hi' : r >= 50 ? 'mid' : 'lo'; }

  function _rowHTML(rec, insights) {
    const sym = String(rec.sym || '').toUpperCase();
    const d = _dirWord(rec.direction_bias);
    const match = _grade(rec, insights);
    const badge = _badge(match);
    const rate = match && match.n >= ((window.VDInsights && window.VDInsights.MIN_SAMPLE) || 5) ? match.rate : null;
    const setupLabel = match ? match.label : 'setup eşleşmesi için yeterli geçmiş yok';
    const src = _sourceWord(rec.source);
    return `
      <div class="st-row" data-sym="${_esc(sym)}" title="${_esc(badge.tip)}">
        <div class="st-badge ${badge.cls}">${_esc(badge.g)}</div>
        <div class="st-mid">
          <div class="st-line1">
            <span class="st-sym">${_esc(sym)}</span>
            <span class="st-dir ${d.cls}">${d.arrow} ${_esc(d.txt)}</span>
          </div>
          <div class="st-setup">${_esc(setupLabel)}</div>
          <div class="st-meta">${_fmtPrice(rec.price_at_analysis)} · ${_esc(_ago(rec.created_at))} · ${_esc(src)}</div>
        </div>
        <div class="st-right">
          <div class="st-rate ${_rateClass(rate)}">${rate == null ? '—' : '%' + rate}</div>
          <div class="st-rate-sub">${match && match.n ? match.n + ' örnek' : 'veri yok'}</div>
        </div>
      </div>`;
  }

  function _shell(inner) {
    return `<div class="st-card">
      <div class="st-hdr">
        <span class="st-title">🎯 AI Canlı Takip — Setup Derecesi</span>
        <span class="st-tag">yalnızca admin</span>
        <span class="st-count" id="st-count"></span>
        <button class="st-refresh" id="st-refresh">↻ Yenile</button>
      </div>
      ${inner}
    </div>`;
  }

  // ── Veri + render ──────────────────────────────────────────────────
  let _busy = false;
  async function _fetchPending() {
    const d = _disp();
    if (!d || typeof d.adminFetch !== 'function') return { err: 'no_disp' };
    if (!_hasKey()) return { err: 'no_key' };
    try {
      const r = await d.adminFetch('/api/analysis-archive', { action: 'list_pending', limit: FETCH_LIMIT });
      const list = (r && (r.rows || r.list || r.data)) || (Array.isArray(r) ? r : []);
      return { rows: Array.isArray(list) ? list : [] };
    } catch (e) {
      console.warn(TAG, 'pending alınamadı:', e && e.message);
      return { err: 'fetch' };
    }
  }

  async function render() {
    const host = document.getElementById(CID);
    if (!host) return;
    if (!_isAdmin()) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    _injectCSS();

    if (_busy) return;
    _busy = true;
    try {
      if (!window.VDInsights || typeof window.VDInsights.load !== 'function') {
        host.innerHTML = _shell(`<div class="st-empty">Öğrenme modülü yükleniyor… sayfa hazır olunca görünecek.</div>`);
        return;
      }
      // 1) öğrenme verisi (public — doğrulanmış geçmiş)
      let records = [];
      try { records = await window.VDInsights.load(); } catch (e) {}
      let insights = { rows: [], total: 0 };
      try { insights = window.VDInsights.computeInsights(records) || insights; } catch (e) {}

      // 2) açık (pending) takip kayıtları (admin-key)
      const pend = await _fetchPending();
      if (pend.err === 'no_key') {
        host.innerHTML = _shell(`<div class="st-empty">Bu paneli açmak için admin anahtarını bir kez etkinleştir.<br>(Bu oturum boyunca hatırlanır, tarayıcıyı kapatınca tekrar sorar.)</div>`);
        return;
      }
      if (pend.err) {
        host.innerHTML = _shell(`<div class="st-empty">Veri şu an alınamadı. "↻ Yenile" ile tekrar deneyebilirsin.</div>`);
        return;
      }

      // 3) en yeni açılan önce → ilk MAX_ROWS
      const rows = (pend.rows || [])
        .filter(r => r && r.sym)
        .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
        .slice(0, MAX_ROWS);

      const cntEl = () => document.getElementById('st-count');
      if (!rows.length) {
        host.innerHTML = _shell(`<div class="st-empty">Şu an açık takip kaydı yok. Sistem yeni kayıt açtıkça burada en üstte belirir.</div>`);
      } else {
        const learnNote = insights.total
          ? `Dereceler son ${insights.total} doğrulanmış analizin istatistiğinden hesaplanır.`
          : `Henüz yeterli doğrulanmış geçmiş yok — dereceler veri biriktikçe netleşir.`;
        host.innerHTML = _shell(
          `<div class="st-sub">En yeni açılan ${rows.length} takip · derece = setup'ın geçmiş tutarlılığı</div>` +
          rows.map(r => _rowHTML(r, insights)).join('') +
          `<div class="st-note">${_esc(learnNote)} ⚠ Geçmiş tutarlılığı gösterir; gelecek getiri garantisi değildir.</div>`
        );
      }
      const c = cntEl(); if (c) c.textContent = rows.length ? rows.length + ' açık' : '';

      // tıklama → coin yükle
      host.querySelectorAll('.st-row').forEach(el => {
        el.addEventListener('click', () => {
          const s = el.getAttribute('data-sym');
          if (s && typeof window.openCoin === 'function') window.openCoin(s);
        });
      });
      const rb = document.getElementById('st-refresh');
      if (rb) rb.addEventListener('click', () => { try { window.VDInsights.load(true); } catch (e) {} render(); });
    } catch (e) {
      console.error(TAG, 'render hata:', e);
      try { host.innerHTML = _shell(`<div class="st-empty">Panel gösterilemedi (konsola bakın).</div>`); } catch (e2) {}
    } finally {
      _busy = false;
    }
  }

  // ── Tetikleyiciler ─────────────────────────────────────────────────
  function _boot() {
    render();
    // VDAccess / admin-key geç yüklenebilir → birkaç gecikmeli deneme
    [800, 2000, 4000].forEach(ms => setTimeout(() => { try { render(); } catch (e) {} }, ms));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  // sistem yeni kayıt açınca / bir kayıt incelenince tazele
  window.addEventListener('vd:archive:created', () => { try { render(); } catch (e) {} });
  window.addEventListener('vd:archive:reviewed', () => { try { window.VDInsights && window.VDInsights.load(true); render(); } catch (e) {} });
  // periyodik
  setInterval(() => { try { render(); } catch (e) {} }, REFRESH_MS);

  // dışarıdan erişim (debug)
  window.VDSetupTracker = { render };
})();
