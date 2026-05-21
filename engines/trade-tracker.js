// ════════════════════════════════════════════════════════════════════
// TRADE TRACKER — Professional Futures Terminal
// Binance Futures + TradingView + Prop Firm hissi
// ════════════════════════════════════════════════════════════════════
const TradeTracker = (() => {

  const STORAGE_KEY = 'vd_active_trades_v2';
  let _trades = [];
  let _timer  = null;

  function _load() {
    try { _trades = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { _trades = []; }
  }
  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_trades)); } catch {}
  }

  // ── Trade Aç ─────────────────────────────────────────────────────
  function openTrade({ sym, dir, entry, lev, margin, sl, tp1, tp2, tp3 }) {
    const pos     = margin * lev;
    const qty     = pos / entry;
    const liqPct  = 1 / lev * 0.9;
    const liq     = dir === 'LONG' ? +(entry * (1 - liqPct)).toFixed(4) : +(entry * (1 + liqPct)).toFixed(4);

    const t = {
      id: Date.now(),
      sym: sym.replace('USDT','').replace('PERP',''),
      symFull: sym.includes('USDT') ? sym : sym+'USDT',
      dir, entry:+entry, lev:+lev, margin:+margin,
      pos, qty, liq,
      sl:  sl  ? +sl  : null,
      tp1: tp1 ? +tp1 : null,
      tp2: tp2 ? +tp2 : null,
      tp3: tp3 ? +tp3 : null,
      markPrice:  +entry,
      pnl: 0, roi: 0, marginRatio: 0,
      status: 'ACTIVE',
      tp1Hit: false, tp2Hit: false, tp3Hit: false,
      openTs: Date.now(),
    };

    _trades.unshift(t);
    _save();
    _showTerminal();
    _renderAll();
    _startUpdates();
    return t.id;
  }

  // ── Trade Kapat ───────────────────────────────────────────────────
  function closeTrade(id) {
    const t = _trades.find(t => t.id === id);
    if (!t) return;
    if (!confirm(`${t.sym} ${t.dir} işlemini kapatmak istiyor musunuz?\nGüncel PNL: ${t.pnl >= 0 ? '+' : ''}$${t.pnl?.toFixed(2)}`)) return;

    t.status  = 'CLOSED';
    t.closeTs = Date.now();
    _save();

    if (typeof LearningEngine !== 'undefined') {
      LearningEngine.closeSignal(id, {
        status: t.pnl >= 0 ? 'TP_HIT' : 'SL_HIT',
        pnl: t.roi,
        durationMin: Math.round((Date.now() - t.openTs) / 60000),
      });
    }

    _renderAll();
    const active = _trades.filter(t => t.status === 'ACTIVE');
    if (!active.length) _hideTerminal();
  }

  // ── Fiyat Güncelle ────────────────────────────────────────────────
  function updatePrice(sym, price) {
    const clean = sym.replace('USDT','').replace('PERP','').toUpperCase();
    let changed = false;

    _trades.forEach(t => {
      if (t.status !== 'ACTIVE') return;
      if (t.sym.toUpperCase() !== clean) return;

      t.markPrice = +price;
      const diff  = t.dir === 'LONG' ? (price - t.entry) / t.entry : (t.entry - price) / t.entry;
      t.pnl       = +(t.pos * diff).toFixed(2);
      t.roi       = +(diff * 100).toFixed(3);
      t.marginRatio = Math.abs(t.pnl / t.margin * 100).toFixed(1);

      // TP hit kontrolü
      if (t.tp1 && !t.tp1Hit) {
        if ((t.dir==='LONG' && price>=t.tp1) || (t.dir==='SHORT' && price<=t.tp1)) {
          t.tp1Hit = true;
          _notify(t, 'TP1', price);
        }
      }
      if (t.tp2 && !t.tp2Hit) {
        if ((t.dir==='LONG' && price>=t.tp2) || (t.dir==='SHORT' && price<=t.tp2)) {
          t.tp2Hit = true;
          _notify(t, 'TP2', price);
        }
      }

      changed = true;
    });

    if (changed) _renderAll();
  }

  function _notify(t, level, price) {
    if (typeof NC !== 'undefined') {
      NC.add({ sym: t.symFull, dir:'entry', level:'high',
        msg: `🎯 ${level} HIT! ${t.sym} ${t.dir} @ $${(+price).toFixed(2)} — PNL: ${t.pnl>=0?'+':''}$${t.pnl?.toFixed(2)}` });
    }
  }

  // ── Terminal göster/gizle ─────────────────────────────────────────
  function _showTerminal() {
    const w = document.getElementById('tradeTerminalWrap');
    if (w) { w.style.display = 'block'; w.scrollIntoView({behavior:'smooth', block:'nearest'}); }
  }
  function _hideTerminal() {
    const w = document.getElementById('tradeTerminalWrap');
    if (w) w.style.display = 'none';
  }

  // ── Progress hesapla ──────────────────────────────────────────────
  function _calcProgress(t) {
    const { dir, entry, sl, tp1, tp2, tp3, markPrice } = t;
    const target = tp3 || tp2 || tp1;
    const stop   = sl;

    // SL veya TP yoksa: entry merkez, fiyat hareketine göre göster
    if (!target || !stop) {
      const isLong  = dir === 'LONG';
      const diff    = markPrice - entry;
      const pctMove = entry > 0 ? (diff / entry) * 100 : 0;
      // -10% ile +10% arasını 0-100'e map et
      const pct     = Math.max(0, Math.min(100, 50 + pctMove * 5));
      const isProfit= isLong ? markPrice >= entry : markPrice <= entry;
      return {
        pct,
        entryPct: 50,
        color: isProfit ? 'var(--green)' : 'var(--red)',
        isProfit,
        tp1Pct: null, tp2Pct: null, tp3Pct: null,
      };
    }

    const totalRange = Math.abs(target - stop);
    if (totalRange === 0) return { pct: 50, entryPct: 50, color: 'var(--text3)', tp1Pct:null, tp2Pct:null, tp3Pct:null };

    const entryDist = dir === 'LONG' ? entry - stop : stop - entry;
    const curDist   = dir === 'LONG' ? markPrice - stop : stop - markPrice;

    const entryPct  = Math.max(0, Math.min(100, entryDist / totalRange * 100));
    const pct       = Math.max(0, Math.min(100, curDist / totalRange * 100));
    const isProfit  = pct >= entryPct;
    const color     = isProfit ? 'var(--green)' : 'var(--red)';

    const tp1Pct = tp1 ? Math.max(0,Math.min(100,(dir==='LONG'?tp1-stop:stop-tp1)/totalRange*100)) : null;
    const tp2Pct = tp2 ? Math.max(0,Math.min(100,(dir==='LONG'?tp2-stop:stop-tp2)/totalRange*100)) : null;
    const tp3Pct = tp3 ? Math.max(0,Math.min(100,(dir==='LONG'?tp3-stop:stop-tp3)/totalRange*100)) : null;

    return { pct, entryPct, color, isProfit, tp1Pct, tp2Pct, tp3Pct };
  }

  // ── Süre formatla ─────────────────────────────────────────────────
  function _duration(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return s + 's';
    if (s < 3600)  return Math.floor(s/60) + 'm ' + (s%60) + 's';
    return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
  }

  // ── Render ────────────────────────────────────────────────────────
  function _renderAll() {
    const container = document.getElementById('tradeTrackerList');
    if (!container) return;

    const active = _trades.filter(t => t.status === 'ACTIVE');
    const countEl = document.getElementById('ttActiveCount');
    if (countEl) { countEl.textContent = active.length + ' Aktif'; countEl.style.color = active.length ? 'var(--green)' : 'var(--text3)'; }

    if (!active.length) {
      container.innerHTML = `
        <div style="background:rgba(8,16,28,.8);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;text-align:center;color:var(--text3)">
          <div style="font-size:22px;margin-bottom:6px">📊</div>
          <div style="font-size:11px;font-weight:600;margin-bottom:4px">Aktif işlem yok</div>
          <div style="font-size:10px;opacity:.7">Sinyal kartındaki <b style="color:var(--cyan)">⚡ İşlem Aç</b> butonu ile veya yukarıdan ekle</div>
        </div>`;
      return;
    }

    container.innerHTML = active.map(t => _renderCard(t)).join('');
  }

  function _renderCard(t) {
    const isLong  = t.dir === 'LONG';
    const dirCol  = isLong ? '#00e5a0' : '#ff3d6b';
    const pnlCol  = t.pnl >= 0 ? '#00e5a0' : '#ff3d6b';
    const roiCol  = t.roi >= 0 ? '#00e5a0' : '#ff3d6b';
    const prog    = _calcProgress(t);
    const dur     = _duration(t.openTs);
    const fmt     = (v,d=2) => v !== null && v !== undefined ? (+v).toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
    const fmtP    = v => v !== null ? (v>=0?'+':'')+fmt(v,2)+'%' : '—';

    // SL mesafesi % kontrolü — uyarı
    const slDistPct = t.sl ? Math.abs(t.markPrice - t.sl) / t.entry * 100 : 999;
    const slWarn    = slDistPct < 0.5;
    const liqDistPct = Math.abs(t.markPrice - t.liq) / t.entry * 100;
    const liqWarn   = liqDistPct < 2;

    // Health status
    const health = liqWarn ? { label:'⚠ LİKİDASYON YAKLAŞIYOR', col:'#ff3d6b', bg:'rgba(255,61,107,.15)' } :
                   slWarn  ? { label:'⚠ SL BÖLGESI', col:'#ff7a00', bg:'rgba(255,122,0,.12)' } :
                   t.tp2Hit? { label:'🏆 TP2 HIT', col:'#00d4ff', bg:'rgba(0,212,255,.12)' } :
                   t.tp1Hit? { label:'🎯 TP1 HIT', col:'#00e5a0', bg:'rgba(0,229,160,.12)' } :
                             { label:'● AKTİF', col:'#00e5a0', bg:'rgba(0,229,160,.08)' };

    // Progress bar HTML
    const progressBar = _renderProgressBar(t, prog);

    // AI mini yorum
    const aiComment = t.roi > 2 ? '💡 Kâr bölgesinde — TP1\'e kilitlen' :
                      t.roi > 0 ? '📈 Pozitif yönde — momentum izle' :
                      t.roi > -1? '⚡ Giriş bölgesinde — bekle' :
                                  '⚠ Zarar bölgesi — stop seviyesini gözle';

    return `
<div style="
  background:rgba(5,10,20,.97);
  border:1px solid rgba(255,255,255,.09);
  border-top:2px solid ${dirCol};
  border-radius:0 0 14px 14px;
  margin-bottom:12px;
  overflow:hidden;
  ${slWarn||liqWarn?`animation:ttPulse .8s infinite;box-shadow:0 0 20px ${dirCol}33;`:''}
">

  <!-- ── TOP BAR ── -->
  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,0,0,.3);border-bottom:1px solid rgba(255,255,255,.06)">
    <div>
      <span style="font-size:14px;font-weight:900;color:#fff">${t.sym}USDT</span>
      <span style="font-size:9px;color:var(--text3);margin-left:4px">Perp · Cross · ${t.lev}x</span>
    </div>
    <div style="padding:3px 10px;background:${dirCol}20;border:1px solid ${dirCol}44;border-radius:20px;font-size:10px;font-weight:800;color:${dirCol}">
      ${isLong?'▲ LONG':'▼ SHORT'}
    </div>
    <div style="padding:3px 10px;background:${health.bg};border-radius:20px;font-size:9px;font-weight:700;color:${health.col}">
      ${health.label}
    </div>
    <div style="margin-left:auto;font-size:9px;color:var(--text3)">⏱ ${dur}</div>
    <button onclick="TradeTracker.closeTrade(${t.id})"
      style="padding:4px 12px;background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);border-radius:6px;color:#ff3d6b;font-size:10px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">
      Kapat ✕
    </button>
  </div>

  <!-- ── METRICS GRID ── -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.06)">

    <div style="padding:12px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:4px">PNL (USDT)</div>
      <div style="font-size:20px;font-weight:900;color:${pnlCol};font-family:'Courier New',monospace">${t.pnl>=0?'+':''}${fmt(t.pnl)}</div>
    </div>

    <div style="padding:12px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:4px">ROI</div>
      <div style="font-size:20px;font-weight:900;color:${roiCol};font-family:'Courier New',monospace">${fmtP(t.roi*t.lev)}</div>
    </div>

    <div style="padding:12px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:4px">MARGIN RATIO</div>
      <div style="font-size:20px;font-weight:900;color:${+t.marginRatio>80?'#ff3d6b':+t.marginRatio>50?'#ff7a00':'#aaa'};font-family:'Courier New',monospace">%${t.marginRatio}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">SIZE (USDT)</div>
      <div style="font-size:13px;font-weight:700;color:#ccc">${fmt(t.pos)}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">MARK PRICE</div>
      <div style="font-size:13px;font-weight:700;color:#fff">${fmt(t.markPrice,4)}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">MARGIN</div>
      <div style="font-size:13px;font-weight:700;color:#ccc">${fmt(t.margin)}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">ENTRY PRICE</div>
      <div style="font-size:13px;font-weight:700;color:#aaa">${fmt(t.entry,4)}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">MIKTAR</div>
      <div style="font-size:13px;font-weight:700;color:#aaa">${fmt(t.qty,4)} ${t.sym}</div>
    </div>

    <div style="padding:10px 14px;background:rgba(5,10,20,.97)">
      <div style="font-size:9px;color:#666;letter-spacing:1px;margin-bottom:3px">LIQ. PRICE</div>
      <div style="font-size:13px;font-weight:700;color:#ff7a00">${fmt(t.liq,4)}</div>
    </div>

  </div>

  <!-- ── TRADE PATH ── -->
  ${progressBar}

  <!-- ── AI YORUM ── -->
  <div style="padding:8px 14px;background:rgba(0,0,0,.2);border-top:1px solid rgba(255,255,255,.04);font-size:10px;color:#888">
    ${aiComment}
  </div>

</div>`;
  }

  // ── Progress Bar (Ana görsel) ─────────────────────────────────────
  function _renderProgressBar(t, prog) {
    const fmt4 = v => v ? (+v).toLocaleString('en',{maximumFractionDigits:4}) : '';
    const isLong = t.dir === 'LONG';

    // Seviyeleri topla
    const levels = [];
    if (t.sl)  levels.push({ label:'SL',    price:t.sl,  col:'#ff3d6b', pct:0,       hit:false });
    levels.push(             { label:'Entry', price:t.entry,col:'#aaa',  pct:prog.entryPct, hit:false, isEntry:true });
    if (t.tp1) levels.push({ label:'TP1',   price:t.tp1, col:'#00e5a0', pct:prog.tp1Pct, hit:t.tp1Hit });
    if (t.tp2) levels.push({ label:'TP2',   price:t.tp2, col:'#00d4ff', pct:prog.tp2Pct, hit:t.tp2Hit });
    if (t.tp3) levels.push({ label:'TP3',   price:t.tp3, col:'#b39dfa', pct:prog.tp3Pct, hit:false });

    const markers = levels.filter(l => l.pct !== null).map(l => `
      <div style="position:absolute;left:${l.pct}%;transform:translateX(-50%);z-index:3">
        <div style="width:${l.isEntry?3:2}px;height:${l.isEntry?20:16}px;background:${l.hit?l.col:l.col+'99'};
          border-radius:1px;margin:0 auto;${l.hit?`box-shadow:0 0 8px ${l.col};`:''}"></div>
        <div style="font-size:8px;color:${l.col};font-weight:700;text-align:center;white-space:nowrap;margin-top:2px;
          ${l.hit?`text-shadow:0 0 6px ${l.col};`:''}">
          ${l.label}
        </div>
        <div style="font-size:7px;color:#555;text-align:center;white-space:nowrap">$${fmt4(l.price)}</div>
      </div>`).join('');

    // Güncel fiyat noktası
    const dotHtml = `
      <div style="position:absolute;left:${prog.pct}%;transform:translateX(-50%);z-index:5;transition:left .5s ease">
        <div style="width:12px;height:12px;background:${prog.color};border-radius:50%;
          box-shadow:0 0 10px ${prog.color};border:2px solid rgba(0,0,0,.5);margin:0 auto;
          animation:ttDotPulse 1s infinite"></div>
        <div style="font-size:8px;color:${prog.color};font-weight:800;text-align:center;white-space:nowrap;margin-top:2px">
          $${fmt4(t.markPrice)}
        </div>
      </div>`;

    // İlerleme yüzdesi
    const progressToTp = t.tp1 && prog.tp1Pct
      ? Math.max(0,Math.min(100,(prog.pct - prog.entryPct)/(prog.tp1Pct - prog.entryPct)*100)).toFixed(0)
      : null;

    return `
    <div style="padding:16px 14px 8px;background:rgba(3,6,14,.95)">

      <!-- Fiyat seviyeleri üst etiketler -->
      <div style="display:flex;justify-content:space-between;font-size:8px;color:#444;margin-bottom:8px">
        ${t.sl  ? `<span style="color:#ff3d6b55">SL $${fmt4(t.sl)}</span>` : '<span></span>'}
        <span style="color:#aaa55">Entry $${fmt4(t.entry)}</span>
        ${t.tp1 ? `<span style="color:#00e5a055">TP1 $${fmt4(t.tp1)}</span>` : ''}
        ${t.tp2 ? `<span style="color:#00d4ff55">TP2 $${fmt4(t.tp2)}</span>` : ''}
        ${t.tp3 ? `<span style="color:#b39dfa55">TP3 $${fmt4(t.tp3)}</span>` : ''}
      </div>

      <!-- Ana progress track -->
      <div style="position:relative;height:8px;margin-bottom:32px">

        <!-- Arka plan track -->
        <div style="position:absolute;inset:0;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.06)">
          <!-- SL bölgesi kırmızı gradient -->
          <div style="position:absolute;left:0;top:0;bottom:0;width:${prog.entryPct}%;
            background:linear-gradient(90deg,rgba(255,61,107,.4),rgba(255,61,107,.1))"></div>
          <!-- Profit bölgesi yeşil gradient -->
          <div style="position:absolute;left:${prog.entryPct}%;top:0;bottom:0;right:0;
            background:linear-gradient(90deg,rgba(0,229,160,.1),rgba(0,229,160,.2))"></div>
        </div>

        <!-- Dolu kısım (güncel pozisyon) -->
        <div style="position:absolute;top:0;bottom:0;border-radius:4px;overflow:hidden;
          left:${Math.min(prog.pct,prog.entryPct)}%;
          width:${Math.abs(prog.pct-prog.entryPct)}%;
          background:${prog.color};
          transition:width .5s ease,left .5s ease;
          opacity:.8"></div>

        <!-- Marker'lar -->
        <div style="position:absolute;top:-6px;left:0;right:0;height:28px">
          ${markers}
        </div>

        <!-- Güncel fiyat dot -->
        <div style="position:absolute;top:-4px;left:0;right:0;height:24px">
          ${dotHtml}
        </div>
      </div>

      <!-- Alt bilgi -->
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="font-size:9px;color:#444">
          <span style="color:#ff3d6b66">■</span> SL Bölgesi &nbsp;
          <span style="color:#00e5a066">■</span> Kâr Bölgesi
        </div>
        ${progressToTp !== null ? `
          <div style="margin-left:auto;font-size:9px;font-weight:700;color:${prog.color}">
            TP1'e %${progressToTp} ilerlendi
          </div>` : ''}
      </div>

    </div>`;
  }

  // ── Modal: İşlem Aç ───────────────────────────────────────────────
  function showOpenModal(item = {}) {
    document.getElementById('ttModal')?.remove();

    const sym    = item.sym || window.SYM || 'BTCUSDT';
    const price  = item.price || 0;
    const dir    = item.dir  || 'LONG';
    const sl     = item.sl   || '';
    const tp1    = item.tp1  || '';
    const tp2    = item.tp2  || '';

    const modal = document.createElement('div');
    modal.id = 'ttModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px';
    modal.innerHTML = `
      <div style="background:rgba(5,10,20,.99);border:1px solid rgba(255,255,255,.1);border-top:2px solid #00e5a0;border-radius:14px;padding:20px;width:100%;max-width:420px;box-shadow:0 32px 80px rgba(0,0,0,.9)" id="ttModalInner">

        <!-- Başlık -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="font-size:15px;font-weight:900;color:#fff">${sym.replace('USDT','')}/USDT</span>
          <button onclick="document.getElementById('ttModal').remove()" style="margin-left:auto;background:none;border:none;color:#555;font-size:18px;cursor:pointer">✕</button>
        </div>

        <!-- Long / Short seçimi -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button id="tt_btn_long" onclick="TradeTracker._setDir('LONG')"
            style="padding:10px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;border:2px solid #00e5a0;background:rgba(0,229,160,.15);color:#00e5a0;letter-spacing:1px">
            ▲ LONG
          </button>
          <button id="tt_btn_short" onclick="TradeTracker._setDir('SHORT')"
            style="padding:10px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#555;letter-spacing:1px">
            ▼ SHORT
          </button>
        </div>

        <!-- Cross / Isolated seçimi -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button id="tt_btn_cross" onclick="TradeTracker._setMarginMode('CROSS')"
            style="padding:7px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;border:2px solid #00d4ff;background:rgba(0,212,255,.1);color:#00d4ff;letter-spacing:1px">
            CROSS
          </button>
          <button id="tt_btn_isolated" onclick="TradeTracker._setMarginMode('ISOLATED')"
            style="padding:7px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#555;letter-spacing:1px">
            ISOLATED
          </button>
        </div>

        <!-- Cross bakiye (sadece Cross modda görünür) -->
        <div id="tt_wallet_wrap" style="margin-bottom:10px">
          <div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:4px">TOPLAM BAKIYE ($) <span style="color:#00d4ff;font-size:8px">— Cross likidasyon için</span></div>
          <input id="tt_wallet" type="number" value="" placeholder="Örn: 1000" step="any" oninput="TradeTracker.calcModal()"
            style="width:100%;background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:9px 12px;color:#00d4ff;font-size:12px;font-family:'Courier New',monospace;box-sizing:border-box">
        </div>

        <!-- Form alanları -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          ${_input('tt_entry','GİRİŞ FİYATI',price,'#fff')}
          ${_input('tt_lev','KALDIРАÇ',10,'#fff','oninput="TradeTracker.calcModal()"')}
          ${_input('tt_margin','MARGİN ($)',100,'#00e5a0','oninput="TradeTracker.calcModal()"')}
          <div>
            <div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:4px">POZİSYON (OTOMATİK)</div>
            <div id="tt_pos" style="padding:9px 12px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:8px;color:#00d4ff;font-size:12px;font-weight:700">$1,000</div>
          </div>
          ${_input('tt_sl','STOP LOSS',sl,'#ff3d6b')}
          ${_input('tt_tp1','TAKE PROFIT 1',tp1,'#00e5a0')}
          ${_input('tt_tp2','TAKE PROFIT 2',tp2,'#00d4ff')}
          ${_input('tt_tp3','TAKE PROFIT 3','','#b39dfa')}
        </div>

        <div id="tt_liq_info" style="font-size:10px;color:#ff7a00;text-align:center;margin-bottom:14px;padding:7px;background:rgba(255,122,0,.06);border-radius:8px">
          Likidasyon hesaplanıyor...
        </div>

        <button id="tt_confirm_btn" onclick="TradeTracker.confirmOpen('${sym}', TradeTracker._currentDir(), TradeTracker._currentMarginMode())"
          style="width:100%;padding:13px;background:linear-gradient(90deg,rgba(0,229,160,.22),rgba(0,229,160,.11));border:1px solid rgba(0,229,160,.55);border-radius:10px;color:#00e5a0;font-size:13px;font-weight:800;cursor:pointer;font-family:Inter,sans-serif;letter-spacing:1px">
          ▲ LONG İŞLEMİ AÇ
        </button>
      </div>`;

    document.body.appendChild(modal);
    // Başlangıç yönünü ayarla
    _modalDir = dir;
    _modalMarginMode = 'CROSS';
    _updateModalUI();
    calcModal();
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  }

  // Modal yön state
  let _modalDir = 'LONG';
  let _modalMarginMode = 'CROSS';

  function _setDir(dir) {
    _modalDir = dir;
    _updateModalUI();
    calcModal();
  }

  function _setMarginMode(mode) {
    _modalMarginMode = mode;
    _updateModalUI();
    calcModal();
  }

  function _currentDir() { return _modalDir; }
  function _currentMarginMode() { return _modalMarginMode; }

  function _updateModalUI() {
    const isLong = _modalDir === 'LONG';
    const isCross = _modalMarginMode === 'CROSS';
    const dirCol = isLong ? '#00e5a0' : '#ff3d6b';

    const inner = document.getElementById('ttModalInner');
    if(inner) inner.style.borderTopColor = dirCol;

    const btnLong  = document.getElementById('tt_btn_long');
    const btnShort = document.getElementById('tt_btn_short');
    if(btnLong && btnShort){
      btnLong.style.border  = isLong  ? `2px solid #00e5a0` : '1px solid rgba(255,255,255,.1)';
      btnLong.style.background  = isLong  ? 'rgba(0,229,160,.15)'  : 'rgba(255,255,255,.03)';
      btnLong.style.color   = isLong  ? '#00e5a0' : '#555';
      btnShort.style.border = !isLong ? `2px solid #ff3d6b` : '1px solid rgba(255,255,255,.1)';
      btnShort.style.background = !isLong ? 'rgba(255,61,107,.15)' : 'rgba(255,255,255,.03)';
      btnShort.style.color  = !isLong ? '#ff3d6b' : '#555';
    }

    const btnCross    = document.getElementById('tt_btn_cross');
    const btnIsolated = document.getElementById('tt_btn_isolated');
    if(btnCross && btnIsolated){
      btnCross.style.border    = isCross  ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,.1)';
      btnCross.style.background= isCross  ? 'rgba(0,212,255,.1)' : 'rgba(255,255,255,.03)';
      btnCross.style.color     = isCross  ? '#00d4ff' : '#555';
      btnIsolated.style.border = !isCross ? '2px solid #f0a500' : '1px solid rgba(255,255,255,.1)';
      btnIsolated.style.background=!isCross?'rgba(240,165,0,.1)' : 'rgba(255,255,255,.03)';
      btnIsolated.style.color  = !isCross ? '#f0a500' : '#555';
    }

    // Cross modda bakiye göster
    const walletWrap = document.getElementById('tt_wallet_wrap');
    if(walletWrap) walletWrap.style.display = isCross ? 'block' : 'none';

    // Margin input rengi
    const marginEl = document.getElementById('tt_margin');
    if(marginEl) marginEl.style.color = dirCol;

    // Confirm butonu
    const btn = document.getElementById('tt_confirm_btn');
    if(btn){
      btn.textContent = `${isLong?'▲ LONG':'▼ SHORT'} İŞLEMİ AÇ`;
      btn.style.background = isLong ? 'linear-gradient(90deg,rgba(0,229,160,.22),rgba(0,229,160,.11))' : 'linear-gradient(90deg,rgba(255,61,107,.22),rgba(255,61,107,.11))';
      btn.style.borderColor = isLong ? 'rgba(0,229,160,.55)' : 'rgba(255,61,107,.55)';
      btn.style.color = dirCol;
    }
  }

  function _input(id, label, val, col, extra='') {
    return `<div>
      <div style="font-size:9px;color:#555;letter-spacing:1px;margin-bottom:4px">${label}</div>
      <input id="${id}" type="number" value="${val}" step="any" ${extra}
        style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 12px;color:${col};font-size:12px;font-family:'Courier New',monospace;box-sizing:border-box">
    </div>`;
  }

  function calcModal() {
    const entry  = +document.getElementById('tt_entry')?.value  || 0;
    const lev    = +document.getElementById('tt_lev')?.value    || 1;
    const margin = +document.getElementById('tt_margin')?.value || 0;
    const wallet = +document.getElementById('tt_wallet')?.value || 0;
    const posEl  = document.getElementById('tt_pos');
    const liqEl  = document.getElementById('tt_liq_info');
    const pos    = margin * lev;
    if (posEl) posEl.textContent = '$' + pos.toLocaleString('en',{maximumFractionDigits:2});
    if (entry && lev && liqEl) {
      const isCross = _modalMarginMode === 'CROSS';
      const isLong  = _modalDir === 'LONG';
      let liqLong, liqShort;
      if(isCross && wallet > 0){
        // Cross: likidasyon wallet bakiyesine göre
        const mmr = 0.004; // maintenance margin rate ~%0.4
        if(isLong){
          liqLong  = entry - (wallet - margin * mmr) / (pos / entry);
          liqShort = entry + (wallet - margin * mmr) / (pos / entry);
        } else {
          liqLong  = entry - (wallet - margin * mmr) / (pos / entry);
          liqShort = entry + (wallet - margin * mmr) / (pos / entry);
        }
        liqEl.innerHTML = `⚡ Cross Likidasyon: LONG ~$${Math.max(0,liqLong).toFixed(4)} &nbsp;·&nbsp; SHORT ~$${liqShort.toFixed(4)} <span style="color:#555">(Bakiye: $${wallet})</span>`;
      } else {
        // Isolated: klasik formül
        const d = 1/lev*0.9;
        liqEl.innerHTML = `⚡ Isolated Likidasyon: LONG ~$${(entry*(1-d)).toFixed(4)} &nbsp;·&nbsp; SHORT ~$${(entry*(1+d)).toFixed(4)}`;
      }
    }
  }

  function confirmOpen(sym, dir, marginMode) {
    dir = dir || _modalDir || 'LONG';
    marginMode = marginMode || _modalMarginMode || 'CROSS';
    const entry  = +document.getElementById('tt_entry')?.value;
    const lev    = +document.getElementById('tt_lev')?.value;
    const margin = +document.getElementById('tt_margin')?.value;
    const sl     = +document.getElementById('tt_sl')?.value   || null;
    const tp1    = +document.getElementById('tt_tp1')?.value  || null;
    const tp2    = +document.getElementById('tt_tp2')?.value  || null;
    const tp3    = +document.getElementById('tt_tp3')?.value  || null;
    if (!entry||!lev||!margin) { alert('Giriş fiyatı, kaldıraç ve margin zorunlu!'); return; }
    openTrade({sym, dir, entry, lev, margin, sl, tp1, tp2, tp3, marginMode});
    document.getElementById('ttModal')?.remove();
    setTimeout(()=>{ document.getElementById('tradeTrackerWrap')?.scrollIntoView({behavior:'smooth',block:'nearest'}); }, 300);
  }

  // ── Güncelleme döngüsü ────────────────────────────────────────────
  function _startUpdates() {
    if (_timer) return;
    _timer = setInterval(() => {
      const active = _trades.filter(t => t.status==='ACTIVE');
      if (!active.length) { clearInterval(_timer); _timer=null; return; }
      active.forEach(t => {
        try {
          if (typeof WSEngine !== 'undefined') {
            const d = WSEngine.getData(t.symFull);
            const p = d?.price || d?.lastPrice || d?.markPrice;
            if (p) updatePrice(t.symFull, p);
          }
        } catch {}
      });
    }, 1000);
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    _load();
    const active = _trades.filter(t=>t.status==='ACTIVE');
    if (active.length) { _showTerminal(); _renderAll(); _startUpdates(); }
  }

  return { openTrade, closeTrade, updatePrice, showOpenModal, calcModal, confirmOpen, init, _setDir, _setMarginMode, _currentDir, _currentMarginMode };

})();
