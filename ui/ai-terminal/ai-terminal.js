// ════════════════════════════════════════════════════════════════════
// AI TERMINAL — 4. iş · Gerçek Anthropic soru-cevap (BETA)
//
// Mimari:
//   - Backend: /api/ai-state action:'ai_chat' (Anthropic key SUNUCUDA,
//     admin-key guard + 10/dk rate limit). Yeni serverless fonksiyon YOK.
//   - Erişim: şimdilik YÖNETİCİ önizlemesi (TelegramDispatcher.hasAdminKey).
//     Admin değilse panel görünür ama giriş kilitli (dürüst not ile).
//   - Bağlam: Pulse + TIState + LiveFeed seans verisi her soruda derlenip
//     gönderilir → yanıtlar canlı piyasaya dayanır.
//   - Sağ kolon: AI ÖNERİLEN İÇGÖRÜLER — pulse/TI'den türetilir (API maliyeti yok).
//   - Güvenli dil sunucu system prompt'unda zorlanır.
//
// Public API: window.VDAITerminal.mount() / .unmount()
// ════════════════════════════════════════════════════════════════════
window.VDAITerminal = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  const PANEL_ID = 'vdAiTerminal';
  let _mounted = false;
  let _busy    = false;
  let _msgs    = [];      // { role:'user'|'ai'|'err', text }
  let _insTimer = null;

  function _isAdmin() {
    try { return !!(window.TelegramDispatcher && window.TelegramDispatcher.hasAdminKey && window.TelegramDispatcher.hasAdminKey()); }
    catch (e) { return false; }
  }
  function _lang() {
    try { return /^\/en(\/|$)/i.test(window.location.pathname) ? 'en' : 'tr'; } catch (e) { return 'tr'; }
  }

  // ── Canlı bağlam derleme (her soruda taze) ─────────────────────────
  function _buildContext() {
    const L = [];
    try {
      const sym = window.SYM || 'BTCUSDT';
      L.push('Aktif sembol: ' + sym);
      const MP = window.VDMarketPulse;
      const p = (MP && MP.getState) ? MP.getState() : {};
      if (p.flow) L.push('Taker Flow: ' + p.flow.f);
      if (p.oi)   L.push('Open Interest: ' + p.oi.f);
      if (p.fund) L.push('Funding: ' + p.fund.f + (p.fund.rate != null ? ' (' + p.fund.rate + '%)' : ''));
      if (p.liq)  L.push('Likidasyon riski: ' + p.liq.f);
      if (p.liq24h && p.liq24h.total24h > 0) {
        const M = function (v) { return v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1e3).toFixed(0)+'K'; };
        L.push('Likidasyon 24s: $' + M(p.liq24h.total24h) + ' (Long $' + M(p.liq24h.long24h||0) + ' / Short $' + M(p.liq24h.short24h||0) + ')');
      }
      if (p.smart && p.smart.topLong != null)
        L.push('Pozisyonlanma: top trader long %' + p.smart.topLong + ' vs retail long %' + p.smart.retailLong + (p.smart.divergence ? ' (AYRIŞMA)' : ''));
      if (p.taker && p.taker.buyPct != null)
        L.push('Borsa-geneli taker buy: %' + p.taker.buyPct);
      try {
        const ob = (window.VDObPressure && window.VDObPressure.get) ? window.VDObPressure.get() : null;
        if (ob && ob.bidPct != null)
          L.push('Order book ±%' + ob.range + ': bid %' + ob.bidPct + ' / ask %' + ob.askPct + ' (pasif derinlik, 3 borsa)');
      } catch (e) {}
      const ti = (window.TIState && window.TIState.get) ? window.TIState.get() : {};
      if (ti.regime && ti.regime.code) L.push('Piyasa rejimi: ' + ti.regime.code + (ti.regime.label ? ' (' + ti.regime.label + ')' : ''));
      if (ti.mmBias && ti.mmBias.headline) L.push('MM yönelimi: ' + ti.mmBias.headline);
      const sess = (window.VDLiveFeed && window.VDLiveFeed.sessionStats) ? window.VDLiveFeed.sessionStats() : null;
      if (sess) L.push('Canlı (spot): son $' + sess.last + ' · seans H $' + sess.high + ' / L $' + sess.low);
    } catch (e) {}
    return L.join('\n');
  }

  // ── Soru gönder ────────────────────────────────────────────────────
  async function _ask(question) {
    if (_busy) return;
    question = String(question || '').trim();
    if (question.length < 3) return;
    if (!_isAdmin()) return;

    _busy = true;
    _msgs.push({ role: 'user', text: question });
    _renderChat();
    _setBusy(true);

    try {
      const r = await window.TelegramDispatcher.adminFetch('/api/ai-state', {
        action: 'ai_chat',
        question: question,
        context: _buildContext(),
        lang: _lang(),
      });
      if (r && r.ok && r.text) {
        _msgs.push({ role: 'ai', text: r.text });
      } else {
        const err = (r && r.error) || 'unknown';
        const msg = err === 'ai_not_configured'
          ? _t('at.errNoKey', null, 'Sunucuda ANTHROPIC_API_KEY tanımlı değil — Vercel env\'e ekleyin.')
          : err === 'chat_rate_limited'
          ? _t('at.errRate', null, 'Çok hızlı — bir dakika içinde en çok 10 soru.')
          : _t('at.errGeneric', null, 'Yanıt alınamadı: ') + err;
        _msgs.push({ role: 'err', text: msg });
      }
    } catch (e) {
      _msgs.push({ role: 'err', text: _t('at.errNet', null, 'Bağlantı hatası — tekrar deneyin.') });
    }
    if (_msgs.length > 24) _msgs = _msgs.slice(-24);
    _busy = false;
    _setBusy(false);
    _renderChat();
  }

  // ── İçgörüler (API maliyetsiz, pulse/TI'den) ───────────────────────
  function _insights() {
    const out = [];
    try {
      const MP = window.VDMarketPulse;
      const p = (MP && MP.getState) ? MP.getState() : {};
      if (p.flow && p.flow.code === 'BUY')  out.push({ ic: '↗', cls: 'up', tx: _t('at.iFlowBuy', null, 'Alıcı baskısı sürüyor — taker akışı pozitif') });
      if (p.flow && p.flow.code === 'SELL') out.push({ ic: '↘', cls: 'dn', tx: _t('at.iFlowSell', null, 'Satıcı baskısı belirgin — taker akışı negatif') });
      if (p.oi && p.oi.code === 'EXP')      out.push({ ic: '↗', cls: 'up', tx: _t('at.iOiExp', null, 'OI artışı fiyatla destekleniyor — yeni pozisyon girişi') });
      if (p.oi && p.oi.code === 'COOL')     out.push({ ic: '○', cls: 'mid', tx: _t('at.iOiCool', null, 'OI soğuyor — pozisyon kapanışları izleniyor') });
      if (p.fund && p.fund.code === 'NEUTRAL') out.push({ ic: '◎', cls: 'mid', tx: _t('at.iFundNeutral', null, 'Funding dengeli — büyüme için alan var') });
      if (p.fund && p.fund.code !== 'NEUTRAL' && p.fund.code) out.push({ ic: '⚠', cls: 'dn', tx: _t('at.iFundCrowd', null, 'Funding kalabalık — sıkışma riskine dikkat') });
      if (p.liq && p.liq.code === 'LOW')    out.push({ ic: '✓', cls: 'up', tx: _t('at.iLiqLow', null, 'Likidasyon baskısı düşük — yapı sakin') });
      if (p.liq && p.liq.code === 'HIGH')   out.push({ ic: '⚠', cls: 'dn', tx: _t('at.iLiqHigh', null, 'Likidasyon riski yüksek — ani hareket olasılığı') });
      const sess = (window.VDLiveFeed && window.VDLiveFeed.sessionStats) ? window.VDLiveFeed.sessionStats() : null;
      if (sess && sess.high) {
        const hp = sess.high.toLocaleString('en-US', { maximumFractionDigits: 1 });
        out.push({ ic: '◉', cls: 'mid', tx: _t('at.iLevel', { p: hp }, '$' + hp + ' seans yükseği — takip edilmeli') });
      }
    } catch (e) {}
    return out.slice(0, 5);
  }

  function _renderInsights() {
    const el = document.getElementById('vdAtIns');
    if (!el) return;
    const rows = _insights();
    el.innerHTML = rows.length
      ? rows.map(r => '<div class="vd-at-ins-row"><span class="vd-at-ins-ic ' + r.cls + '">' + r.ic + '</span><span>' + _esc(r.tx) + '</span></div>').join('')
      : '<div class="vd-at-ins-na">' + _t('at.insWaiting', null, 'İçgörüler veri toplandıkça oluşur…') + '</div>';
  }

  // ── Chat render ────────────────────────────────────────────────────
  function _renderChat() {
    const box = document.getElementById('vdAtChat');
    if (!box) return;
    if (!_msgs.length) {
      box.innerHTML = '<div class="vd-at-hello">' + _t('at.hello', null, 'Soru sor veya soldaki hızlı komutlardan birini seç. Yanıtlar canlı piyasa bağlamıyla üretilir.') + '</div>';
      return;
    }
    box.innerHTML = _msgs.map(m => {
      if (m.role === 'user') return '<div class="vd-at-msg user"><span class="vd-at-who">›</span>' + _esc(m.text) + '</div>';
      if (m.role === 'err')  return '<div class="vd-at-msg err">⚠ ' + _esc(m.text) + '</div>';
      return '<div class="vd-at-msg ai"><span class="vd-at-who">◈</span><div class="vd-at-ai-tx">' + _esc(m.text).replace(/\n/g, '<br>') + '</div></div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function _setBusy(b) {
    const btn = document.getElementById('vdAtSend');
    const inp = document.getElementById('vdAtInput');
    if (btn) { btn.disabled = b; btn.textContent = b ? '…' : '➤'; }
    if (inp) inp.disabled = b || !_isAdmin();
  }

  // ── Panel HTML ─────────────────────────────────────────────────────
  function _quickPrompts() {
    return [
      _t('at.q1', null, 'BTC piyasa analizi yap'),
      _t('at.q2', null, 'Hangi göstergeler öne çıkıyor?'),
      _t('at.q3', null, 'Likidasyon riskini yorumla'),
      _t('at.q4', null, 'Funding oranı ne anlatıyor?'),
      _t('at.q5', null, 'Mevcut rejim ne ifade ediyor?'),
    ];
  }

  function _html() {
    const admin = _isAdmin();
    const sym = window.SYM || 'BTCUSDT';
    return '<div class="vd-at-hdr">' +
        '<div class="vd-at-hdr-l">' +
          '<span class="vd-at-title">◈ ' + _t('at.title', null, 'AI TERMINAL') + '</span>' +
          '<span class="vd-at-beta">BETA</span>' +
        '</div>' +
        '<button class="vd-at-quick-main" id="vdAtMainBtn"' + (admin ? '' : ' disabled') + '>' +
          _t('at.mainBtn', { sym: sym }, 'Mevcut ' + sym + ' piyasa durumunu analiz et') + '</button>' +
      '</div>' +
      '<div class="vd-at-sub">' + _t('at.sub', null, 'Piyasalar hakkında soru sor, analiz iste…') + '</div>' +
      (admin ? '' :
        '<div class="vd-at-lock">🔒 ' + _t('at.locked', null, 'AI Terminal şu an yönetici önizlemesinde — yakında Elite üyelere açılacak.') + '</div>') +
      '<div class="vd-at-grid">' +
        '<div class="vd-at-prompts">' +
          _quickPrompts().map(q => '<button class="vd-at-qp" data-q="' + _esc(q) + '"' + (admin ? '' : ' disabled') + '>' + _esc(q) + '</button>').join('') +
        '</div>' +
        '<div class="vd-at-mid">' +
          '<div class="vd-at-chat" id="vdAtChat"></div>' +
          '<div class="vd-at-inputrow">' +
            '<input type="text" id="vdAtInput" class="vd-at-input" maxlength="600" placeholder="' +
              _t('at.placeholder', null, 'Sorunu yaz ve AI analiz etsin…') + '"' + (admin ? '' : ' disabled') + '>' +
            '<button class="vd-at-send" id="vdAtSend"' + (admin ? '' : ' disabled') + '>➤</button>' +
          '</div>' +
        '</div>' +
        '<div class="vd-at-right">' +
          '<div class="vd-at-ins-t">' + _t('at.insTitle', null, 'AI ÖNERİLEN İÇGÖRÜLER') + '</div>' +
          '<div class="vd-at-ins-s">' + _t('at.insSub', null, 'Mevcut piyasa verilerine göre') + '</div>' +
          '<div id="vdAtIns"></div>' +
        '</div>' +
      '</div>' +
      '<div class="vd-at-micro">' + _t('at.micro', null, 'AI çıktıları algoritmik gözlemdir · yatırım tavsiyesi değildir.') + '</div>';
  }

  function _bind(el) {
    el.querySelectorAll('.vd-at-qp').forEach(function (b) {
      b.addEventListener('click', function () { _ask(b.getAttribute('data-q')); });
    });
    const main = el.querySelector('#vdAtMainBtn');
    if (main) main.addEventListener('click', function () {
      _ask(_t('at.mainQ', { sym: window.SYM || 'BTCUSDT' }, 'Mevcut ' + (window.SYM || 'BTCUSDT') + ' piyasa durumunu analiz et'));
    });
    const send = el.querySelector('#vdAtSend');
    const inp  = el.querySelector('#vdAtInput');
    function go() { if (inp && inp.value.trim()) { const q = inp.value.trim(); inp.value = ''; _ask(q); } }
    if (send) send.addEventListener('click', go);
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function _ensure() {
    if (document.getElementById(PANEL_ID)) return true;
    const after = document.getElementById('vdMarketSummary') || document.getElementById('vdMarketPulse');
    const anchor = after || document.getElementById('tiPanelMount');
    if (!anchor || !anchor.parentNode) return false;
    const el = document.createElement('section');
    el.id = PANEL_ID;
    el.className = 'vd-at';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'AI Terminal');
    el.innerHTML = _html();
    if (after) after.parentNode.insertBefore(el, after.nextSibling);
    else anchor.parentNode.insertBefore(el, anchor);
    _bind(el);
    return true;
  }

  function mount() {
    if (_mounted) return;
    if (!_ensure()) return;
    _mounted = true;
    _renderChat();
    _renderInsights();
    _insTimer = setInterval(_renderInsights, 20000);
    try { console.log('[AITerminal] mount ✓ (admin: ' + _isAdmin() + ')'); } catch (e) {}
  }

  function unmount() {
    _mounted = false;
    if (_insTimer) clearInterval(_insTimer);
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }

  return { mount, unmount };
})();
