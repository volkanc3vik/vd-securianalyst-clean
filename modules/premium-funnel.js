// ════════════════════════════════════════════════════════════════════
// modules/premium-funnel.js
// PREMIUM SALES FUNNEL — #loginScreen'i satış hunisine dönüştürür.
//
// • Hero + özellik kartları + plan kartları + sosyal kanıt + CTA
// • Teaser süresi dolduysa üstte özel uyarı
// • Mevcut kod-aktivasyon kartı (doLogin) KORUNUR → "Premium Kodunu Gir"
// • Fiyat/link VDPremiumConfig'ten; sosyal kanıt SupabaseDB.getArchiveStats'tan
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

  function _featuresHTML() {
    const f = CFG().features || [];
    return f.map(x => `<div class="vdf-feat"><span class="vdf-feat-ic">${esc(x.icon)}</span><span>${esc(x.label)}</span></div>`).join('');
  }
  function _plansHTML() {
    const p = CFG().plans || [];
    return p.map(x => `
      <div class="vdf-plan${x.highlight ? ' vdf-plan-hot' : ''}">
        ${x.highlight ? '<div class="vdf-plan-badge">Popüler</div>' : ''}
        <div class="vdf-plan-ic">${esc(x.icon)}</div>
        <div class="vdf-plan-name">${esc(x.name)}</div>
        <div class="vdf-plan-price">${esc(x.price)}<small>${esc(x.period || '')}</small></div>
        <div class="vdf-plan-note">${esc(x.note || '')}</div>
        <button class="vdf-plan-btn" data-vdf-buy="${esc(x.id)}" type="button">Erişim Al</button>
      </div>`).join('');
  }

  function _funnelHTML() {
    const c = CFG();
    const hero = c.hero || {};
    const banner = _teaserExpired()
      ? `<div class="vdf-teaser-banner">⏳ <b>Ücretsiz önizleme süreniz sona erdi.</b><br>İncelediğiniz analizin tamamına ve tüm premium araçlara erişmek için premium üyelik gereklidir.</div>`
      : '';
    return `
      <div class="vdf-scroll">
        ${banner}
        <div class="vdf-hero">
          <div class="vdf-hero-title">${esc(hero.title || 'Premium')}</div>
          <div class="vdf-hero-sub">${esc(hero.subtitle || '')}</div>
        </div>

        <div class="vdf-social" id="vdf-social" hidden></div>

        <div class="vdf-section-ttl">Premium ile açılan modüller</div>
        <div class="vdf-feats">${_featuresHTML()}</div>

        <div class="vdf-section-ttl">Erişim Planları</div>
        <div class="vdf-plans">${_plansHTML()}</div>

        <button class="vdf-cta" data-vdf-primary type="button">🚀 Premium Erişim Al</button>

        <div class="vdf-contacts">
          <a class="vdf-contact tg" data-vdf-tg target="_blank" rel="noopener">📱 Telegram ile İletişim</a>
          <a class="vdf-contact wa" data-vdf-wa target="_blank" rel="noopener">📞 WhatsApp ile İletişim</a>
          <button class="vdf-contact code" data-vdf-code type="button">🔑 Premium Kodunu Gir</button>
        </div>
      </div>`;
  }

  // ── Sosyal kanıt (mevcut RPC; veri yoksa gizli) ──
  async function _loadSocial() {
    if (!(CFG().socialProof && CFG().socialProof.enabled)) return;
    const host = document.getElementById('vdf-social');
    if (!host) return;
    let s = null;
    try { if (window.SupabaseDB && window.SupabaseDB.getArchiveStats) s = await window.SupabaseDB.getArchiveStats(); } catch (e) { console.warn(TAG, 'stats:', e); }
    if (!s || typeof s !== 'object') return;
    const tiles = [];
    if (s.total_all != null) tiles.push({ ic: '📊', v: s.total_all, l: 'Toplam analiz' });
    const reviewed = +s.total_reviewed || 0;
    if (s.validated_pct != null && reviewed >= 5) tiles.push({ ic: '📈', v: s.validated_pct + '%', l: 'Ort. doğrulama oranı' });
    // Öğrenilen setup sayısı — yalnız VDInsights yüklüyse (aksi halde gösterilmez)
    try {
      if (window.VDInsights && window.VDInsights.load && window.VDInsights.computeInsights) {
        const recs = await window.VDInsights.load();
        const ins = window.VDInsights.computeInsights(recs);
        const setups = (ins.combos || []).length;
        if (setups > 0) tiles.push({ ic: '🧠', v: setups, l: 'Öğrenilen setup' });
      }
    } catch (e) {}
    if (!tiles.length) return;
    host.innerHTML = tiles.map(t => `<div class="vdf-stat"><div class="vdf-stat-v">${t.ic} ${esc(t.v)}</div><div class="vdf-stat-l">${esc(t.l)}</div></div>`).join('');
    host.hidden = false;
  }

  // ── CTA wiring ──
  function _openLink(url) { if (url) window.open(url, '_blank', 'noopener'); }
  function _wire(screen) {
    const c = CFG().contact || {};
    const tg = screen.querySelector('[data-vdf-tg]'); if (tg) tg.href = c.telegram || '#';
    const wa = screen.querySelector('[data-vdf-wa]'); if (wa) wa.href = c.whatsapp || '#';
    const prim = screen.querySelector('[data-vdf-primary]');
    if (prim) prim.addEventListener('click', () => _openLink(c.primary === 'whatsapp' ? c.whatsapp : c.telegram));
    screen.querySelectorAll('[data-vdf-buy]').forEach(b => b.addEventListener('click', () => _openLink(c.primary === 'whatsapp' ? c.whatsapp : c.telegram)));
    // Kodunu Gir → mevcut kod kartını göster
    const codeBtn = screen.querySelector('[data-vdf-code]');
    if (codeBtn) codeBtn.addEventListener('click', () => {
      screen.classList.add('vd-code-mode');
      const inp = document.getElementById('loginInput'); if (inp) setTimeout(() => inp.focus(), 60);
    });
  }

  // Kod kartına "← Planlara dön" linki ekle (doLogin/kart yapısına dokunmadan)
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

  // #premium hash / ?premium=1 ile gelinmişse funnel'ı aç (diğer sayfalardan teaser)
  function _autoOpen() {
    try {
      const hash = (location.hash || '').toLowerCase();
      const qp = new URLSearchParams(location.search);
      if (hash === '#premium' || qp.get('premium') === '1') {
        if (typeof window.openPremiumLogin === 'function') setTimeout(() => window.openPremiumLogin(), 300);
      }
    } catch (e) {}
  }

  function init() {
    _inject();
    _autoOpen();
  }

  window.VDPremiumFunnel = { init, _inject, _loadSocial };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
