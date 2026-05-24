// ═══════════════════════════════════════════════════════════════
// APP-GLOBALS.JS — Window Bridge
// onclick="..." HTML attributeları type="module" scope'da
// çalışmaz. Bu dosya tüm fonksiyonları window'a bağlar.
// ═══════════════════════════════════════════════════════════════

// Bu fonksiyon, tüm modüller yüklendikten sonra çağrılır
export function registerGlobals() {

  // ── Auth ──────────────────────────────────────────────────────
  window.doLogin        = () => import('./auth.js').then(m => m.doLogin());
  window.doLogout       = () => import('./auth.js').then(m => m.doLogout());
  window.toggleLoginEye = () => {
    const inp = document.getElementById('loginInput');
    const eye = document.getElementById('loginEye');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (eye) eye.textContent = inp.type === 'password' ? '👁' : '🙈';
  };

  // ── Navigation ────────────────────────────────────────────────
  window.loadCoin = (sym, intv) => {
    window.SYM = sym; window.INTV = intv;
    document.getElementById('symInput') && (document.getElementById('symInput').value = sym);
    window._appLoadCoin && window._appLoadCoin(sym, intv);
  };
  window.openCoin = (sym) => {
    window.SYM = sym; window.INTV = window.INTV || '15m';
    document.getElementById('symInput') && (document.getElementById('symInput').value = sym);
    window._appLoadCoin && window._appLoadCoin(sym, window.INTV);
    setTimeout(() => { document.getElementById('mainPanel')?.scrollIntoView({ behavior: 'smooth' }); }, 200);
  };
  window.doSearch = () => {
    const v = document.getElementById('symInput')?.value?.trim().toUpperCase();
    if (v) window.loadCoin(v.includes('USDT') ? v : v + 'USDT', window.INTV || '15m');
  };
  window.quickCoin = (sym) => { window.loadCoin(sym, window.INTV || '15m'); };
  window.startScan = () => window._appStartScan && window._appStartScan();

  // ── Notification Center ───────────────────────────────────────
  window.NC = {
    toggle:   () => window._NC?.toggle(),
    filter:   (k) => window._NC?.setFilter(k),
    clearAll: () => { if (confirm('Tüm bildirimler silinsin mi?')) window._NC?.clearAll(); },
    add:      (opts) => window._NC?.add(opts),
  };

  // ── Toast ─────────────────────────────────────────────────────
  window.ToastSystem = {
    toggle:    () => window._Toast?.toggle(),
    isEnabled: () => window._Toast?.enabled ?? true,
  };

  // ── Signal Card Engine ────────────────────────────────────────
  window.SCE = {
    setMode: (m) => window._SCE?.setMode(m),
    setSort: (s) => window._SCE?.setSort(s),
  };

  // ── LWC Chart ─────────────────────────────────────────────────
  window.LWC = {
    toggle: (layer) => window._LWC?.toggle(layer),
  };

  // ── AI Learning ───────────────────────────────────────────────
  window.AI = {
    resetWeights: () => window._AI?.resetWeights(),
    clearAll:     () => window._AI?.clearAll(),
    load:         () => window._AI?.load(),
    startTracking:() => window._AI?.startTracking(),
  };
  window.renderAI = () => window._renderAI && window._renderAI();

  // ── Analytics ─────────────────────────────────────────────────
  window.Analytics = {
    tab:          (t) => window._Analytics?.tab(t),
    clearHistory: () => window._Analytics?.clearHistory(),
    refresh:      () => window._Analytics?.refresh(),
  };

  // ── AI Sidebar ────────────────────────────────────────────────
  window.AISidebar = {
    toggle:      () => window._AISidebar?.toggle(),
    close:       () => window._AISidebar?.close(),
    quickAction: (a) => window._AISidebar?.quickAction(a),
    addMsg:      (msg, type) => window._AISidebar?.addMsg(msg, type),
  };

  // ── Onboarding ────────────────────────────────────────────────
  window.Onboarding = {
    next: () => window._Onboarding?.next(),
    skip: () => window._Onboarding?.skip(),
  };

  // ── Phase 10 ──────────────────────────────────────────────────
  window.P10 = {
    setMode: (m) => window._P10?.setMode(m),
  };

  // ── Swipe Panel ───────────────────────────────────────────────
  window.openSwipePanel  = () => window._openSwipePanel?.();
  window.closeSwipePanel = () => window._closeSwipePanel?.();

  // ── Bottom Nav ────────────────────────────────────────────────
  window.bnNav = (section) => window._bnNav?.(section);

  // ── Misc ──────────────────────────────────────────────────────
  window.copyPrompt   = () => window._copyPrompt?.();
  window.requestNotif = () => window._requestNotif?.();

  console.log('✅ Global bridge kuruldu');
}
