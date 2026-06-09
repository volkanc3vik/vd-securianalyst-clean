// ════════════════════════════════════════════════════════════════════
// ui/premium/card-detail-lock.js
// FREE / TEASER — AI Analiz Kartı (.signal-card) detay kilidi
//
// Free/teaser kullanıcıya analiz kartında YALNIZCA:
//   • Yön (LONG / SHORT)  • Setup etiketi  • Güven (Confidence %)  • Risk
// gösterilir. Coin adı maskelenir (TA***DT). Şunlar gizlenir:
//   • Coin tam adı  • Giriş/Stop/TP1/TP2/TP3  • Onay barı & onay grid'i
//   • Setup Skoru / R-R / BTC Uyum / Hacim  • Eksik Onaylar  • Teknik zamanlama
//   • Onay etiketleri (tags)
// Kartın altına kilit notu eklenir.
//
// Premium / admin → tüm kilitler kalkar (tam kart). Render-only, tersinir.
// Hesaplama / scanner / analiz mantığına DOKUNMAZ. (ai-comment-lock deseni.)
// window.VDCardDetailLock
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  if (window.VDCardDetailLock) return;

  const CARD_SEL = '.signal-card';
  const LOCK_ATTR = 'data-vd-cardlock';
  const HIDE_ATTR = 'data-vd-hidden';
  const SYM_ATTR  = 'data-vd-symorig';
  const NOTE_CLASS = 'vd-card-locknote';
  const NOTE_TEXT = _t('prm.cardLockText', null, '🔒 Bu analizin detayları Premium üyeler için açıktır.');
  const KEEP_LABELS = /^(Güven|Risk)$/;          // metrik kutularında korunacaklar
  const PRICE_LABELS = /Giriş|Stop|TP\s*\d/i;     // fiyat bloğu tespiti
  const HIDE_SELECTORS = ['.sc-conf-bar', '.sc-conf-grid', '.sc-missing', '.sc-timing', '.sc-tags'];

  let _mounted = false, _observer = null, _raf = false;

  function _isPremium() {
    try {
      if (window.VDAccess && window.VDAccess.isPremium) return window.VDAccess.isPremium();
      if (window.APP_ACCESS && window.APP_ACCESS.isPremium) return window.APP_ACCESS.isPremium();
    } catch (e) {}
    return false;
  }

  // BTC → BTCUSDT → BT***DT  ·  TADA → TADAUSDT → TA***DT
  function _mask(coinText) {
    let t = String(coinText || '').trim().toUpperCase();
    if (!/USDT|USDC|BUSD$/.test(t)) t += 'USDT';
    if (t.length < 5) return coinText;
    return t.slice(0, 2) + '***' + t.slice(-2);
  }

  function _hide(el) {
    if (!el || el.getAttribute(HIDE_ATTR) === '1') return;
    el.setAttribute(HIDE_ATTR, '1');
    el.dataset.vdPrevDisplay = el.style.display || '';
    el.style.display = 'none';
  }
  function _unhideAll(card) {
    card.querySelectorAll('[' + HIDE_ATTR + '="1"]').forEach(el => {
      el.style.display = el.dataset.vdPrevDisplay || '';
      el.removeAttribute(HIDE_ATTR); delete el.dataset.vdPrevDisplay;
    });
  }

  function _lockCard(card) {
    if (card.getAttribute(LOCK_ATTR) === '1') return;

    // 1) Coin adını maskele
    const symEl = card.querySelector('.sc-sym');
    if (symEl && !symEl.hasAttribute(SYM_ATTR)) {
      symEl.setAttribute(SYM_ATTR, symEl.textContent);
      symEl.textContent = _mask(symEl.textContent);
    }

    // 2) Onay barı / grid / eksik onay / teknik zamanlama / etiketler → gizle
    HIDE_SELECTORS.forEach(sel => card.querySelectorAll(sel).forEach(_hide));

    // 3) sc-stats: fiyat bloğunda DEĞERLERİ 🔒 Premium Veri ile maskele (blok görünür kalır);
    //    metrik bloğunda Güven/Risk hariç gizle
    card.querySelectorAll('.sc-stats').forEach(block => {
      const labels = Array.from(block.querySelectorAll('.sc-stat-lbl')).map(l => (l.textContent || '').trim());
      const isPrices = labels.some(l => PRICE_LABELS.test(l));
      if (isPrices) {
        block.querySelectorAll('.sc-stat').forEach(st => {
          const val = st.querySelector('.sc-stat-val');
          if (val && !val.hasAttribute('data-vd-vorig')) {
            val.setAttribute('data-vd-vorig', val.innerHTML);
            val.innerHTML = '<span class="vd-lock-val">🔒 Premium</span>';
          }
        });
        return;
      }
      block.querySelectorAll('.sc-stat').forEach(st => {
        const lbl = (st.querySelector('.sc-stat-lbl')?.textContent || '').trim();
        if (!KEEP_LABELS.test(lbl)) _hide(st);
      });
    });

    // 4) Kilit notu (bir kez) + kartı tıklanabilir yap → Sales Funnel
    if (!card.querySelector('.' + NOTE_CLASS)) {
      const note = document.createElement('div');
      note.className = NOTE_CLASS;
      note.innerHTML = ''+_t('prm.cardLockText', null, '🔒 Bu analizin detayları Premium üyeler için açıktır.')+' <span class="vd-locknote-cta">'+_t('prm.cardLockTap', null, 'Görmek için dokun →')+'</span>';
      note.style.cssText = 'margin:10px 0 4px;padding:11px 14px;border-radius:11px;font-size:12.5px;font-weight:600;text-align:center;color:#00D1FF;background:rgba(0,209,255,.07);border:1px solid rgba(0,209,255,.28);cursor:pointer';
      const ai = card.querySelector('.sc-ai-comment');
      if (ai) card.insertBefore(note, ai); else card.appendChild(note);
    }
    if (!card.hasAttribute('data-vd-clickbound')) {
      card.setAttribute('data-vd-clickbound', '1');
      card.style.cursor = 'pointer';
      card.addEventListener('click', _onLockedCardClick);
    }

    card.setAttribute(LOCK_ATTR, '1');
  }

  function _unlockCard(card) {
    const symEl = card.querySelector('.sc-sym');
    if (symEl && symEl.hasAttribute(SYM_ATTR)) { symEl.textContent = symEl.getAttribute(SYM_ATTR); symEl.removeAttribute(SYM_ATTR); }
    // fiyat değerlerini geri yükle
    card.querySelectorAll('.sc-stat-val[data-vd-vorig]').forEach(v => { v.innerHTML = v.getAttribute('data-vd-vorig'); v.removeAttribute('data-vd-vorig'); });
    _unhideAll(card);
    card.querySelectorAll('.' + NOTE_CLASS).forEach(n => n.remove());
    if (card.hasAttribute('data-vd-clickbound')) { card.removeEventListener('click', _onLockedCardClick); card.removeAttribute('data-vd-clickbound'); card.style.cursor = ''; }
    card.removeAttribute(LOCK_ATTR);
  }

  function _onLockedCardClick(e) {
    // tıklanınca Premium Sales Funnel aç (eski mor popup YOK)
    e.preventDefault(); e.stopPropagation();
    if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
    else if (window.VDPremiumModal && window.VDPremiumModal.show) window.VDPremiumModal.show();
    else location.href = 'index.html#premium';
  }

  function _teaserActive() {
    try { return !!(window.VDTeaser && window.VDTeaser.isActive && window.VDTeaser.isActive()); } catch (e) { return false; }
  }

  let _teaserTimer = null;
  function _scan() {
    // Premium/admin → tam aç. Aktif teaser (Telegram, ilk 5 dk) → daha fazla detay göster (aç).
    const open = _isPremium() || _teaserActive();
    document.querySelectorAll(CARD_SEL).forEach(card => { open ? _unlockCard(card) : _lockCard(card); });
    // teaser süresi bitince otomatik Free moduna düş
    if (_teaserActive() && !_teaserTimer) {
      let ms = 5000; try { ms = Math.min(Math.max(window.VDTeaser.remainingMs() + 500, 1000), 6 * 60000); } catch (e) {}
      _teaserTimer = setTimeout(() => { _teaserTimer = null; _scan(); }, ms);
    }
  }
  function _schedule() { if (_raf) return; _raf = true; requestAnimationFrame(() => { _raf = false; _scan(); }); }

  function mount() {
    if (_mounted) return; _mounted = true;
    _observer = new MutationObserver(_schedule);
    _observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('vd:access:changed', _scan);
    window.addEventListener('vd:access:lock-changed', _scan);
    _scan();
  }

  window.VDCardDetailLock = { mount, refresh: _scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
