// ════════════════════════════════════════════════════════════════════
// modules/dashboard-cache.js
// DASHBOARD STATE PERSISTENCE & SMART CACHE
//
// Sorun: Dashboard ↔ Archive/Timeline AYRI sayfalar → Dashboard'a dönüş
// tam sayfa reload → window.VD_STATE bellekte sıfırlanır → tarama baştan
// → kullanıcı boş ekran görür.
//
// Çözüm: tarama sonuçlarını sessionStorage'a yaz; Dashboard açılır açılmaz
// son kartları ANINDA bas (VDRenderScan), arka planda normal tarama sessizce
// devam eder ve yeni veri gelince kartları sessizce günceller.
//
// Öncelik: 1) bellek (window.VD_STATE) 2) sessionStorage fallback.
// Yalnız Dashboard'ı etkiler. Scanner/veri akışı değiştirilmez.
// window.VDDashCache
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDDashCache) return;
  const KEY = 'vd_dash_cache_v1';
  const MAX_AGE_MS = 30 * 60 * 1000;   // 30 dk üstü cache gösterilmez (çok bayat)

  // sessionStorage'a sığması için ağır alanları (closes/candles) at — render bunları kullanmaz
  function _slim(results) {
    if (!Array.isArray(results)) return [];
    return results.map(r => {
      const c = Object.assign({}, r);
      delete c.closes; delete c.candles;
      return c;
    });
  }

  function save(results) {
    try {
      if (!Array.isArray(results) || !results.length) return;
      const payload = { results: _slim(results), ts: Date.now() };
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) { /* kota/erişim hatası → sessiz geç */ }
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.results) || !p.results.length) return null;
      return p;
    } catch (e) { return null; }
  }

  function ageMs() { const p = load(); return p ? (Date.now() - p.ts) : Infinity; }

  function ageLabel(ts) {
    const ms = Date.now() - ts;
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'az önce';
    if (min === 1) return '1 dk önce';
    if (min < 60) return min + ' dk önce';
    const h = Math.floor(min / 60);
    return h + ' sa önce';
  }

  // Dashboard açılışında: cache varsa kartları anında bas (boş ekran yok)
  function hydrate() {
    try {
      const p = load();
      if (!p) return false;
      if ((Date.now() - p.ts) > MAX_AGE_MS) return false;   // çok bayat → normal tarama doldursun
      if (typeof window.VDRenderScan !== 'function') return false;

      // 1) bellek state'i doldur (öncelik bellek)
      window.VD_STATE = window.VD_STATE || {};
      window.VD_STATE.scanResults = p.results;
      window._lastScanResults = p.results;

      // 2) kartları + panelleri anında bas (taramayla aynı yol)
      window.VDRenderScan(p.results);

      // 3) "Son güncelleme" bilgisini göster
      try {
        const el = document.getElementById('scanTxt');
        if (el) el.textContent = `Son güncelleme: ${ageLabel(p.ts)} · arka planda yenileniyor…`;
      } catch (e) {}

      // 4) panel listener'ları (best setup / watchlist / overview / timeline özeti) tetikle
      try { window.dispatchEvent(new CustomEvent('vd:scan:complete', { detail: { results: p.results, fromCache: true } })); } catch (e) {}

      console.log('[DashCache] hydrate:', p.results.length, 'coin ·', ageLabel(p.ts));
      return true;
    } catch (e) { console.warn('[DashCache] hydrate hata:', e); return false; }
  }

  window.VDDashCache = { save, load, hydrate, ageMs, ageLabel };

  // Dashboard yüklenince mümkün olan en erken anda hydrate et (2 sn'lik taramadan ÖNCE)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  else hydrate();
})();
