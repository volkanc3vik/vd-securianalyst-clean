// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — TELEGRAM FUNNEL (Phase 2, v1)
// Site → Telegram kanalı yönlendirmesi. SADECE funnel/CTA.
// DOKUNMAZ: telegram send endpoint, bot, webhook, referral, premium kod,
//           archive, scanner. Hiçbir motor dosyası düzenlenmez — CTA'lar
//           DOM'a idempotent enjekte edilir.
//
// KANAL: window.VD_TG_CHANNEL_URL ile ayarla (aşağıda varsayılan placeholder).
//        Tek satır: window.VD_TG_CHANNEL_URL = 'https://t.me/SENIN_KANALIN';
// ════════════════════════════════════════════════════════════════════
(function (w, d) {
  'use strict';
  if (w.__vdTgFunnel) return; w.__vdTgFunnel = true;

  // ── KANAL (BURAYI AYARLA) ──
  var CHANNEL = w.VD_TG_CHANNEL_URL || 'https://t.me/vdsecurianalyst'; // ← gerçek kanal linkini koy
  var COPY = {
    main:  '📢 Ücretsiz Telegram Kanalına Katıl',
    sub:   'Her gün ücretsiz analizler, market özeti ve örnek setup paylaşımları.',
    teaser:'📢 Benzer analizler Telegram kanalında ücretsiz paylaşılıyor.',
    premiumSecondary: '📢 Önce Ücretsiz Kanalı İncele',
    academy:'📢 Güncel piyasa örneklerini Telegram kanalında takip et',
    btn:   'Telegram Kanalına Katıl',
  };

  // ── TIKLAMA TAKİBİ (şimdilik sadece debug log; ileride analytics buraya) ──
  function trackTelegramClick(source) {
    try { console.log('[TG_FUNNEL] click →', source || 'unknown', '·', new Date().toISOString()); } catch (e) {}
    try { w.dispatchEvent(new CustomEvent('vd:tg:cta_click', { detail: { source: source || 'unknown' } })); } catch (e) {}
  }
  w.trackTelegramClick = trackTelegramClick;

  function openChannel(source) { trackTelegramClick(source); try { w.open(CHANNEL, '_blank', 'noopener'); } catch (e) {} }

  // ── premium kullanıcı / admin'de CTA gösterme (GERÇEK access API) ──
  function suppress() {
    try {
      var VA = w.VDAccess;
      if (VA) {
        var adm  = (typeof VA.isAdmin === 'function')   ? VA.isAdmin()   : VA.isAdmin;
        var prem = (typeof VA.isPremium === 'function') ? VA.isPremium() : VA.isPremium;
        if (adm || prem) return true;
      }
      if (w.APP_ACCESS && typeof w.APP_ACCESS.isPremium === 'function' && w.APP_ACCESS.isPremium()) return true;
      var raw = localStorage.getItem('aap_access_v1');           // admin: aap_access_v1.isAdmin === true
      if (raw && JSON.parse(raw).isAdmin === true) return true;
    } catch (e) {}
    return false;
  }

  // ── stiller (kendi kendine enjekte) ──
  var CSS = ''
    + '.vdtg-bar{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:10px;'
    + 'background:rgba(6,18,28,.92);border:1px solid rgba(0,229,255,.35);border-radius:10px;padding:10px 12px;'
    + 'box-shadow:0 10px 30px rgba(0,0,0,.45);backdrop-filter:blur(8px);max-width:340px;font-family:system-ui,sans-serif;}'
    + '.vdtg-bar .ic{font-size:18px;line-height:1}'
    + '.vdtg-bar .tx{font-size:12.5px;color:#cfe9f2;line-height:1.35}'
    + '.vdtg-bar .tx b{color:#00E5FF;display:block;font-size:13px;margin-bottom:2px}'
    + '.vdtg-bar .go{margin-left:auto;flex:0 0 auto;background:linear-gradient(135deg,#00E5FF,#2D7FF9);color:#02060C;'
    + 'font-weight:800;font-size:12px;border:none;border-radius:7px;padding:8px 12px;cursor:pointer;white-space:nowrap}'
    + '.vdtg-bar .x{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:#0b1a26;'
    + 'border:1px solid rgba(0,229,255,.4);color:#7fa8b8;cursor:pointer;font-size:12px;line-height:18px;text-align:center}'
    + '.vdtg-cta{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding:12px;border-radius:8px;'
    + 'background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.3)}'
    + '.vdtg-cta .m{font-size:13px;color:#cfe9f2;line-height:1.4}'
    + '.vdtg-cta .b{align-self:flex-start;background:linear-gradient(135deg,#00E5FF,#2D7FF9);color:#02060C;font-weight:800;'
    + 'font-size:12.5px;border:none;border-radius:7px;padding:9px 14px;cursor:pointer;text-decoration:none;display:inline-block}'
    + '.vdtg-secondary{display:inline-block;margin-top:8px;width:100%;text-align:center;background:transparent;'
    + 'color:#00E5FF;border:1px solid rgba(0,229,255,.4);border-radius:8px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none}'
    + '@media(max-width:560px){.vdtg-bar{left:8px;right:8px;bottom:8px;max-width:none}.vdtg-bar .tx{font-size:12px}}';

  function injectStyle() {
    if (d.getElementById('vdtg-style')) return;
    var s = d.createElement('style'); s.id = 'vdtg-style'; s.textContent = CSS; d.head.appendChild(s);
  }

  // ── 1) Site geneli kalıcı şerit (sol-alt; premium banner sağ-altta, çakışmaz) ──
  function injectBar() {
    if (suppress() || d.getElementById('vdtg-bar')) return;
    if (sessionStorage.getItem('vdtg_bar_closed') === '1') return;
    var bar = d.createElement('div'); bar.className = 'vdtg-bar'; bar.id = 'vdtg-bar';
    bar.innerHTML = '<span class="ic">📢</span><div class="tx"><b>Ücretsiz Telegram Kanalı</b>'
      + 'Günlük analiz, market özeti ve örnek setup\'lar.</div>'
      + '<button class="go">Katıl</button><div class="x" title="Kapat">✕</div>';
    bar.querySelector('.go').addEventListener('click', function () { openChannel('site_bar'); });
    bar.querySelector('.x').addEventListener('click', function () { try { sessionStorage.setItem('vdtg_bar_closed', '1'); } catch (e) {} bar.remove(); });
    d.body.appendChild(bar);
    positionBar();
  }

  // ── 2) Footer CTA ──
  function injectFooter() {
    var f = d.querySelector('.footer, .vd-legal-footer-inner');
    if (!f || f.querySelector('.vdtg-cta')) return;
    var box = d.createElement('div'); box.className = 'vdtg-cta';
    box.innerHTML = '<div class="m"><b style="color:#00E5FF">' + COPY.main + '</b><br>' + COPY.sub + '</div>'
      + '<a class="b" href="' + CHANNEL + '" target="_blank" rel="noopener">' + COPY.btn + '</a>';
    box.querySelector('.b').addEventListener('click', function () { trackTelegramClick('footer'); });
    f.appendChild(box);
  }

  // ── 3) Teaser / kilitli kart CTA'ları (MutationObserver ile dinamik yakalama) ──
  function decorateTeasers() {
    var sels = ['.teaser-block', '.gate-card', '.teaser-cta'];
    sels.forEach(function (sel) {
      d.querySelectorAll(sel).forEach(function (el) {
        if (el.getAttribute('data-vdtg') === '1') return;
        el.setAttribute('data-vdtg', '1');
        var cta = d.createElement('div'); cta.className = 'vdtg-cta';
        cta.innerHTML = '<div class="m">🔒 Bu analizin detayları gizlenmiştir.<br>' + COPY.teaser + '</div>'
          + '<a class="b" href="' + CHANNEL + '" target="_blank" rel="noopener">' + COPY.btn + '</a>';
        cta.querySelector('.b').addEventListener('click', function () { trackTelegramClick('teaser_card'); });
        el.appendChild(cta);
      });
    });
  }

  // ── 4) Premium popup'a ikincil "önce ücretsiz kanal" seçeneği ──
  function decoratePremiumModal() {
    d.querySelectorAll('.premium-modal').forEach(function (m) {
      if (m.getAttribute('data-vdtg') === '1') return;
      m.setAttribute('data-vdtg', '1');
      var a = d.createElement('a'); a.className = 'vdtg-secondary'; a.href = CHANNEL; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = COPY.premiumSecondary;
      a.addEventListener('click', function () { trackTelegramClick('premium_modal_secondary'); });
      m.appendChild(a);
    });
  }

  // funnel şeridini alttaki premium banner'ın ÜSTÜNE konumla (çakışma önleme)
  function positionBar() {
    var bar = d.getElementById('vdtg-bar'); if (!bar) return;
    try {
      var band = d.querySelector('.vd-premium-cta-band');
      if (band && band.offsetParent !== null) {
        var h = band.getBoundingClientRect().height || 0;
        bar.style.bottom = ((h > 0 ? h : 78) + 18) + 'px';   // banner üstüne, ölçüm 0 ise güvenli 78px
      } else {
        bar.style.bottom = '16px';
      }
    } catch (e) {}
  }

  function sweep() { if (suppress()) return; decorateTeasers(); decoratePremiumModal(); injectFooter(); positionBar(); }

  function start() {
    injectStyle(); injectBar(); sweep();
    try {
      var _t = null, _mutating = false;
      var mo = new MutationObserver(function () {
        if (_mutating || _t) return;              // kendi enjeksiyonumuz + debounce → sonsuz döngü yok
        _t = setTimeout(function () {
          _t = null;
          if (suppress()) { try { var b = d.getElementById('vdtg-bar'); if (b) b.remove(); } catch (e) {} return; } // premium olduysa temizle
          _mutating = true;
          try { sweep(); } finally { _mutating = false; }
        }, 400);
      });
      mo.observe(d.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();

  console.log('%c[TG_FUNNEL] v2.1 YÜKLENDİ ✓ — konum düzeltmesi aktif','color:#00E5FF;font-weight:bold');
  console.log('%c[TG_FUNNEL] v2.1 YÜKLENDİ ✓ — konum düzeltmesi aktif · kanal: ' + CHANNEL, 'color:#00E5FF;font-weight:bold');
  w.VDTelegramFunnel = { open: openChannel, track: trackTelegramClick, _channel: function () { return CHANNEL; }, sweep: sweep, _version: 'v2.1' };
})(window, document);
