// ════════════════════════════════════════════════════════════════════
// features/timeline/timeline-render.js  (Market Timeline — Phase 1)
// VDEventStore (market_events_v1) → gerçek market akış merkezi.
//
// • Dashboard Event Center ile AYNI veri kaynağı (market_events_v1).
// • NC deposuna / kategorilerine / dedupe'una DOKUNMAZ — salt OKUMA.
// • NC'nin 6 iç kategorisini, msg/concepts/dir ipuçlarından 8 GÖRÜNÜM
//   kategorisine türetir (read-only): Momentum, Likidite, Funding,
//   Open Interest, Breakout, Risk, Smart Money, Trend Shift.
// • Tüm coinler (BTC dahil hepsi). Kronolojik (yeni→eski). Savunmacı dedupe.
// • Her kart: Coin · Kategori · Saat · Açıklama · Güven seviyesi.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDTimeline) return;

  // 8 görünüm kategorisi — mor YOK (cyan/blue/green/amber/red paleti)
  const CATS = [
    { key: 'momentum', label: 'Momentum',      icon: '⚡', color: 'var(--v4-success)',   kw: ['momentum', 'ivme', 'rsi', 'hacim artış', 'güç kazan', 'hızlan'], desc: 'Fiyat hareketinin güç kazanmasıdır. Hacim ve indikatör desteğiyle trendin hızlandığını gösterebilir.' },
    { key: 'likidite', label: 'Likidite',      icon: '💧', color: 'var(--v4-blue)',      kw: ['likidite', 'liquidity', 'likidasyon', 'liquidation', 'likit', 'derinlik'], desc: 'Piyasada emirlerin yoğunlaştığı bölgelerdir. Fiyat çoğu zaman bu bölgeleri test edebilir.' },
    { key: 'funding',  label: 'Funding',       icon: '💰', color: 'var(--v4-warn)',      kw: ['funding', 'fonlama', 'fon oranı', 'funding rate'], desc: 'Vadeli işlemlerde pozisyon taşıma maliyetidir. Aşırı pozitif funding long tarafının kalabalık olduğunu gösterebilir.' },
    { key: 'oi',       label: 'Open Interest', icon: '📊', color: 'var(--v4-cyan)',      kw: ['open interest', 'açık pozisyon', 'oi artış', 'oi düş', ' oi '], desc: 'Açık pozisyon miktarıdır. Artış, piyasaya yeni para ve ilgi girdiğini gösterebilir.' },
    { key: 'breakout', label: 'Breakout',      icon: '🚀', color: 'var(--v4-cyan-br)',   kw: ['breakout', 'kırılım', 'kırdı', 'direnç kır', 'destek kır', 'seviye kır', 'aşıldı'], desc: 'Fiyatın önemli destek/direnç bölgesini kırmasıdır. Hacimle desteklenirse daha anlamlıdır.' },
    { key: 'risk',     label: 'Risk',          icon: '⚠',  color: 'var(--v4-danger)',    kw: ['risk', 'uyarı', 'tehlike', 'fake', 'tuzak', 'manipül', 'sahte', 'dikkat'], desc: 'Sahte kırılım, stop avı, aşırı kalabalık yön veya manipülasyon ihtimalini gösterir.' },
    { key: 'smart',    label: 'Smart Money',   icon: '🐋', color: 'var(--v4-blue-elec)', kw: ['smart money', 'whale', 'balina', 'order block', 'fvg', 'smc', 'kurumsal', 'akıllı para'], desc: 'Büyük oyuncu/kurumsal para hareketlerini temsil eden piyasa davranışıdır.' },
    { key: 'trend',    label: 'Trend Shift',   icon: '🔀', color: 'var(--v4-teal)',      kw: ['trend', 'yön değiş', 'trend değiş', 'reversal', 'dönüş', 'rejim', 'regime', 'yapı değiş'], desc: 'Piyasa yönünün değişmeye başladığını gösteren yapı değişimidir.' },
  ];
  const CAT_BY_KEY = {}; CATS.forEach(c => { CAT_BY_KEY[c.key] = c; });
  // NC iç kategorisi → görünüm kategorisi (anahtar kelime eşleşmezse yedek)
  const NC_FALLBACK = { momentum: 'momentum', likidite: 'likidite', risk: 'risk', piyasa: 'trend', ogren: 'momentum', referans: 'smart' };
  // Öncelik sırası (en belirleyici önce)
  const ORDER = ['risk', 'funding', 'oi', 'breakout', 'smart', 'likidite', 'trend', 'momentum'];

  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function _deriveCat(ev) {
    const hay = ((ev.msg || '') + ' ' + ((ev.concepts || []).join(' '))).toLowerCase();
    for (const key of ORDER) {
      const c = CAT_BY_KEY[key];
      if (c.kw.some(k => hay.includes(k))) return key;
    }
    const dir = (ev.dir || '').toLowerCase();
    if (dir === 'fake' || dir === 'warn') return 'risk';
    if (dir === 'long' || dir === 'short') return 'momentum';
    return NC_FALLBACK[ev.category] || 'momentum';
  }

  // Güven seviyesi: conf (sayı/etiket) varsa onu; yoksa level → etiket
  function _conf(ev) {
    let pct = null;
    if (ev.conf != null) {
      const n = Number(ev.conf);
      if (!isNaN(n)) pct = Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
      else {
        const s = String(ev.conf).toLowerCase();
        if (s.includes('yüksek') || s.includes('high')) pct = 80;
        else if (s.includes('orta') || s.includes('med')) pct = 55;
        else if (s.includes('düş') || s.includes('low')) pct = 30;
      }
    }
    if (pct == null) {
      const lv = (ev.level || 'medium').toLowerCase();
      pct = lv === 'critical' ? 95 : lv === 'high' ? 80 : lv === 'low' ? 30 : 55;
    }
    const label = pct >= 85 ? 'Çok Yüksek' : pct >= 70 ? 'Yüksek' : pct >= 45 ? 'Orta' : 'Düşük';
    const tone  = pct >= 70 ? 'hi' : pct >= 45 ? 'mid' : 'lo';
    return { pct: Math.round(pct), label, tone };
  }

  function _coin(sym) { return sym ? String(sym).replace('USDT', '').replace('PERP', '') : 'PİYASA'; }
  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _time(ts) { const d = new Date(ts || 0); return _pad(d.getHours()) + ':' + _pad(d.getMinutes()); }
  function _date(ts) { try { return new Date(ts || 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function _rel(ts) {
    const diff = Date.now() - (ts || 0);
    if (diff < 0) return 'az önce';
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return m + ' dakika önce';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' saat önce';
    return Math.floor(h / 24) + ' gün önce';
  }

  let _filter = 'all';
  let _items = [];

  // PHASE 3: teaser oturumunda yalnız linkteki coin olayları
  function _teaserCoin() {
    try { if (window.VDAccess && window.VDAccess.level && window.VDAccess.level() === 'teaser' && window.VDTeaser) return _coin(window.VDTeaser.symbol()); } catch (e) {}
    return null;
  }

  function _load() {
    const store = window.VDEventStore;
    const raw = store && store.getAll ? store.getAll() : [];   // yeni→eski
    const tCoin = _teaserCoin();
    const seen = new Set(); const out = [];
    for (const e of raw) {
      if (tCoin && _coin(e.sym) !== tCoin) continue;   // teaser: diğer coinler gizli
      // Savunmacı dedupe (NC zaten yazarken dedupe ediyor; burada görsel tekrar engeli)
      const k = e._k || (_coin(e.sym) + '|' + e.category + '|' + String(e.msg || '').slice(0, 60).toLowerCase());
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ id: e.id, ts: e.ts, sym: e.sym, msg: e.msg, dcat: _deriveCat(e), conf: _conf(e) });
    }
    _items = out;
  }

  function _chipsHTML() {
    const counts = { all: _items.length };
    _items.forEach(it => { counts[it.dcat] = (counts[it.dcat] || 0) + 1; });
    const chip = (key, label, icon) => {
      const n = counts[key] || 0;
      const on = _filter === key ? ' on' : '';
      const dim = (key !== 'all' && n === 0) ? ' dim' : '';
      return `<button class="tl-chip${on}${dim}" data-tl-cat="${key}" type="button">${icon ? icon + ' ' : ''}${_esc(label)}<span class="tl-chip-n">${n}</span></button>`;
    };
    return `<div class="tl-chips">${chip('all', 'Tümü', '🧭')}${CATS.map(c => chip(c.key, c.label, c.icon)).join('')}</div>`;
  }

  function _cardHTML(it) {
    const c = CAT_BY_KEY[it.dcat] || CATS[0];
    return `
      <article class="tl-card" style="--c:${c.color}">
        <span class="tl-node"></span>
        <div class="tl-when"><time class="tl-time">${_time(it.ts)}</time><span class="tl-date">${_esc(_date(it.ts))}</span></div>
        <div class="tl-main">
          <div class="tl-head">
            <span class="tl-coin">${_esc(_coin(it.sym))}</span>
            <span class="tl-cat-wrap">
              <span class="tl-cat" style="--c:${c.color}">${c.icon} ${_esc(c.label)}</span>
              <button class="tl-i" data-tl-tip type="button" aria-label="${_esc(c.label)} açıklaması">ⓘ</button>
              <span class="tl-tip" role="tooltip"><b>${_esc(c.label)}</b><br>${_esc(c.desc || '')}</span>
            </span>
            <span class="tl-conf tl-conf-${it.conf.tone}" title="Güven seviyesi">${_esc(it.conf.label)} · %${it.conf.pct}</span>
            <span class="tl-rel">${_esc(_rel(it.ts))}</span>
          </div>
          <div class="tl-msg">${_esc(it.msg)}</div>
        </div>
      </article>`;
  }

  function _renderFeed(root) {
    const feed = root.querySelector('[data-tl-feed]');
    if (!feed) return;
    const list = _filter === 'all' ? _items : _items.filter(it => it.dcat === _filter);
    if (!list.length) {
      feed.innerHTML = `<div class="tl-empty">${_items.length ? 'Bu kategoride olay yok.' : 'Henüz kayıtlı piyasa olayı yok. Ana sayfada analiz çalıştıkça olaylar burada görünecek.'}</div>`;
      return;
    }
    feed.innerHTML = `<div class="tl-line">${list.map(_cardHTML).join('')}</div>`;
  }

  function _renderChips(root) {
    const wrap = root.querySelector('[data-tl-chips]');
    if (!wrap) return;
    wrap.innerHTML = _chipsHTML();
    wrap.querySelectorAll('[data-tl-cat]').forEach(b => {
      b.addEventListener('click', () => {
        _filter = b.getAttribute('data-tl-cat') || 'all';
        _renderChips(root); _renderFeed(root);
      });
    });
  }

  function _summaryHTML() {
    const coins = new Set(); _items.forEach(it => { if (it.sym) coins.add(_coin(it.sym)); });
    return `<span><b>${_items.length}</b> olay</span><span><b>${coins.size}</b> coin</span><span>8 kategori</span>`;
  }

  function render(rootId) {
    const root = document.getElementById(rootId || 'tlRoot');
    if (!root) return;
    _load();
    root.innerHTML = `
      <div class="tl-summary" data-tl-summary>${_summaryHTML()}</div>
      <div data-tl-chips></div>
      <div data-tl-feed></div>`;
    _renderChips(root);
    _renderFeed(root);
    // Kategori ⓘ tooltip toggle — handler'ı yalnızca BİR kez bağla (re-render güvenli)
    if (!root._tlTipWired) {
      root.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('[data-tl-tip]');
        if (!t) return;
        e.stopPropagation();
        const w = t.closest('.tl-cat-wrap');
        if (!w) return;
        const was = w.classList.contains('open');
        root.querySelectorAll('.tl-cat-wrap.open').forEach(o => o.classList.remove('open'));
        if (!was) w.classList.add('open');
      });
      root._tlTipWired = true;
    }
  }

  window.VDTimeline = { render, _deriveCat, CATS };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render('tlRoot'));
  else render('tlRoot');
})();
