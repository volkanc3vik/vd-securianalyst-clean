// ════════════════════════════════════════════════════════════════════
// ui/intelligence/setup-tracker.js
// AI CANLI TAKİP — ÖNCELİK MOTORU  (Build 111)
//
// Sistemin OTOMATİK açtığı (pending) takip kayıtlarını okur. Her kayıt için
// İKİ kaliteyi ölçer ve harmanlar:
//   • GENEL (market uyumu): bu setup kombini (Yön+Risk) TÜM coinlerde geçmişte
//     nasıl sonlanmış (VDInsights kombinasyon oranı).
//   • COIN uyumu: bu coinin KENDİ geçmiş doğrulama oranı (sym bazlı).
//   • BİRLEŞİK = kanıt-ağırlıklı ortalama → 3 ÖNCELİK kademesi:
//       🥇 #1 Altın · 🟠 #2 Turuncu · ⬜ #3 Gri.
// En yeni açılan kayıt EN ÜSTTE. Satıra tıklayınca o coin yüklenir (openCoin).
//
// • YALNIZCA ADMIN görür. • Pending → admin-key (adminFetch). • Öğrenme verisi
//   (doğrulanmış geçmiş) public okunur. • SALT-OKUNUR, DB'ye yazmaz, çekirdeğe
//   dokunmaz, hata akışı bozmaz (try/catch).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const TAG = '[SetupTracker]';
  const CID = 'setupTracker';
  const MAX_ROWS = 10;
  const FETCH_LIMIT = 25;
  const REFRESH_MS = 90 * 1000;

  // Öncelik eşikleri (kolay ayarlanır)
  const GOLD_MIN = 88;   // birleşik ≥ bu + yeterli örnek → Altın #1
  const ORANGE_MIN = 72; // birleşik ≥ bu → Turuncu #2
  const GOLD_MIN_N = 10; // Altın için min toplam örnek

  const _num = (v) => { const n = Number(v); return isNaN(n) ? null : n; };
  const _esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function _isAdmin() {
    try { if (window.VDAccess && typeof window.VDAccess.isAdmin === 'function') return window.VDAccess.isAdmin(); } catch (e) {}
    try { const raw = localStorage.getItem('aap_access_v1'); if (raw) { const d = JSON.parse(raw); if (d && d.isAdmin === true) return true; } } catch (e) {}
    return false;
  }
  function _disp() { return window.TelegramDispatcher || null; }
  function _hasKey() { const d = _disp(); return !!(d && d.hasAdminKey && d.hasAdminKey()); }

  function _dirWord(bias) {
    if (bias === 'bullish') return { txt: 'Yukarı Yönlü', cls: 'st-up', arrow: '▲' };
    if (bias === 'bearish') return { txt: 'Aşağı Yönlü', cls: 'st-down', arrow: '▼' };
    return { txt: 'Nötr', cls: 'st-flat', arrow: '◆' };
  }
  function _sourceWord(src) {
    if (src === 'ai_engine_auto') return 'auto';
    if (src === 'ai_engine') return 'manuel';
    return src ? String(src).slice(0, 12) : '—';
  }
  function _ago(iso) {
    try {
      const t = Date.parse(iso); if (isNaN(t)) return '';
      const m = Math.max(0, Math.round((Date.now() - t) / 60000));
      if (m < 1) return 'az önce';
      if (m < 60) return m + ' dk önce';
      const h = Math.round(m / 60);
      if (h < 24) return h + ' saat önce';
      return Math.round(h / 24) + ' gün önce';
    } catch (e) { return ''; }
  }
  function _fmtPrice(p) {
    const n = _num(p); if (n == null) return '—';
    const a = Math.abs(n);
    const dec = a >= 100 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 5 : 8;
    return '$' + n.toFixed(dec).replace(/\.?0+$/, m => (m.indexOf('.') === 0 ? '' : m));
  }

  // ── Coinin KENDİ geçmiş tutarlılığı (sym bazlı) ────────────────────
  const _W = { validated: 1, partially_validated: 0.5, not_validated: 0 };
  function _coinStats(records) {
    const m = {};
    (records || []).forEach(r => {
      if (!r || !r.sym || _W[r.review_status] == null) return;
      const s = String(r.sym).toUpperCase();
      (m[s] = m[s] || { w: 0, n: 0 });
      m[s].w += _W[r.review_status]; m[s].n += 1;
    });
    const out = {};
    Object.keys(m).forEach(s => { out[s] = { rate: Math.round(m[s].w / m[s].n * 100), n: m[s].n }; });
    return out;
  }

  // ── DEĞERLENDİRME: GENEL (market) + COIN → BİRLEŞİK ────────────────
  function _assess(rec, insights, coinStats) {
    const eng = window.VDInsights;
    if (!eng || typeof eng._features !== 'function' || !insights) return null;
    const MIN = eng.MIN_SAMPLE || 5;
    let feats;
    try { feats = eng._features(rec) || []; } catch (e) { feats = []; }
    const fset = new Set(feats);

    // GENEL: ayırt edici kombinasyon (Yön/Risk içeren); salt conf/tf'yi atla
    let market = null;
    (insights.rows || []).forEach(r => {
      const toks = String(r.key).split(' & ');
      if (r.n < MIN || !toks.every(t => fset.has(t))) return;
      const kinds = toks.map(t => t.split(':')[0]);
      if (kinds.every(k => k === 'tf' || k === 'conf')) return; // geniş kalıbı ele
      const hasBias = kinds.includes('bias'), hasRisk = kinds.includes('risk');
      let spec = toks.length >= 2 ? 2 : 1;
      if (hasBias && hasRisk) spec = 2.5;
      if (!market || spec > market.spec || (spec === market.spec && r.n > market.n))
        market = { rate: r.rate, n: r.n, label: r.label, spec };
    });
    if (!market) { // yedek: yön/risk tekli
      (insights.rows || []).forEach(r => {
        if (r.key.includes(' & ') || r.n < MIN || !fset.has(r.key)) return;
        const k = r.key.split(':')[0]; if (k !== 'bias' && k !== 'risk') return;
        if (!market || r.n > market.n) market = { rate: r.rate, n: r.n, label: r.label, spec: 1 };
      });
    }

    // COIN: kendi geçmişi (yeterli örnek)
    const sym = String(rec.sym || '').toUpperCase();
    const cs = coinStats && coinStats[sym];
    const coin = (cs && cs.n >= MIN) ? { rate: cs.rate, n: cs.n } : null;

    // BİRLEŞİK: kanıt-ağırlıklı ortalama
    let combined = null, totalN = 0;
    if (market && coin) { combined = Math.round((market.rate * market.n + coin.rate * coin.n) / (market.n + coin.n)); totalN = market.n + coin.n; }
    else if (market) { combined = market.rate; totalN = market.n; }
    else if (coin) { combined = coin.rate; totalN = coin.n; }
    if (combined == null) return null;

    return { market, coin, combined, totalN };
  }

  function _tier(a) {
    if (!a) return { cls: 'st-c0', img: 'coin-gray', name: 'yetersiz veri' };
    if (a.combined >= GOLD_MIN && a.totalN >= GOLD_MIN_N) return { cls: 'st-c1', img: 'coin-gold', name: 'ALTIN' };
    if (a.combined >= ORANGE_MIN) return { cls: 'st-c2', img: 'coin-orange', name: 'TURUNCU' };
    return { cls: 'st-c3', img: 'coin-gray', name: 'GRİ' };
  }

  function _injectCSS() {
    if (document.getElementById('st-style')) return;
    const css = `
    #${CID}{margin:0 0 20px;}
    .st-card{background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:12px 14px;backdrop-filter:blur(20px);}
    .st-hdr{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;}
    .st-title{font-size:13px;font-weight:800;color:var(--text);letter-spacing:.3px;}
    .st-tag{font-size:10px;font-weight:700;color:var(--purple);border:1px solid rgba(157,125,250,.4);border-radius:6px;padding:2px 7px;background:rgba(157,125,250,.08);}
    .st-count{font-size:11px;color:var(--text3);margin-left:auto;}
    .st-refresh{font-size:11px;font-weight:700;color:var(--text2);background:transparent;border:1px solid var(--border);border-radius:7px;padding:3px 9px;cursor:pointer;}
    .st-refresh:hover{border-color:var(--green);color:var(--green);}
    .st-sub{font-size:11px;color:var(--text3);margin:2px 0 9px;}
    .st-row{display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;padding:9px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:7px;cursor:pointer;transition:border-color .15s,background .15s;background:rgba(255,255,255,.015);}
    .st-row:hover{border-color:var(--green);background:rgba(0,229,160,.05);}
    /* Öncelik rozeti = coin logosu (renk = kademe) */
    .st-pri{width:54px;height:54px;display:flex;align-items:center;justify-content:center;flex-shrink:0;perspective:420px;}
    .st-coinimg{width:50px;height:50px;display:block;border-radius:50%;}
    .st-c2 .st-coinimg{filter:drop-shadow(0 0 5px rgba(255,140,40,.5));}
    .st-c3 .st-coinimg{opacity:.92;}
    .st-c0 .st-coinimg{opacity:.55;filter:grayscale(.4);}
    /* ALTIN — gerçek 3D para dönüşü (ön ↔ arka yüz) */
    .st-coin3d{width:50px;height:50px;position:relative;transform-style:preserve-3d;animation:st-flip 4.2s linear infinite;}
    .st-face{position:absolute;inset:0;width:50px;height:50px;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden;}
    .st-face.back{transform:rotateY(180deg);}
    .st-c1 .st-face{filter:drop-shadow(0 0 4px rgba(255,200,80,.65));}
    @keyframes st-flip{from{transform:rotateY(0deg)}to{transform:rotateY(360deg)}}
    .st-mid{min-width:0;}
    .st-line1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
    .st-sym{font-size:14px;font-weight:800;color:var(--text);}
    .st-dir{font-size:11px;font-weight:700;}
    .st-up{color:var(--green);} .st-down{color:var(--red);} .st-flat{color:var(--text2);}
    .st-setup{font-size:11px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .st-split{font-size:10.5px;margin-top:3px;}
    .st-split b{font-weight:800;}
    .st-gen{color:var(--cyan);} .st-coin{color:var(--purple);} .st-na{color:var(--text3);}
    .st-meta{font-size:10px;color:var(--text3);margin-top:3px;}
    .st-right{text-align:right;flex-shrink:0;}
    .st-comb{font-size:17px;font-weight:900;}
    .st-comb.c1{color:#ffc850;} .st-comb.c2{color:#ff9b3d;} .st-comb.c3{color:var(--text2);} .st-comb.c0{color:var(--text3);}
    .st-comb-sub{font-size:9px;color:var(--text3);margin-top:1px;letter-spacing:.5px;}
    .st-empty{font-size:12px;color:var(--text3);padding:10px 2px;text-align:center;}
    .st-note{font-size:10px;color:var(--text3);margin-top:8px;line-height:1.4;}
    `;
    const el = document.createElement('style');
    el.id = 'st-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function _combClass(cls) { return cls === 'st-c1' ? 'c1' : cls === 'st-c2' ? 'c2' : cls === 'st-c3' ? 'c3' : 'c0'; }

  function _rowHTML(rec, insights, coinStats) {
    const sym = String(rec.sym || '').toUpperCase();
    const d = _dirWord(rec.direction_bias);
    const a = _assess(rec, insights, coinStats);
    const t = _tier(a);
    const setupLabel = (a && a.market) ? a.market.label : 'setup eşleşmesi için yeterli geçmiş yok';
    const genTxt = (a && a.market)
      ? `<span class="st-gen">Genel <b>%${a.market.rate}</b> (${a.market.n})</span>`
      : `<span class="st-na">Genel: veri yok</span>`;
    const coinTxt = (a && a.coin)
      ? `<span class="st-coin">Coin <b>%${a.coin.rate}</b> (${a.coin.n})</span>`
      : `<span class="st-na">Coin: veri yok</span>`;
    const combTxt = a ? '%' + a.combined : '—';
    return `
      <div class="st-row" data-sym="${_esc(sym)}" title="Birleşik öncelik: ${_esc(t.name)}">
        ${t.cls === 'st-c1'
          ? `<div class="st-pri st-c1" title="Öncelik: ${_esc(t.name)}"><div class="st-coin3d"><img class="st-face front" src="assets/coin-gold-front.png" alt=""><img class="st-face back" src="assets/coin-gold-back.png" alt=""></div></div>`
          : `<div class="st-pri ${t.cls}" title="Öncelik: ${_esc(t.name)}"><img class="st-coinimg" src="assets/${t.img}.png" alt="${_esc(t.name)}" loading="lazy"></div>`}
        <div class="st-mid">
          <div class="st-line1">
            <span class="st-sym">${_esc(sym)}</span>
            <span class="st-dir ${d.cls}">${d.arrow} ${_esc(d.txt)}</span>
          </div>
          <div class="st-setup">${_esc(setupLabel)}</div>
          <div class="st-split">${genTxt} · ${coinTxt}</div>
          <div class="st-meta">${_fmtPrice(rec.price_at_analysis)} · ${_esc(_ago(rec.created_at))} · ${_esc(_sourceWord(rec.source))}</div>
        </div>
        <div class="st-right">
          <div class="st-comb ${_combClass(t.cls)}">${combTxt}</div>
          <div class="st-comb-sub">BİRLEŞİK</div>
        </div>
      </div>`;
  }

  function _shell(inner) {
    return `<div class="st-card">
      <div class="st-hdr">
        <span class="st-title">🎯 AI Canlı Takip — Öncelik</span>
        <span class="st-tag">yalnızca admin</span>
        <span class="st-count" id="st-count"></span>
        <button class="st-refresh" id="st-refresh">↻ Yenile</button>
      </div>
      ${inner}
    </div>`;
  }

  let _busy = false;
  async function _fetchPending() {
    const d = _disp();
    if (!d || typeof d.adminFetch !== 'function') return { err: 'no_disp' };
    if (!_hasKey()) return { err: 'no_key' };
    try {
      const r = await d.adminFetch('/api/analysis-archive', { action: 'list_pending', limit: FETCH_LIMIT });
      const list = (r && (r.rows || r.list || r.data)) || (Array.isArray(r) ? r : []);
      return { rows: Array.isArray(list) ? list : [] };
    } catch (e) {
      console.warn(TAG, 'pending alınamadı:', e && e.message);
      return { err: 'fetch' };
    }
  }

  async function render() {
    const host = document.getElementById(CID);
    if (!host) return;
    if (!_isAdmin()) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    _injectCSS();
    if (_busy) return;
    _busy = true;
    try {
      if (!window.VDInsights || typeof window.VDInsights.load !== 'function') {
        host.innerHTML = _shell(`<div class="st-empty">Öğrenme modülü yükleniyor… sayfa hazır olunca görünecek.</div>`);
        return;
      }
      let records = [];
      try { records = await window.VDInsights.load(); } catch (e) {}
      let insights = { rows: [], total: 0 };
      try { insights = window.VDInsights.computeInsights(records) || insights; } catch (e) {}
      const coinStats = _coinStats(records);

      const pend = await _fetchPending();
      if (pend.err === 'no_key') {
        host.innerHTML = _shell(`<div class="st-empty">Bu paneli açmak için admin anahtarını bir kez etkinleştir.<br>(Bu oturum boyunca hatırlanır, tarayıcıyı kapatınca tekrar sorar.)</div>`);
        return;
      }
      if (pend.err) {
        host.innerHTML = _shell(`<div class="st-empty">Veri şu an alınamadı. "↻ Yenile" ile tekrar deneyebilirsin.</div>`);
        return;
      }

      const rows = (pend.rows || [])
        .filter(r => r && r.sym)
        .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
        .slice(0, MAX_ROWS);

      if (!rows.length) {
        host.innerHTML = _shell(`<div class="st-empty">Şu an açık takip kaydı yok. Sistem yeni kayıt açtıkça burada en üstte belirir.</div>`);
      } else {
        const learnNote = insights.total
          ? `Öncelik = (genel setup uyumu + coinin kendi geçmişi) kanıt-ağırlıklı ortalaması · ${insights.total} doğrulanmış analizden.`
          : `Henüz yeterli doğrulanmış geçmiş yok — öncelikler veri biriktikçe netleşir.`;
        host.innerHTML = _shell(
          `<div class="st-sub">En yeni açılan ${rows.length} takip · 🥇 Altın · 🟠 Turuncu · ⬜ Gri (logo rengi = öncelik)</div>` +
          rows.map(r => _rowHTML(r, insights, coinStats)).join('') +
          `<div class="st-note">${_esc(learnNote)} ⚠ Geçmiş tutarlılığı gösterir; gelecek getiri garantisi değildir.</div>`
        );
      }
      const c = document.getElementById('st-count'); if (c) c.textContent = rows.length ? rows.length + ' açık' : '';

      host.querySelectorAll('.st-row').forEach(el => {
        el.addEventListener('click', () => {
          const s = el.getAttribute('data-sym');
          if (s && typeof window.openCoin === 'function') window.openCoin(s);
        });
      });
      const rb = document.getElementById('st-refresh');
      if (rb) rb.addEventListener('click', () => { try { window.VDInsights.load(true); } catch (e) {} render(); });
    } catch (e) {
      console.error(TAG, 'render hata:', e);
      try { host.innerHTML = _shell(`<div class="st-empty">Panel gösterilemedi (konsola bakın).</div>`); } catch (e2) {}
    } finally {
      _busy = false;
    }
  }

  function _boot() {
    render();
    [800, 2000, 4000].forEach(ms => setTimeout(() => { try { render(); } catch (e) {} }, ms));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  window.addEventListener('vd:archive:created', () => { try { render(); } catch (e) {} });
  window.addEventListener('vd:archive:reviewed', () => { try { window.VDInsights && window.VDInsights.load(true); render(); } catch (e) {} });
  setInterval(() => { try { render(); } catch (e) {} }, REFRESH_MS);

  window.VDSetupTracker = { render };
})();
