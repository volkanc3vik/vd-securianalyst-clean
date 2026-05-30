// ════════════════════════════════════════════════════════════════════
// modules/access-levels.js
// PREMIUM ACCESS LAYER FAZ 1 — merkezi seviye çözücü (SALT-OKUNUR)
//
// window.VDAccess.level() → 'admin' | 'premium' | 'teaser' | 'free'
//   admin   : aap_access_v1.isAdmin === true (teaser ASLA bunu set etmez)
//   premium : APP_ACCESS premium (access_code/auth)  — admin değilse
//   teaser  : geçerli (süresi dolmamış) teaser_access_v1 — premium/admin değilse
//   free    : diğer (visitor/free)
//
// Mevcut sistemi DEĞİŞTİRMEZ; yalnızca okur. Admin/premium görünürlüğü
// eskisi gibi isAdmin/isPremium ile yönetilir.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDAccess) return;
  const ACCESS_KEY = 'aap_access_v1';

  function _adminActive() {
    try {
      const raw = localStorage.getItem(ACCESS_KEY);
      if (raw && JSON.parse(raw).isAdmin === true) return true;
    } catch (e) {}
    try { if (window.TelegramDispatcher && window.TelegramDispatcher.hasAdminKey && window.TelegramDispatcher.hasAdminKey()) return true; } catch (e) {}
    return false;
  }
  function _premiumActive() {
    try { if (window.APP_ACCESS && window.APP_ACCESS.isPremium && window.APP_ACCESS.isPremium()) return true; } catch (e) {}
    return false;
  }
  function _teaserActive() {
    try { return !!(window.VDTeaser && window.VDTeaser.isActive && window.VDTeaser.isActive()); } catch (e) { return false; }
  }

  window.VDAccess = {
    isAdmin: _adminActive,
    isPremium: () => _premiumActive() || _adminActive(),
    isTeaser: () => _teaserActive() && !_premiumActive() && !_adminActive(),
    // En yüksek seviye
    level() {
      if (_adminActive()) return 'admin';
      if (_premiumActive()) return 'premium';
      if (_teaserActive()) return 'teaser';
      return 'free';
    },
    // Belirli bir sembole erişim (teaser yalnız kendi sembolüne)
    canAccessSymbol(sym) {
      if (_adminActive() || _premiumActive()) return true;
      try { if (window.APP_ACCESS && window.APP_ACCESS.canAccessSymbol) return window.APP_ACCESS.canAccessSymbol(sym); } catch (e) {}
      return false;
    },
  };
})();
