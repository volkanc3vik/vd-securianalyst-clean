// ════════════════════════════════════════════════════════════════════
// ui/premium/claude-copy-lock.js
// "AI Analiz — Claude.ai" kopyalama paneli: Free/teaser → görsel kilit.
//
// Premium/admin → normal "📋 Kopyala → Claude.ai".
// Free/teaser  → buton "🔒 Premium — Claude.ai Analizi" + kilit notu;
//   tıklayınca copyPrompt() zaten gate'lediği için Sales Funnel açılır.
// Reversible · body observer + vd:access:changed. Render-only.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  if (window.VDClaudeCopyLock) return;

  const LOCK_LABEL = _t('prm.claudeLockLabel', null, '🔒 Premium — Claude.ai Analizi');
  const NOTE_CLASS = 'vd-claude-locknote';
  const NOTE_HTML = _t('prm.claudeCopyNote');
  let _mounted = false, _raf = false;

  function _isPremium() {
    try {
      if (window.VDAccess && window.VDAccess.isPremium) return window.VDAccess.isPremium();
      if (window.APP_ACCESS && window.APP_ACCESS.isPremium) return window.APP_ACCESS.isPremium();
    } catch (e) {}
    return false;
  }

  // Claude kopyalama butonunu bul (onclick=copyPrompt veya metinden)
  function _btn() {
    let b = document.querySelector('button[onclick*="copyPrompt"]');
    if (b) return b;
    return Array.from(document.querySelectorAll('.gbtn, button')).find(x => /Claude\.ai/i.test(x.textContent || '')) || null;
  }
  function _card(btn) { return btn ? btn.closest('.glass-card') : null; }

  function _lock() {
    const btn = _btn(); if (!btn) return;
    if (!btn.hasAttribute('data-vd-claudelock')) {
      btn.setAttribute('data-vd-claudelock', '1');
      btn.setAttribute('data-vd-lbl', btn.innerHTML);
      btn.innerHTML = LOCK_LABEL;
      btn.classList.add('vd-claude-locked');
    }
    const card = _card(btn);
    if (card && !card.querySelector('.' + NOTE_CLASS)) {
      const note = document.createElement('div');
      note.className = NOTE_CLASS;
      note.innerHTML = NOTE_HTML;
      note.style.cssText = 'margin-top:10px;padding:10px 13px;border-radius:10px;font-size:12px;font-weight:600;color:#00D1FF;background:rgba(0,209,255,.07);border:1px solid rgba(0,209,255,.28);cursor:pointer';
      note.addEventListener('click', _openFunnel);
      const row = card.querySelector('.copy-row') || btn.parentElement;
      if (row && row.parentElement) row.parentElement.insertBefore(note, row.nextSibling); else card.appendChild(note);
    }
  }

  function _unlock() {
    const btn = _btn();
    if (btn && btn.hasAttribute('data-vd-claudelock')) {
      btn.innerHTML = btn.getAttribute('data-vd-lbl') || _t('prm.copyToClaude', null, '📋 Kopyala → Claude.ai');
      btn.removeAttribute('data-vd-claudelock'); btn.removeAttribute('data-vd-lbl');
      btn.classList.remove('vd-claude-locked');
    }
    document.querySelectorAll('.' + NOTE_CLASS).forEach(n => n.remove());
  }

  function _openFunnel() {
    if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
    else if (window.VDPremiumModal && window.VDPremiumModal.show) window.VDPremiumModal.show();
    else location.href = 'index.html#premium';
  }

  function _scan() { _isPremium() ? _unlock() : _lock(); }
  function _schedule() { if (_raf) return; _raf = true; requestAnimationFrame(() => { _raf = false; _scan(); }); }

  function _injectStyle() {
    if (document.getElementById('vd-claude-lock-style')) return;
    const st = document.createElement('style'); st.id = 'vd-claude-lock-style';
    st.textContent = '.vd-claude-locked{opacity:.92;filter:saturate(.6)}.vd-claude-cta{text-decoration:underline}';
    document.head.appendChild(st);
  }

  function mount() {
    if (_mounted) return; _mounted = true;
    _injectStyle();
    const obs = new MutationObserver(_schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('vd:access:changed', _scan);
    _scan();
  }

  window.VDClaudeCopyLock = { mount, refresh: _scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
