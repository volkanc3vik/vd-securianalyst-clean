// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Presence heartbeat (build 161)
// Her ~45sn'de /api/admin-codes (action: ping) endpoint'ine dokunur.
// Anonim: session_id sessionStorage'da tutulur (sekme oturumuna özel),
// kişisel veri yok. Sessizce çalışır, hata olsa bile siteyi etkilemez.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SID_KEY = 'vd_presence_sid';
  var INTERVAL_MS = 45000;

  function makeSid() {
    try {
      if (window.crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '');
      }
    } catch (e) {}
    return 'sid' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function getSid() {
    var s = null;
    try { s = sessionStorage.getItem(SID_KEY); } catch (e) {}
    if (!s) {
      s = makeSid();
      try { sessionStorage.setItem(SID_KEY, s); } catch (e) {}
    }
    return s;
  }

  function ping() {
    try {
      fetch('/api/admin-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', sid: getSid() }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // İlk ping
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ping, { once: true });
  } else {
    ping();
  }
  // Periyodik
  setInterval(ping, INTERVAL_MS);
  // Sekmeye geri dönünce taze ping
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') ping();
  });
})();
