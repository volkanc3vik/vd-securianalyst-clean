// ════════════════════════════════════════════════════════════════════
// modules/dashboard-snapshot.js  — PHASE A
// DASHBOARD VISUAL SNAPSHOT CACHE (yalnız görsel)
//
// v48 NEDEN ÇÖKTÜ: cache verisi vd:scan:complete ile CANLI intelligence
// pipeline'a verildi; TI motorları eksik (closes/candles'sız) veriyle bozuldu
// ve _processing kilitlendi.
//
// BU FAZIN KESİN KURALI: cache ASLA pipeline'a verilmez.
//   • vd:scan:complete YAYINLANMAZ (yalnız pasif dinlenir)
//   • VD_STATE'e veri INJECT EDİLMEZ
//   • ti-controller / scanner / market-event-feeder TETİKLENMEZ
//   • closes/candles cache'lenmez
//   • Yalnızca son dashboard görünümünün DOM innerHTML snapshot'ı
//     geçici olarak geri yüklenir; canlı render gelince yerini alır.
//
// GÜVENLİK: restore yalnız "pristine" (boş ya da yalnız loading placeholder)
// konteynerlere yapılır → canlı mount/render edilmiş içerik ASLA ezilmez.
// window.VDDashSnapshot
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDDashSnapshot) return;
  const KEY = 'vd_dash_snapshot_v1';
  const MAX_AGE_MS = 30 * 60 * 1000;
  // Yalnız sade innerHTML konteynerleri. (Canlı widget'lı intelligenceSection HARİÇ.)
  const IDS = ['longGrid', 'shortGrid', 'jokerGrid', 'tiPanelMount'];
  const SCAN_TXT_ID = 'scanTxt';
  const BANNER = '📦 Önbellekten gösteriliyor · canlı tarama yenileniyor…';

  const byId = (id) => document.getElementById(id);

  // Konteyner GERÇEK veriyle dolu mu? (snapshot almaya değer mi)
  function _isPopulated(id) {
    const el = byId(id);
    if (!el) return false;
    if (id === 'tiPanelMount') {
      return el.children.length > 0 && !/başlatılıyor|bekleniyor/i.test(el.textContent || '');
    }
    const kids = Array.from(el.children);
    if (!kids.length) return false;
    return kids.some(c => !c.classList.contains('loading') && !/Taranıyor/i.test(c.textContent || ''));
  }

  // Konteyner "pristine" mı? (boş ya da yalnız loading placeholder) → restore güvenli
  function _isPristine(id) {
    const el = byId(id);
    if (!el) return false;
    if (id === 'tiPanelMount') {
      // Boş VEYA başlangıç shell'i (canlı veri yok) → restore güvenli.
      // GERÇEK işlenmiş veri varsa ASLA dokunma (canlı render ezilmez).
      if (el.children.length === 0) return true;
      return /başlatılıyor|İlk tarama|veri bekleniyor/i.test(el.textContent || '');
    }
    const kids = Array.from(el.children);
    return kids.length === 0 || kids.every(c => c.classList.contains('loading') || /Taranıyor/i.test(c.textContent || ''));
  }

  function capture() {
    try {
      const snap = {};
      IDS.forEach(id => { if (_isPopulated(id)) snap[id] = byId(id).innerHTML; });
      if (!Object.keys(snap).length) return;     // dolu konteyner yoksa kaydetme
      sessionStorage.setItem(KEY, JSON.stringify({ html: snap, ts: Date.now() }));
    } catch (e) { /* kota/erişim → sessiz */ }
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

  function restore() {
    try {
      const p = load();
      if (!p) return false;
      if ((Date.now() - p.ts) > MAX_AGE_MS) return false;   // çok bayat
      let any = false;
      Object.keys(p.html).forEach(id => {
        if (_isPristine(id)) {        // ASLA canlı içeriği ezme
          const el = byId(id);
          if (el) { el.innerHTML = p.html[id]; any = true; }
        }
      });
      if (any) {
        const st = byId(SCAN_TXT_ID);
        if (st) st.textContent = `${BANNER} (${ageLabel(p.ts)})`;
        console.log('[DashSnapshot] restore:', Object.keys(p.html).join(','), '·', ageLabel(p.ts));
      }
      return any;
    } catch (e) { console.warn('[DashSnapshot] restore hata:', e); return false; }
  }

  // ── Tetikleyiciler ──
  // RESTORE: açılışta (canlı scan'den ÖNCE) — yalnız pristine konteynerlere.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true });
  else restore();

  // CAPTURE: sayfadan ayrılırken (en taze hal) + sekme gizlenince.
  window.addEventListener('pagehide', capture);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') capture(); });

  // CAPTURE: canlı tarama bitince (PASİF dinleme — yalnız okur/kaydeder, hiçbir şey yayınlamaz/tetiklemez).
  // TI panelinin taze render'ını yakalamak için kısa gecikme.
  window.addEventListener('vd:scan:complete', () => { setTimeout(capture, 1800); });

  window.VDDashSnapshot = { capture, restore, load, ageLabel };
})();
