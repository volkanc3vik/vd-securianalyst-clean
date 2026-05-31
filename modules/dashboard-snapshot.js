// ════════════════════════════════════════════════════════════════════
// modules/dashboard-snapshot.js  — PHASE A (+ terminal overlay fix)
// DASHBOARD VISUAL SNAPSHOT CACHE (yalnız görsel)
//
// v48 NEDEN ÇÖKTÜ: cache verisi vd:scan:complete ile CANLI pipeline'a verildi.
// BU MODÜL: cache ASLA pipeline'a verilmez. vd:scan:complete YAYINLANMAZ,
// VD_STATE inject EDİLMEZ, ti-controller/scanner/feeder TETİKLENMEZ.
//
// SETUP KARTLARI (longGrid/shortGrid/jokerGrid): innerHTML restore
//   (pristine = boş/loading iken). Canlı scan bitince renderCard ezer.
//
// İSTİHBARAT TERMİNALİ (tiPanelMount): innerHTML restore YARIŞ KAYBEDİYOR —
//   TIPanel kendi render döngüsü (TIState ready=false) "başlatılıyor"u snapshot'ın
//   üstüne yazıyor. ÇÖZÜM: snapshot'ı canlı shell'in ÜZERİNE görsel KLON olarak
//   göster + canlı shell'i gizle. Render döngüsü gizli shell'de çalışır (görünmez).
//   Gerçek veri gelince klon kaldırılır, canlı shell gösterilir. Motora SIFIR temas.
// window.VDDashSnapshot
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDDashSnapshot) return;
  const KEY = 'vd_dash_snapshot_v1';
  const MAX_AGE_MS = 30 * 60 * 1000;
  const GRID_IDS = ['longGrid', 'shortGrid', 'jokerGrid'];
  const CAPTURE_IDS = ['longGrid', 'shortGrid', 'jokerGrid', 'tiPanelMount'];
  const TI_ID = 'tiPanelMount';
  const SCAN_TXT_ID = 'scanTxt';
  const SNAP_ID = 'vd-ti-snap';
  const BANNER = '📦 Önbellekten gösteriliyor · canlı tarama yenileniyor…';
  const INIT_RE = /başlatılıyor|İlk tarama|veri bekleniyor/i;

  const byId = (id) => document.getElementById(id);

  // ── Doluluk / pristine ──
  function _isPopulated(id) {
    const el = byId(id); if (!el) return false;
    if (id === TI_ID) return el.children.length > 0 && !INIT_RE.test(el.textContent || '');
    const kids = Array.from(el.children);
    if (!kids.length) return false;
    return kids.some(c => !c.classList.contains('loading') && !/Taranıyor/i.test(c.textContent || ''));
  }
  function _gridPristine(id) {
    const el = byId(id); if (!el) return false;
    const kids = Array.from(el.children);
    return kids.length === 0 || kids.every(c => c.classList.contains('loading') || /Taranıyor/i.test(c.textContent || ''));
  }
  // Terminal henüz canlı veriyle dolmamış mı? (boş ya da "başlatılıyor")
  function _terminalIsInitial(el) {
    if (!el) return false;
    return el.children.length === 0 || INIT_RE.test(el.textContent || '');
  }

  // ── Capture ──
  function capture() {
    try {
      const snap = {};
      CAPTURE_IDS.forEach(id => { if (_isPopulated(id)) snap[id] = byId(id).innerHTML; });
      if (!Object.keys(snap).length) return;
      sessionStorage.setItem(KEY, JSON.stringify({ html: snap, ts: Date.now() }));
    } catch (e) {}
  }
  function load() {
    try { const raw = sessionStorage.getItem(KEY); if (!raw) return null; const p = JSON.parse(raw); return (p && p.html) ? p : null; }
    catch (e) { return null; }
  }
  function ageLabel(ts) {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'az önce'; if (min === 1) return '1 dk önce';
    if (min < 60) return min + ' dk önce'; return Math.floor(min / 60) + ' sa önce';
  }

  // ── Terminal: snapshot'ı canlı shell üstünde KLON olarak göster ──
  let _tiWatch = null, _tiTimer = null, _tiDone = false;  // _tiDone: canlıya geçince klon bir daha eklenmez
  function _cleanupTerminalSnap() {
    try {
      const el = byId(TI_ID); if (!el) return;
      const snap = el.querySelector('#' + SNAP_ID); if (snap) snap.remove();
      // gizlenen canlı shell'i geri göster
      Array.from(el.children).forEach(ch => { if (ch.dataset && ch.dataset.vdHidden === '1') { ch.style.display = ch.dataset.vdPrevDisplay || ''; delete ch.dataset.vdHidden; delete ch.dataset.vdPrevDisplay; } });
    } catch (e) {}
    if (_tiWatch) { try { _tiWatch.disconnect(); } catch (e) {} _tiWatch = null; }
    if (_tiTimer) { clearTimeout(_tiTimer); _tiTimer = null; }
    _tiDone = true;
  }
  function _terminalLiveReady(el) {
    // canlı #tiGrid gerçek veriyle dolduysa (klon id'siz olduğundan #tiGrid tekildir = canlı)
    const grid = el.querySelector('#tiGrid');
    if (!grid) return false;
    const t = (grid.textContent || '').trim();
    return t.length > 40 && !INIT_RE.test(t);
  }
  function _restoreTerminal(snapHtml) {
    if (_tiDone) return false;
    const el = byId(TI_ID);
    if (!el || !snapHtml) return false;
    if (!_terminalIsInitial(el)) return false;   // canlı veri zaten varsa dokunma
    if (el.querySelector('#' + SNAP_ID)) return false;

    // canlı shell'i gizle (render döngüsü görünmez çalışsın), klonu üste koy
    Array.from(el.children).forEach(ch => {
      ch.dataset.vdHidden = '1';
      ch.dataset.vdPrevDisplay = ch.style.display || '';
      ch.style.display = 'none';
    });
    const clean = String(snapHtml).replace(/\sid="[^"]*"/g, '');   // duplicate id önle
    const snap = document.createElement('div');
    snap.id = SNAP_ID;
    snap.setAttribute('data-vd-snap', '1');
    snap.innerHTML = clean;
    el.appendChild(snap);

    // gerçek veri gelince klonu kaldır, canlıyı göster
    const check = () => { if (_terminalLiveReady(el)) _cleanupTerminalSnap(); };
    if (window.MutationObserver) {
      _tiWatch = new MutationObserver(check);
      _tiWatch.observe(el, { childList: true, subtree: true, characterData: true });
    }
    _tiTimer = setTimeout(_cleanupTerminalSnap, 30000);  // güvenlik: en geç 30 sn sonra canlıya bırak
    return true;
  }

  // ── Restore (açılışta) ──
  function restore() {
    try {
      const p = load();
      if (!p || (Date.now() - p.ts) > MAX_AGE_MS) return false;
      let any = false;
      // setup kartları: innerHTML restore (pristine iken)
      GRID_IDS.forEach(id => {
        if (p.html[id] && _gridPristine(id)) { const el = byId(id); if (el) { el.innerHTML = p.html[id]; any = true; } }
      });
      // terminal: klon overlay
      if (p.html[TI_ID] && _restoreTerminal(p.html[TI_ID])) any = true;
      if (any) {
        const st = byId(SCAN_TXT_ID);
        if (st) st.textContent = `${BANNER} (${ageLabel(p.ts)})`;
        console.log('[DashSnapshot] restore ·', ageLabel(p.ts));
      }
      return any;
    } catch (e) { console.warn('[DashSnapshot] restore hata:', e); return false; }
  }

  // ── Tetikleyiciler ──
  function _ensureTerminal() {
    try {
      if (_tiDone) return;
      const p = load();
      if (!p || (Date.now() - p.ts) > MAX_AGE_MS || !p.html[TI_ID]) return;
      const el = byId(TI_ID); if (!el) return;
      if (el.querySelector('#' + SNAP_ID)) return;     // klon duruyor
      if (!_terminalIsInitial(el)) return;             // canlı veri geldi → gerek yok
      _restoreTerminal(p.html[TI_ID]);                 // mount/_buildShell sildiyse tekrar koy
    } catch (e) {}
  }
  function _init() {
    setTimeout(restore, 60);          // ti-init mount/_render'dan hemen SONRA
    setTimeout(_ensureTerminal, 600); // geç mount _buildShell klonu sildiyse güvence
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init, { once: true });
  else _init();

  window.addEventListener('pagehide', capture);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') capture(); });
  // canlı tarama bitince (PASİF — yalnız okur/kaydeder) + olası kalan klonu temizle
  window.addEventListener('vd:scan:complete', () => { setTimeout(() => { _cleanupTerminalSnap(); capture(); }, 1800); });

  window.VDDashSnapshot = { capture, restore, load, ageLabel, _cleanupTerminalSnap };
})();
