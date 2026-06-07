// ════════════════════════════════════════════════════════════════════
// shared/nav/nav.js  ·  VD SecuriAnalyst birleşik navigasyon kabuğu
//
// Davranış:
//   - Desktop: header altına yatay üst menü (7 katman)
//   - Mobil: header'da ☰ → drawer (7 katman) + altta 4'lü kısayol nav
//   - index.html'de: FAB + swipe panel + eski 5'li alt nav NÖTRLENİR
//     (geri alınabilir — bu dosya silinince her şey eski haline döner)
//   - Router: şimdilik scroll/aç-kapa (view-router YOK)
//
// Mevcut Dashboard/Archive/Telegram/Admin/Legal mantığına DOKUNMAZ.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDNav) return; // idempotent

  // key, label, page, scroll(selector, sadece index içi), short(mobil alt nav), icon
  const LAYERS = [
    { key:'dashboard',    label:'Dashboard',           page:'index.html', scroll:'#marketSection,.market-overview', short:true,  shortLabel:'Dashboard', icon:'🏠' },
    { key:'intelligence', label:'Intelligence Center', page:'intelligence-center.html', short:true,  shortLabel:'Intel',     icon:'📊', gate:'premium' },
    { key:'archive',      label:'Analysis Archive',    page:'archive.html', short:true, shortLabel:'Archive',  icon:'◈' },
    { key:'translator',   label:'Market Translator',   page:'translator.html', icon:'🔤' },
    { key:'timeline',     label:'Market Timeline',     page:'timeline.html', short:true, shortLabel:'Timeline', icon:'📈' },
    { key:'academy',      label:'VD Academy',          page:'academy.html', icon:'🎓' },
    { key:'aitrack',      label:'AI Track Record',     page:'track-record.html', short:true, shortLabel:'Track', icon:'🏆' },
    { key:'performans',   label:'Performans',          page:'archive-intelligence.html', icon:'🧠' },
    { key:'learning',     label:'AI Learning',         page:'outcome-intelligence.html', icon:'🤖' },
    { key:'premium',      label:'Premium',             page:'premium.html', premium:true, icon:'⭐' },
  ];

  function _basename() {
    const p = location.pathname.split('/').pop();
    return (!p || p === '') ? 'index.html' : p;
  }
  function _currentKey() {
    const b = _basename();
    const hit = LAYERS.find(l => l.page === b);
    if (hit) return hit.key;
    return 'dashboard'; // index.html veya kök
  }
  function _isIndex() { return _basename() === 'index.html'; }
  // Dashboard'a dönüşte: bir önceki sayfa dashboard ise bellekten anında dön (reload/yeni tarama YOK)
  function _refIsDashboard() {
    try { if (!document.referrer) return false; var u = new URL(document.referrer); if (u.origin !== location.origin) return false; var p = u.pathname.split('/').pop(); return (p === '' || p === 'index.html'); } catch (e) { return false; }
  }
  function goDashboard() {
    if (!_isIndex() && _refIsDashboard() && history.length > 1) { history.back(); }
    else { location.href = 'index.html'; }
  }
  if (typeof window !== 'undefined') window.vdGoDashboard = goDashboard;

  function _esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // ── Erişim seviyesi (gate'li menü görünürlüğü) ────────────────────
  // VDAccess varsa onu kullan; yoksa aap_access_v1'den minimal fallback (free gizli kalsın).
  function _accessLevel() {
    try { if (window.VDAccess && window.VDAccess.level) return window.VDAccess.level(); } catch (e) {}
    try {
      const raw = localStorage.getItem('aap_access_v1');
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.isAdmin === true) return 'admin';
        if (d && typeof d.bitis === 'number' && d.bitis > Date.now()) {
          const plan = String(d.plan_id || '').toLowerCase();
          const prev = String(d.code_preview || '').toUpperCase();
          return (plan.startsWith('elite') || prev.includes('ELITE')) ? 'elite' : 'premium';
        }
      }
    } catch (e) {}
    return 'free';
  }
  // gate:'premium' → free göremez (premium/elite/admin görür). gate yoksa herkes görür.
  function _layerVisible(l) {
    if (l.gate === 'premium') return _accessLevel() !== 'free';
    return true;
  }
  function _visibleLayers() { return LAYERS.filter(_layerVisible); }

  // ── Navigasyon eylemi ─────────────────────────────────────────────
  function go(key) {
    const layer = LAYERS.find(l => l.key === key);
    if (!layer) return;
    closeDrawer();

    const samePage = layer.page === _basename();
    if (!samePage) {
      if (layer.page === 'index.html') { goDashboard(); return; }
      location.href = layer.page + (layer.hash ? '#' + layer.hash : '');
      return;
    }
    // Aynı sayfa → scroll/top
    if (layer.scroll) {
      const el = document.querySelector(layer.scroll.split(',')[0]) ||
                 (layer.scroll.split(',')[1] && document.querySelector(layer.scroll.split(',')[1].trim()));
      if (el) { el.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
    }
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  // ── Drawer ────────────────────────────────────────────────────────
  function openDrawer() {
    document.querySelector('.vdn-drawer-overlay')?.classList.add('open');
    document.querySelector('.vdn-drawer')?.classList.add('open');
    document.querySelector('.vdn-burger')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.querySelector('.vdn-drawer-overlay')?.classList.remove('open');
    document.querySelector('.vdn-drawer')?.classList.remove('open');
    document.querySelector('.vdn-burger')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Markup üreticiler ─────────────────────────────────────────────
  function _topnavHTML(cur) {
    const items = _visibleLayers().map(l =>
      `<a href="${l.page}${l.hash?'#'+l.hash:''}" data-key="${l.key}" class="${l.key===cur?'active':''}${l.premium?' vdn-premium':''}">${_esc(l.label)}</a>`
    ).join('');
    const brand = _isIndex() ? '' :
      `<a class="vdn-brand" data-key="dashboard" href="index.html" aria-label="VD SecuriAnalyst"><img src="/assets/brand/coin-mark.png" alt="" width="22" height="22"><span>VD SecuriAnalyst</span></a>`;
    return brand + items;
  }
  function _drawerHTML(cur) {
    return _visibleLayers().map(l =>
      `<a href="${l.page}${l.hash?'#'+l.hash:''}" data-key="${l.key}" class="${l.key===cur?'active':''}"><span class="ic">${l.icon}</span>${_esc(l.label)}</a>`
    ).join('');
  }
  function _bottomItemsHTML(cur, cls, icCls, lblCls) {
    return _visibleLayers().filter(l=>l.short).map(l =>
      `<a href="${l.page}${l.hash?'#'+l.hash:''}" data-key="${l.key}" class="${cls}${l.key===cur?' active':''}"><span class="${icCls}">${l.icon}</span><span class="${lblCls}">${_esc(l.shortLabel||l.label)}</span></a>`
    ).join('');
  }

  function _wire(scope) {
    scope.querySelectorAll('[data-key]').forEach(a => {
      a.addEventListener('click', (e) => {
        const key = a.getAttribute('data-key');
        const layer = LAYERS.find(l=>l.key===key);
        if (layer && layer.page === _basename()) { e.preventDefault(); go(key); }
        else if (key === 'dashboard' && !_isIndex()) { e.preventDefault(); closeDrawer(); goDashboard(); }
        else { closeDrawer(); /* normal link navigasyonu */ }
      });
    });
  }

  // ── Mount ─────────────────────────────────────────────────────────
  function mount() {
    const cur = _currentKey();
    document.body.classList.add('vdn-host');

    // Header'ı bul (index: .topbar | archive: .aic-header | placeholder: .vd-page-header)
    const header = document.querySelector('.topbar, .aic-header, .vd-page-header');

    // 1) Üst menü şeridi (desktop)
    if (!document.querySelector('.vdn-topnav')) {
      const nav = document.createElement('nav');
      nav.className = 'vdn-topnav';
      nav.setAttribute('aria-label', 'Ana menü');
      nav.innerHTML = _topnavHTML(cur);

      const topbar = document.querySelector('.topbar');
      const ticker = document.querySelector('.ticker-wrap');

      if (ticker) {
        // index.html — ticker fixed (top:52,h:34) → alt kenar 86.
        // Nav'ı 86'ya SABİTLE (ticker'ın hemen altı). .main padding'i (106)
        // içeriği zaten yeterince aşağıda tutuyor; ona dokunmuyoruz.
        ticker.insertAdjacentElement('afterend', nav);
        nav.style.position = 'fixed';
        nav.style.left = '0'; nav.style.right = '0';
        nav.style.top = '86px';        // 52 (topbar) + 34 (ticker)
        nav.style.zIndex = '8998';
      } else if (header && header.parentNode) {
        // standalone sayfa — header sticky/top0; nav onun altına sticky
        header.insertAdjacentElement('afterend', nav);
        const hb = header.getBoundingClientRect();
        if (getComputedStyle(header).position === 'sticky') nav.style.top = Math.round(hb.height) + 'px';
      } else {
        document.body.insertAdjacentElement('afterbegin', nav);
      }
      _wire(nav);
    }

    // 2) Hamburger (header içine)
    if (header && !document.querySelector('.vdn-burger')) {
      const burger = document.createElement('button');
      burger.className = 'vdn-burger';
      burger.setAttribute('aria-label', 'Menüyü aç');
      burger.innerHTML = '<span></span><span></span><span></span>';
      burger.addEventListener('click', () => {
        const open = document.querySelector('.vdn-drawer')?.classList.contains('open');
        open ? closeDrawer() : openDrawer();
      });
      header.appendChild(burger);
    }

    // 3) Drawer + overlay
    if (!document.querySelector('.vdn-drawer')) {
      const ov = document.createElement('div');
      ov.className = 'vdn-drawer-overlay';
      ov.addEventListener('click', closeDrawer);
      const dr = document.createElement('aside');
      dr.className = 'vdn-drawer';
      dr.setAttribute('aria-label', 'Tam menü');
      dr.innerHTML = `
        <div class="vdn-drawer-hdr">
          <span class="t">Menü</span>
          <button class="vdn-drawer-close" aria-label="Kapat">✕</button>
        </div>
        ${_drawerHTML(cur)}`;
      document.body.appendChild(ov);
      document.body.appendChild(dr);
      dr.querySelector('.vdn-drawer-close').addEventListener('click', closeDrawer);
      _wire(dr);
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDrawer(); });
    }

    // 4) Alt nav (mobil, 4 kısayol)
    const existingBottom = document.getElementById('bottomNav');
    if (existingBottom) {
      // index.html — mevcut 5'li navı 4'lü ile değiştir (eski bn-* class'larını yeniden kullan)
      existingBottom.innerHTML = _bottomItemsHTML(cur, 'bn-item', 'bn-icon', 'bn-label');
      _wire(existingBottom);
    } else if (!document.querySelector('.vdn-bottomnav')) {
      // standalone sayfalar — yeni alt nav oluştur
      const bn = document.createElement('nav');
      bn.className = 'vdn-bottomnav';
      bn.setAttribute('aria-label', 'Alt menü');
      bn.innerHTML = _bottomItemsHTML(cur, 'vdn-bn-item', 'ic', 'lbl');
      document.body.appendChild(bn);
      _wire(bn);
    }

    // 5) index.html mobil temizliği — FAB + swipe panel + jest nötrle
    if (_isIndex()) {
      if (typeof window.openSwipePanel === 'function') {
        window.openSwipePanel = function () {}; // jest + FAB no-op
      }
      // (CSS zaten body.vdn-host ile #fabBtn/#swipePanel/#swipeOverlay gizliyor)
    }

    // 6) Hash ile derin bağlantı (örn. index.html#intel → Intelligence'a scroll)
    if (location.hash) {
      const h = location.hash.replace('#','');
      const layer = LAYERS.find(l => l.hash === h);
      if (layer && layer.page === _basename()) setTimeout(()=>go(layer.key), 400);
    }
  }

  window.VDNav = { mount, go, openDrawer, closeDrawer };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
