// ════════════════════════════════════════════════════════════════════
// TELEGRAM UI · CARD BUTTON
// Sinyal kartlarına "📤 Telegram" butonu enjekte eder.
//
// Davranış:
//   - Sadece admin aktifken çalışır
//   - MutationObserver SADECE 3 sinyal grid container'ını dinler
//     (#longGrid, #shortGrid, #jokerGrid) — body değil
//   - Her karta `data-telegram-attached="true"` marker konur,
//     ikinci kez işlenmez (idempotent)
//   - RAF batch: aynı frame'deki tüm kartlar tek seferde işlenir
//   - Admin kapatılınca tüm butonlar kaldırılır + observer disconnect
//   - Buton tıklanınca telegram-dropdown.js açılır
//
// Namespace: window.TelegramUI.CardButton
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  window.TelegramUI = window.TelegramUI || {};
  const NS = window.TelegramUI;

  const CONTAINER_IDS = ['longGrid', 'shortGrid', 'jokerGrid'];
  // TI panel container — mount point
  const TI_CONTAINER_ID = 'tiPanelMount';
  // TI panel içindeki hedef element'ler
  const TI_BEST_SELECTOR  = '.ti-best';            // En Olgun Setup container
  const TI_WATCH_SELECTOR = '.ti-watch-row';       // Watchlist her satırı
  const CARD_SELECTOR = '.opp';
  const MARKER_ATTR = 'data-telegram-attached';
  const BTN_CLASS = 'vd-tg-card-btn';
  const TI_BTN_CLASS = 'vd-tg-ti-btn';             // TI panel'deki butonlar için ayrı class

  let _observer = null;
  let _enabled = false;
  let _pendingProcess = false;

  function _debug(...args) {
    if (NS.debug) console.debug('[TG-UI:Btn]', ...args);
  }

  // ── Tek kart işleme ─────────────────────────────────────────────
  function _processCard(card) {
    if (!card || !card.classList) return;
    // Idempotency — zaten işlendi mi?
    if (card.getAttribute(MARKER_ATTR) === 'true') return;
    if (card.querySelector('.' + BTN_CLASS)) {
      // Bir şekilde marker yok ama buton var — marker'ı koy, geç
      card.setAttribute(MARKER_ATTR, 'true');
      return;
    }

    // Yön: opp.long / opp.short / opp.joker-long / opp.joker-short
    let dir = null;
    if (card.classList.contains('joker-long')) dir = 'LONG';
    else if (card.classList.contains('joker-short')) dir = 'SHORT';
    else if (card.classList.contains('long')) dir = 'LONG';
    else if (card.classList.contains('short')) dir = 'SHORT';

    if (!dir) {
      _debug('skip: no direction class', card.className);
      return;
    }

    // Sembol — .opp-sym içerikten oku
    const symEl = card.querySelector('.opp-sym');
    if (!symEl) {
      _debug('skip: no .opp-sym');
      return;
    }
    const symBase = (symEl.textContent || '').trim();
    if (!symBase) return;
    const sym = symBase.endsWith('USDT') ? symBase : symBase + 'USDT';

    // Buton oluştur
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.setAttribute('data-sym', sym);
    btn.setAttribute('data-dir', dir);
    btn.setAttribute('aria-label', `${sym} ${dir} sinyalini Telegram'a gönder`);
    btn.innerHTML = `<span class="vd-tg-card-btn-ico">📤</span><span class="vd-tg-card-btn-label">Telegram</span>`;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();   // kart tıklaması (grafikte aç) tetiklenmesin
      e.preventDefault();
      _onClick(btn, sym, dir);
    });

    // Kart click'i bubbling yapacak, butona basınca grafik açılmasın diye stop propagation
    // Butonu kartın sonuna ekle (opp-btn'nin yanına)
    const existingBtn = card.querySelector('.opp-btn');
    if (existingBtn && existingBtn.parentElement) {
      // opp-btn'nin yanında bir wrapper oluştur
      let wrap = card.querySelector('.vd-tg-btn-row');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'vd-tg-btn-row';
        existingBtn.parentElement.insertBefore(wrap, existingBtn);
        wrap.appendChild(existingBtn);
      }
      wrap.appendChild(btn);
    } else {
      card.appendChild(btn);
    }

    card.setAttribute(MARKER_ATTR, 'true');
    _debug('attached', sym, dir);
  }

  // ── Buton tıklanınca dropdown aç ────────────────────────────────
  function _onClick(btn, sym, dir) {
    if (!NS.Dropdown || !NS.Dropdown.open) {
      NS.Toast?.error('Dropdown yüklenmedi');
      return;
    }
    NS.Dropdown.open(btn, sym, dir);
  }

  // ── Batch processing — RAF içinde ───────────────────────────────
  function _scheduleProcess() {
    if (_pendingProcess) return;
    _pendingProcess = true;
    requestAnimationFrame(() => {
      _pendingProcess = false;
      if (!_enabled) return;
      _processAllNewCards();
    });
  }

  function _processAllNewCards() {
    // Mevcut sinyal kartları (Long/Short/Joker grid)
    for (const id of CONTAINER_IDS) {
      const container = document.getElementById(id);
      if (!container) continue;
      const cards = container.querySelectorAll(`${CARD_SELECTOR}:not([${MARKER_ATTR}])`);
      for (const card of cards) _processCard(card);
    }
    // TI panel — Best Setup + Watchlist
    _processTIPanel();
  }

  // ── TI Panel: Best Setup ve Watchlist için buton enjeksiyonu ────
  function _processTIPanel() {
    const ti = document.getElementById(TI_CONTAINER_ID);
    if (!ti) return;
    // Best Setup
    const bestEls = ti.querySelectorAll(`${TI_BEST_SELECTOR}:not([${MARKER_ATTR}])`);
    bestEls.forEach(_processTIBest);
    // Watchlist satırları
    const watchEls = ti.querySelectorAll(`${TI_WATCH_SELECTOR}:not([${MARKER_ATTR}])`);
    watchEls.forEach(_processTIWatchRow);
  }

  // Best Setup için — sağ üst köşeye belirgin ama küçük "📤 Telegram" butonu
  function _processTIBest(el) {
    if (!el || el.getAttribute(MARKER_ATTR) === 'true') return;
    if (el.querySelector('.' + TI_BTN_CLASS)) {
      el.setAttribute(MARKER_ATTR, 'true');
      return;
    }
    // sym
    const symEl = el.querySelector('.ti-best-sym');
    if (!symEl) return;
    const symBase = (symEl.textContent || '').trim();
    if (!symBase || symBase === '—') return;
    const sym = symBase.endsWith('USDT') ? symBase : symBase + 'USDT';
    // dir
    const dirEl = el.querySelector('.ti-best-dir');
    const dirTxt = (dirEl?.textContent || '').trim();
    let dir = null;
    if (/LONG/i.test(dirTxt) || dirEl?.classList?.contains('long'))  dir = 'LONG';
    else if (/SHORT/i.test(dirTxt) || dirEl?.classList?.contains('short')) dir = 'SHORT';
    if (!dir) {
      _debug('TI Best: dir okunamadı', dirTxt);
      return;
    }
    // Buton
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${BTN_CLASS} ${TI_BTN_CLASS} vd-tg-ti-best-btn`;
    btn.setAttribute('data-sym', sym);
    btn.setAttribute('data-dir', dir);
    btn.setAttribute('aria-label', `${sym} ${dir} Telegram'a gönder`);
    btn.innerHTML = `<span class="vd-tg-card-btn-ico">📤</span><span class="vd-tg-card-btn-label">Telegram</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      _onClick(btn, sym, dir);
    });
    // ti-best-head içine ekle (mevcut head'in sonuna)
    const head = el.querySelector('.ti-best-head');
    if (head) head.appendChild(btn);
    else el.appendChild(btn);

    el.setAttribute(MARKER_ATTR, 'true');
    _debug('TI Best attached', sym, dir);
  }

  // Watchlist satırı için — sağ tarafta kompakt 📤 ikon
  function _processTIWatchRow(row) {
    if (!row || row.getAttribute(MARKER_ATTR) === 'true') return;
    if (row.querySelector('.' + TI_BTN_CLASS)) {
      row.setAttribute(MARKER_ATTR, 'true');
      return;
    }
    // sym
    const symEl = row.querySelector('.ti-watch-sym');
    if (!symEl) return;
    const symBase = (symEl.textContent || '').trim();
    if (!symBase || symBase === '—') return;
    const sym = symBase.endsWith('USDT') ? symBase : symBase + 'USDT';
    // dir
    const dirEl = row.querySelector('.ti-watch-dir');
    const dirTxt = (dirEl?.textContent || '').trim();
    let dir = null;
    if (/LONG/i.test(dirTxt)  || dirEl?.classList?.contains('long'))  dir = 'LONG';
    else if (/SHORT/i.test(dirTxt) || dirEl?.classList?.contains('short')) dir = 'SHORT';
    if (!dir) {
      _debug('TI Watch: dir okunamadı', dirTxt);
      return;
    }
    // Kompakt ikon buton
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${BTN_CLASS} ${TI_BTN_CLASS} vd-tg-ti-watch-btn`;
    btn.setAttribute('data-sym', sym);
    btn.setAttribute('data-dir', dir);
    btn.setAttribute('title', `${sym} ${dir} Telegram'a gönder`);
    btn.setAttribute('aria-label', `${sym} ${dir} Telegram'a gönder`);
    btn.innerHTML = `<span class="vd-tg-card-btn-ico">📤</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      _onClick(btn, sym, dir);
    });
    row.appendChild(btn);
    row.setAttribute(MARKER_ATTR, 'true');
    _debug('TI Watch attached', sym, dir);
  }

  // ── Observer setup ──────────────────────────────────────────────
  function _setupObserver() {
    if (_observer) _observer.disconnect();
    _observer = new MutationObserver((mutations) => {
      if (!_enabled) return;
      let hasAdded = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) { hasAdded = true; break; }
      }
      if (hasAdded) _scheduleProcess();
    });
    // Sinyal grid container'ları — subtree değil, sadece direct children
    for (const id of CONTAINER_IDS) {
      const c = document.getElementById(id);
      if (c) _observer.observe(c, { childList: true, subtree: false });
    }
    // TI panel mount — subtree TRUE (panel iç güncelleme yapıyor, watchlist tek tek doluyor)
    const ti = document.getElementById(TI_CONTAINER_ID);
    if (ti) _observer.observe(ti, { childList: true, subtree: true });
    _debug('observer attached on', [...CONTAINER_IDS, TI_CONTAINER_ID].join(', '));
  }

  // ── Enable / Disable ────────────────────────────────────────────
  function enable() {
    if (_enabled) return;
    _enabled = true;
    _setupObserver();
    _processAllNewCards();
    _debug('enabled');
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    // Mevcut butonları temizle — hem normal sinyal kartı hem TI panel
    document.querySelectorAll(`[${MARKER_ATTR}="true"]`).forEach(el => {
      el.removeAttribute(MARKER_ATTR);
      // İçindeki tüm telegram butonlarını sil (.vd-tg-card-btn class normal + TI hepsinde var)
      el.querySelectorAll('.' + BTN_CLASS).forEach(b => b.remove());
      // Sinyal kartında wrapper varsa — opp-btn'i geri eski yerine taşı
      const wrap = el.querySelector('.vd-tg-btn-row');
      if (wrap && wrap.children.length === 1 && wrap.firstElementChild?.classList?.contains('opp-btn')) {
        wrap.parentElement.insertBefore(wrap.firstElementChild, wrap);
        wrap.remove();
      } else if (wrap && wrap.children.length === 0) {
        wrap.remove();
      }
    });
    _debug('disabled');
  }

  // ── Admin event listener ────────────────────────────────────────
  function init() {
    window.addEventListener('vd:telegram:admin', (e) => {
      if (e.detail?.active) enable();
      else disable();
    });
    _debug('init complete');
  }

  window.TelegramUI.CardButton = { init, enable, disable };
})();
