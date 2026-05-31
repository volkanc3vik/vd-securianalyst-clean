// ════════════════════════════════════════════════════════════════════
// features/timeline/event-store.js
// market_events_v1 için SAYFADAN BAĞIMSIZ, READ-ONLY erişim katmanı.
//
// Market Event Center (index.html) bu depoya YAZAR.
// Market Timeline (ileride) ve Dashboard özeti bu katmanla OKUR.
// Hiçbir yazma/dedupe mantığı burada yok — sadece okuma + filtre + sıralama.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDEventStore) return;

  const KEY = 'market_events_v1';
  const CATEGORIES = ['piyasa', 'likidite', 'momentum', 'risk', 'ogren', 'referans'];
  const META = {
    piyasa:   { label: 'Piyasa',   icon: '🌐', color: '#00D1FF' },
    likidite: { label: 'Likidite', icon: '💧', color: '#2B8EFF' },
    momentum: { label: 'Momentum', icon: '⚡', color: '#00E5A0' },
    risk:     { label: 'Risk',     icon: '⚠',  color: '#FF3D6B' },
    ogren:    { label: 'Öğren',    icon: '🎓', color: '#FFC247' },
    referans: { label: 'Referans', icon: '🔗', color: '#5CDFFF' },
  };

  function _all() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  // Depo zaten yeni→eski sırada (unshift). İhtiyaca göre ts'e göre de sıralanabilir.
  function _sorted() { return _all().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)); }

  window.VDEventStore = {
    CATEGORIES: CATEGORIES.slice(),
    META: META,
    getAll() { return _sorted(); },
    getLatest(n) { return _sorted().slice(0, n || 5); },
    getByCategory(cat) { return _sorted().filter(e => e.category === cat); },
    getBySymbol(sym) { return _sorted().filter(e => e.sym === sym); },
    count() { return _all().length; },
    metaFor(cat) { return META[cat] || META.piyasa; },
  };
})();
