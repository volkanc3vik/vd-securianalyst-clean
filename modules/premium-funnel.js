// ════════════════════════════════════════════════════════════════════
// modules/premium-funnel.js
// PREMIUM SALES FUNNEL (Phase 5.1) — kurumsal/premium satış ekranı.
//
// • Hero + premium chip'ler + modül kartları (ikon/başlık/açıklama/glow)
// • Fayda listesi + güçlü sosyal kanıt (mevcut RPC) + SaaS plan kartları
// • Plan seç → Telegram hazır mesaj (config) · tek CTA
// • Kod-aktivasyon kartı KORUNUR (doLogin'e dokunulmaz) · güven notu
// Hiçbir mevcut sistem değiştirilmez. window.VDPremiumFunnel
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDPremiumFunnel) return;
  const TAG = '[PremiumFunnel]';
  const SCREEN_ID = 'loginScreen';
  const FUNNEL_ID = 'vd-funnel';

  const CFG = () => window.VDPremiumConfig || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function _teaserExpired() { try { return !!(window.VDTeaser && window.VDTeaser.isExpired && window.VDTeaser.isExpired()); } catch (e) { return false; } }

  // ── Telegram hazır mesaj link üretimi (yalnız Telegram) ──
  function _msgFor(planName) {
    const m = CFG().messages || {};
    if (planName && m.perPlan) return m.perPlan.replace('{plan}', planName);
    return m.general || 'Merhaba.';
  }
  function _contactLink(planName) {
    const c = CFG().contact || {};
    const text = encodeURIComponent(_msgFor(planName));
    const user = String(c.telegramUsername || c.telegramUser || '').replace(/^@/, '');
    return `https://t.me/${user}?text=${text}`;
  }
  function _openContact(planName) {
    window.open(_contactLink(planName), '_blank', 'noopener');
  }

  // ── HTML parçaları ──
  function _chipsHTML() {
    const ch = (CFG().hero && CFG().hero.chips) || [];
    return ch.map(c => `<span class="vdf-chip">${esc(c)}</span>`).join('');
  }
  function _modulesHTML() {
    const mods = CFG().modules || [];
    return mods.map(m => `
      <div class="vdf-mod">
        <div class="vdf-mod-ic">${esc(m.icon)}</div>
        <div class="vdf-mod-tx">
          <div class="vdf-mod-ttl">${esc(m.title)}</div>
          <div class="vdf-mod-desc">${esc(m.desc || '')}</div>
        </div>
      </div>`).join('');
  }
  function _benefitsHTML() {
    const bs = CFG().benefits || [];
    if (!bs.length) return '';
    return `<div class="vdf-benefits">${bs.map(b => `<div class="vdf-benefit"><span class="vdf-benefit-ck">✓</span>${esc(b)}</div>`).join('')}</div>`;
  }
  function _plansHTML() {
    const p = CFG().plans || [];
    return p.map(x => `
      <div class="vdf-plan${x.highlight ? ' vdf-plan-hot' : ''}">
        ${x.tag ? `<div class="vdf-plan-tag">${esc(x.tag)}</div>` : ''}
        <div class="vdf-plan-ic">${esc(x.icon)}</div>
        <div class="vdf-plan-name">${esc(x.name)}</div>
        <div class="vdf-plan-price">${esc(x.price)}<small>${esc(x.period || '')}</small></div>
        <button class="vdf-plan-btn" data-vdf-plan="${esc(x.name)}" type="button">Planı Seç</button>
      </div>`).join('');
  }

  function _funnelHTML() {
    const c = CFG();
    const hero = c.hero || {};
    const banner = _teaserExpired()
      ? `<div class="vdf-teaser-banner">⏳ <b>Ücretsiz önizleme süreniz sona erdi.</b><br>İncelediğiniz analizin tamamına ve tüm premium araçlara erişmek için premium üyelik gereklidir.</div>`
      : '';
    return `
      <div class="vdf-grid-bg"></div>
      <div class="vdf-scroll">
        ${banner}
        <div class="vdf-hero">
          <div class="vdf-hero-badge">◈ VD SECURIANALYST PREMIUM</div>
          <div class="vdf-hero-title">${esc(hero.title || 'Premium')}</div>
          <div class="vdf-hero-sub">${esc(hero.subtitle || '')}</div>
          <div class="vdf-chips">${_chipsHTML()}</div>
        </div>

        <div class="vdf-social" id="vdf-social" hidden></div>

        <div class="vdf-section-ttl">Premium Modüller</div>
        <div class="vdf-mods">${_modulesHTML()}</div>

        <div class="vdf-section-ttl">Premium ile Neler Kazanırsın</div>
        ${_benefitsHTML()}

        <div class="vdf-section-ttl">Erişim Planları</div>
        <div class="vdf-plans">${_plansHTML()}</div>

        <button class="vdf-cta" data-vdf-primary type="button">🚀 Premium Erişim İçin Telegram'dan Yaz</button>

        <div class="vdf-trust">${esc(c.trustNote || '')}</div>

        <div class="vdf-codeline">
          <span>${esc(c.codeNote || 'Premium kodun varsa buradan giriş yapabilirsin.')}</span>
          <button class="vdf-codebtn" data-vdf-code type="button">🔑 Premium Kodunu Gir</button>
        </div>
      </div>`;
  }

  // ── Sosyal kanıt (mevcut RPC; az veride gizli) ──
  async function _loadSocial() {
    const sp = CFG().socialProof || {};
    if (!sp.enabled) return;
    const host = document.getElementById('vdf-social');
    if (!host) return;
    let s = null;
    try { if (window.SupabaseDB && window.SupabaseDB.getArchiveStats) s = await window.SupabaseDB.getArchiveStats(); } catch (e) { console.warn(TAG, 'stats:', e); }
    if (!s || typeof s !== 'object') return;
    const reviewed = +s.total_reviewed || 0;
    const minR = sp.minReviewed != null ? sp.minReviewed : 5;
    if (reviewed < minR) return;   // az veri → tüm blok gizli

    const tiles = [];
    tiles.push({ ic: '📊', v: reviewed, l: 'İncelenen Analiz' });
    if (s.validated_pct != null) tiles.push({ ic: '📈', v: s.validated_pct + '%', l: 'Ort. Doğrulama Oranı' });
    if (s.validated != null) tiles.push({ ic: '🎯', v: s.validated, l: 'Doğrulanan Analiz' });
    try {
      if (window.VDInsights && window.VDInsights.load && window.VDInsights.computeInsights) {
        const recs = await window.VDInsights.load();
        const setups = (window.VDInsights.computeInsights(recs).combos || []).length;
        if (setups > 0) tiles.push({ ic: '🧠', v: setups, l: 'Öğrenilen Setup' });
      }
    } catch (e) {}
    if (!tiles.length) return;
    tiles.push({ ic: '📡', v: 'Aktif', l: 'Outcome Tracking' });
    host.innerHTML = tiles.map(t => `<div class="vdf-stat"><div class="vdf-stat-v">${t.ic} ${esc(t.v)}</div><div class="vdf-stat-l">${esc(t.l)}</div></div>`).join('');
    host.hidden = false;
  }

  // ── Wiring ──
  function _wire(screen) {
    const c = CFG().contact || {};
    const prim = screen.querySelector('[data-vdf-primary]');
    if (prim) prim.addEventListener('click', () => _openContact(null));
    screen.querySelectorAll('[data-vdf-plan]').forEach(b => b.addEventListener('click', () => _openContact(b.getAttribute('data-vdf-plan'))));
    const codeBtn = screen.querySelector('[data-vdf-code]');
    if (codeBtn) codeBtn.addEventListener('click', () => {
      screen.classList.add('vd-code-mode');
      const inp = document.getElementById('loginInput'); if (inp) setTimeout(() => inp.focus(), 60);
    });
  }

  function _augmentCodeCard(screen) {
    const card = screen.querySelector('.login-card');
    if (!card || card.querySelector('.vdf-back')) return;
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'vdf-back'; back.textContent = '← Premium planlara dön';
    back.addEventListener('click', () => screen.classList.remove('vd-code-mode'));
    card.insertBefore(back, card.firstChild);
  }

  function _inject() {
    const screen = document.getElementById(SCREEN_ID);
    if (!screen || document.getElementById(FUNNEL_ID)) return;
    const funnel = document.createElement('div');
    funnel.id = FUNNEL_ID;
    funnel.className = 'vdf';
    funnel.innerHTML = _funnelHTML();
    const card = screen.querySelector('.login-card');
    if (card) screen.insertBefore(funnel, card); else screen.appendChild(funnel);
    _wire(screen);
    _augmentCodeCard(screen);
    _loadSocial();
  }

  function _autoOpen() {
    try {
      const hash = (location.hash || '').toLowerCase();
      const qp = new URLSearchParams(location.search);
      if (hash === '#premium' || qp.get('premium') === '1') {
        if (typeof window.openPremiumLogin === 'function') setTimeout(() => window.openPremiumLogin(), 300);
      }
    } catch (e) {}
  }

  function init() { _inject(); _autoOpen(); }

  window.VDPremiumFunnel = { init, _inject, _loadSocial, _contactLink };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
