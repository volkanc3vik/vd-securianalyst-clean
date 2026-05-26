// ════════════════════════════════════════════════════════════════════
// AI COMMENT LOCK (Mini-Aşama B.3-PREMIUM)
//
// AI yorum bloklarını kısmi blur yapar:
//   - İlk 2 cümle/satır AÇIK
//   - Ortası BLUR
//   - SON cümle/satır AÇIK (intrigue pattern)
//   - Altta premium bilgilendirme + buton
//
// Hedef bloklar:
//   - #aiComment (ana AI yorum)
//   - .ai-comment (CSS class, birden fazla yer)
//   - .sc-ai-comment (signal/setup card AI yorum)
//
// İdempotency: data-vd-ai-locked marker
//
// Public API:
//   VDAICommentLock.mount()
//   VDAICommentLock.unmount()
//   VDAICommentLock.refresh()
//
// Güvenlik: textContent ile parse, innerHTML YOK.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const LOCKED_MARKER = 'data-vd-ai-locked';
  const ORIGINAL_TEXT_ATTR = 'data-vd-ai-original';
  const TARGET_SELECTORS = '#aiComment, .ai-comment, .sc-ai-comment';
  // Minimum satır sayısı — bu kadar az satırlı blok kilitlenmez
  const MIN_LINES = 4;

  let _observer = null;
  let _mounted = false;
  let _rafScheduled = false;

  function _debug(...args) {
    if (window.VDPremiumDebug) console.debug('[AICommentLock]', ...args);
  }

  // ── Metni cümle/satırlara böl ────────────────────────────────────
  // Strateji:
  //   1) Önce \n ile böl (varsa)
  //   2) Eğer tek satırsa → cümle bazlı böl (. ! ?)
  //   3) En az 4 parça olmalı (yoksa kilit uygulanmaz)
  function _splitLines(text) {
    if (!text) return [];
    const trimmed = String(text).trim();
    if (!trimmed) return [];

    // Newline varsa onları kullan
    if (trimmed.includes('\n')) {
      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= MIN_LINES) return lines;
    }

    // Yoksa cümle bazlı bölme
    // Türkçe + İngilizce noktalama: . ! ? :
    const sentences = trimmed
      .split(/(?<=[.!?:])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    return sentences;
  }

  // ── Premium info kutusu oluştur ──────────────────────────────────
  function _createPremiumNote() {
    const note = document.createElement('div');
    note.className = 'vd-ai-lock-note';

    const line1 = document.createElement('div');
    line1.className = 'vd-ai-lock-line';
    const icon1 = document.createElement('span');
    icon1.className = 'vd-ai-lock-icon';
    icon1.textContent = '🔒';
    const text1 = document.createElement('span');
    text1.textContent = ' Bu analiz AI tarafından çok katmanlı olarak üretilmiştir';
    line1.appendChild(icon1);
    line1.appendChild(text1);

    const line2 = document.createElement('div');
    line2.className = 'vd-ai-lock-line';
    const icon2 = document.createElement('span');
    icon2.className = 'vd-ai-lock-icon';
    icon2.textContent = '🔒';
    const text2 = document.createElement('span');
    text2.textContent = ' Tam analiz premium kullanıcılar içindir';
    line2.appendChild(icon2);
    line2.appendChild(text2);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vd-ai-lock-cta';
    btn.textContent = "Premium'a Geç";
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.VDPremiumModal?.show) {
        window.VDPremiumModal.show();
      }
    });

    note.appendChild(line1);
    note.appendChild(line2);
    note.appendChild(btn);
    return note;
  }

  // ── Bir bloğu kilitle ────────────────────────────────────────────
  function _lockBlock(el) {
    if (!el) return;
    if (el.getAttribute(LOCKED_MARKER) === 'true') return;

    const originalText = (el.textContent || '').trim();
    if (!originalText) return;

    const lines = _splitLines(originalText);
    if (lines.length < MIN_LINES) {
      _debug('block too short, skipping:', lines.length, 'lines');
      return;
    }

    // Orijinal metni sakla (premium'a geçince geri yüklemek için)
    el.setAttribute(ORIGINAL_TEXT_ATTR, originalText);

    // İlk 2 + son 1 + ortadaki blur
    // lines: [0, 1, 2, ..., N-1]
    // visible: lines[0], lines[1]    → açık
    // blur:    lines[2..N-2]         → blur
    // visible: lines[N-1]            → açık
    const firstVisible = lines.slice(0, 2);
    const middleBlur = lines.slice(2, -1);
    const lastVisible = lines[lines.length - 1];

    if (middleBlur.length === 0) {
      // Sadece 3 satır var, blur yapılacak ortası yok — skip
      _debug('no middle to blur, skipping');
      el.removeAttribute(ORIGINAL_TEXT_ATTR);
      return;
    }

    // Mevcut içeriği temizle (textContent ile)
    el.textContent = '';
    el.setAttribute(LOCKED_MARKER, 'true');

    // ── First visible (open) ──
    const openWrap = document.createElement('div');
    openWrap.className = 'vd-ai-lock-open';
    firstVisible.forEach(line => {
      const p = document.createElement('span');
      p.className = 'vd-ai-lock-sentence';
      p.textContent = line + ' ';
      openWrap.appendChild(p);
    });
    el.appendChild(openWrap);

    // ── Middle blur ──
    const blurWrap = document.createElement('div');
    blurWrap.className = 'vd-ai-lock-blur';
    blurWrap.setAttribute('aria-hidden', 'true');
    middleBlur.forEach(line => {
      const p = document.createElement('span');
      p.className = 'vd-ai-lock-sentence';
      p.textContent = line + ' ';
      blurWrap.appendChild(p);
    });
    el.appendChild(blurWrap);

    // ── Last visible (open, intrigue) ──
    const lastWrap = document.createElement('div');
    lastWrap.className = 'vd-ai-lock-open vd-ai-lock-last';
    const lastSpan = document.createElement('span');
    lastSpan.className = 'vd-ai-lock-sentence';
    lastSpan.textContent = lastVisible;
    lastWrap.appendChild(lastSpan);
    el.appendChild(lastWrap);

    // ── Premium note ──
    el.appendChild(_createPremiumNote());

    _debug('locked block:', lines.length, 'lines', '→ 2 visible / ' + middleBlur.length + ' blur / 1 visible');
  }

  // ── Bir bloğu kilitten çıkar (premium aktivasyonu) ───────────────
  function _unlockBlock(el) {
    if (!el) return;
    if (el.getAttribute(LOCKED_MARKER) !== 'true') return;
    const original = el.getAttribute(ORIGINAL_TEXT_ATTR);
    if (original != null) {
      el.textContent = original;
      el.removeAttribute(ORIGINAL_TEXT_ATTR);
    }
    el.removeAttribute(LOCKED_MARKER);
  }

  // ── Bir bloğun içeriği güncellendiyse re-lock ────────────────────
  // Mevcut innerHTML değiştirme pattern'i (AINarrator) yüzünden
  // marker'lı bir blok dış kod tarafından override edilmiş olabilir.
  // Bu durumda marker temizlenir ve yeniden kilit uygulanır.
  function _checkAndRelock(el) {
    if (!el) return;
    const isMarked = el.getAttribute(LOCKED_MARKER) === 'true';
    if (!isMarked) return;
    // Lock yapılarımız mevcut mu? (yoksa içerik resetlenmiş)
    if (!el.querySelector('.vd-ai-lock-open')) {
      // İçerik dış koddan güncellenmiş — marker'ı kaldır, yeniden işle
      el.removeAttribute(LOCKED_MARKER);
      el.removeAttribute(ORIGINAL_TEXT_ATTR);
    }
  }

  // ── Tarama ────────────────────────────────────────────────────────
  function _scan() {
    if (!window.APP_ACCESS) return;
    const isPremium = window.APP_ACCESS.isPremium();

    const blocks = document.querySelectorAll(TARGET_SELECTORS);
    blocks.forEach(el => {
      if (isPremium) {
        _unlockBlock(el);
        return;
      }
      _checkAndRelock(el);
      _lockBlock(el);
    });
  }

  function _scheduleScan() {
    if (_rafScheduled) return;
    _rafScheduled = true;
    requestAnimationFrame(() => {
      _rafScheduled = false;
      _scan();
    });
  }

  // ── Observer setup ────────────────────────────────────────────────
  function _setupObserver() {
    // Body'yi gözlemle (AI yorum blokları çeşitli yerlerde olabilir)
    _observer = new MutationObserver(_scheduleScan);
    _observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function _onAccessChanged() {
    _scan();
  }

  // ── Mount ─────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    _mounted = true;
    _setupObserver();
    _scan();
    window.addEventListener('vd:access:changed', _onAccessChanged);
    _debug('mounted');
  }

  function unmount() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    window.removeEventListener('vd:access:changed', _onAccessChanged);
    // Tüm kilitlenmiş blokları aç
    document.querySelectorAll(`[${LOCKED_MARKER}="true"]`).forEach(el => _unlockBlock(el));
    _mounted = false;
    _debug('unmounted');
  }

  function refresh() {
    _scan();
  }

  window.VDAICommentLock = { mount, unmount, refresh };
})();
