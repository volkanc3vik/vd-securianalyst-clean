// ════════════════════════════════════════════════════════════════════
// LEARNING ENGINE — Adaptif ağırlıklar, sonuç takibi
// ════════════════════════════════════════════════════════════════════
const LearningEngine = (() => {

  const STORAGE_KEY = 'vd_learning_v1';
  const SIG_KEY     = 'vd_signals_v1';

  // Varsayılan ağırlıklar
  const DEFAULT_WEIGHTS = {
    ema:          1.0,
    macd:         1.0,
    rsi:          1.0,
    volume:       1.0,
    funding:      1.0,
    oi:           1.0,
    lsRatio:      1.0,
    squeeze:      1.0,
    crowd:        1.0,
    liquidation:  1.0,
    smc:          1.0,
    regime:       1.0,
    orderflow:    1.0,
  };

  const BOUNDS = { min: 0.3, max: 2.5 };
  const LEARN_RATE = 0.08; // Her sonuçta %8 güncelle

  // ── Load/Save — localStorage + Supabase sync ────────────────────
  function _loadWeights() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { ...DEFAULT_WEIGHTS }; }
    catch { return { ...DEFAULT_WEIGHTS }; }
  }
  function _saveWeights(w) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)); } catch {}
    // Supabase'e async sync
    if (typeof SupabaseDB !== 'undefined') {
      SupabaseDB.saveWeights(w).catch(() => {});
    }
  }
  function _loadSignals() {
    try { return JSON.parse(localStorage.getItem(SIG_KEY) || '[]'); }
    catch { return []; }
  }
  function _saveSignals(s) {
    try { localStorage.setItem(SIG_KEY, JSON.stringify(s.slice(-300))); } catch {}
  }

  // Supabase'den ağırlıkları yükle (sayfa açılışında)
  async function syncFromSupabase() {
    if (typeof SupabaseDB === 'undefined') return;
    try {
      const w = await SupabaseDB.loadWeights();
      if (w && Object.keys(w).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
        console.log('✅ AI agirliklar Supabase\'den yuklendi');
      }
    } catch(e) {}
  }

  // ── Sinyal Kaydet ─────────────────────────────────────────────────
  function recordSignal({ sym, dir, entry, confidence, fund, oi, lsRatio,
                          liquidationPressure, squeezeRisk, crowdRisk,
                          regime, smcStructure, tp, sl }) {
    const signals = _loadSignals();
    const signal  = {
      id:        Date.now(),
      sym, dir, entry, confidence,
      fund:      fund ?? null,
      oi:        oi ?? null,
      lsRatio:   lsRatio ?? null,
      liquidationPressure: liquidationPressure ?? 0,
      squeezeRisk:         squeezeRisk ?? 0,
      crowdRisk:           crowdRisk ?? 0,
      regime:    regime || 'UNKNOWN',
      smcStructure: smcStructure || {},
      tp, sl,
      status:   'OPEN',    // OPEN | TP_HIT | SL_HIT | EXPIRED
      pnl:       null,
      duration:  null,
      openTs:    Date.now(),
      closeTs:   null,
    };
    signals.unshift(signal);
    _saveSignals(signals);

    // Supabase'e kaydet
    if (typeof SupabaseDB !== 'undefined') {
      SupabaseDB.saveSignal({
        sym:          signal.sym,
        direction:    signal.dir,
        entry:        signal.entry,
        confidence:   signal.confidence,
        funding:      signal.fund,
        oi:           signal.oi,
        lsRatio:      signal.lsRatio,
        squeezeRisk:  signal.squeezeRisk,
        crowdRisk:    signal.crowdRisk,
        liqPressure:  signal.liquidationPressure,
        regime:       signal.regime,
        smcStructure: signal.smcStructure,
        tp:           signal.tp,
        sl:           signal.sl,
      }).then(rows => {
        // Supabase ID'sini sakla
        if (rows && rows[0]) signal._supabaseId = rows[0].id;
      }).catch(() => {});
    }

    return signal.id;
  }

  // ── Sonuç Güncelle ────────────────────────────────────────────────
  function closeSignal(id, { status, pnl, closePrice }) {
    const signals = _loadSignals();
    const sig     = signals.find(s => s.id === id);
    if (!sig) return;

    sig.status   = status;  // TP_HIT | SL_HIT | EXPIRED
    sig.pnl      = pnl ?? null;
    sig.closeTs  = Date.now();
    sig.duration = Math.round((sig.closeTs - sig.openTs) / 60000); // dakika
    _saveSignals(signals);

    // Ağırlıkları güncelle
    _updateWeights(sig);
    return sig;
  }

  // ── Adaptif Ağırlık Güncelleme ────────────────────────────────────
  function _updateWeights(sig) {
    const weights = _loadWeights();
    const success = sig.status === 'TP_HIT';
    const fake    = sig.smcStructure?.fakeBreak === true;
    const dir     = success ? 1 : -1;

    // Başarılı sinyal → kullanılan indikatörlerin ağırlığını artır
    // Başarısız sinyal → azalt
    const updates = {};

    // Squeeze başarısıysa squeeze ağırlığını artır
    if (sig.squeezeRisk > 50) updates.squeeze = dir * LEARN_RATE * 1.5;

    // Crowd riski doğru tahmin ettiyse artır
    if (sig.crowdRisk > 50) updates.crowd = dir * LEARN_RATE;

    // Likidasyon baskısı yüksekse
    if (sig.liquidationPressure > 60) updates.liquidation = dir * LEARN_RATE;

    // Funding doğru yöndeydiyse
    if (sig.fund !== null) {
      const fundCorrect = (sig.dir==='LONG' && sig.fund<0) || (sig.dir==='SHORT' && sig.fund>0);
      updates.funding = fundCorrect ? LEARN_RATE * (success?1:-0.5) : -LEARN_RATE * 0.5;
    }

    // Fake breakout öğrenme — negatif
    if (fake && !success) {
      updates.smc = -LEARN_RATE * 1.5;
    }

    // Regime doğru tahminse
    updates.regime = dir * LEARN_RATE * 0.5;

    // Ağırlıkları uygula ve sınırlar içinde tut
    Object.entries(updates).forEach(([k, delta]) => {
      if (weights[k] !== undefined) {
        weights[k] = Math.max(BOUNDS.min, Math.min(BOUNDS.max, weights[k] + delta));
      }
    });

    _saveWeights(weights);
    return weights;
  }

  // ── Mevcut Ağırlıkları Al ─────────────────────────────────────────
  function getWeights() { return _loadWeights(); }

  // ── İstatistikler ─────────────────────────────────────────────────
  function getStats() {
    const signals = _loadSignals();
    const closed  = signals.filter(s => s.status !== 'OPEN');
    if (!closed.length) return null;

    const wins    = closed.filter(s => s.status === 'TP_HIT').length;
    const wr      = (wins / closed.length * 100).toFixed(1);
    const avgPnl  = (closed.filter(s=>s.pnl!==null).reduce((a,s)=>a+s.pnl,0) / closed.length).toFixed(2);

    // Regime bazlı winrate
    const byRegime = {};
    closed.forEach(s => {
      if (!byRegime[s.regime]) byRegime[s.regime] = { wins:0, total:0 };
      byRegime[s.regime].total++;
      if (s.status === 'TP_HIT') byRegime[s.regime].wins++;
    });

    // Squeeze başarı oranı
    const squeezeSigs = closed.filter(s => s.squeezeRisk > 50);
    const squeezeWR   = squeezeSigs.length
      ? (squeezeSigs.filter(s=>s.status==='TP_HIT').length / squeezeSigs.length * 100).toFixed(1)
      : null;

    return {
      total: closed.length, wins, wr, avgPnl, byRegime, squeezeWR,
      openCount: signals.filter(s=>s.status==='OPEN').length,
    };
  }

  // ── Ağırlık Sıfırla ───────────────────────────────────────────────
  function resetWeights() {
    _saveWeights({ ...DEFAULT_WEIGHTS });
    return { ...DEFAULT_WEIGHTS };
  }

  // ── UI Render ─────────────────────────────────────────────────────
  function renderUI(panelId='learningPanel') {
    const el = document.getElementById(panelId);
    if (!el) return;

    const weights = _loadWeights();
    const stats   = getStats();

    const weightRows = Object.entries(weights).map(([k,v]) => {
      const pct = ((v - BOUNDS.min) / (BOUNDS.max - BOUNDS.min) * 100).toFixed(0);
      const col = v >= 1.3 ? 'var(--green)' : v <= 0.7 ? 'var(--red)' : 'var(--yellow)';
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
          <span style="font-size:9px;color:var(--text3);min-width:80px;text-transform:uppercase">${k}</span>
          <div style="flex:1;height:5px;background:rgba(0,0,0,.3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:3px"></div>
          </div>
          <span style="font-size:10px;font-weight:700;color:${col};min-width:35px;text-align:right">${v.toFixed(2)}x</span>
        </div>`;
    }).join('');

    const statsHtml = stats ? `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
        <div style="background:rgba(0,0,0,.25);border-radius:7px;padding:6px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">TOPLAM</div>
          <div style="font-size:16px;font-weight:800;color:var(--cyan)">${stats.total}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:7px;padding:6px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">WINRATE</div>
          <div style="font-size:16px;font-weight:800;color:${+stats.wr>=55?'var(--green)':'var(--red)'}">%${stats.wr}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:7px;padding:6px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">ORT. PNL</div>
          <div style="font-size:16px;font-weight:800;color:${+stats.avgPnl>=0?'var(--green)':'var(--red)'}">%${stats.avgPnl}</div>
        </div>
      </div>` : '<div style="font-size:10px;color:var(--text3);margin-bottom:10px">Henüz kapanan sinyal yok</div>';

    el.innerHTML = `
      ${statsHtml}
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3);text-transform:uppercase;margin-bottom:8px">◈ ADAPTİF AĞIRLIKLAR</div>
      <div style="background:rgba(0,0,0,.2);border-radius:8px;padding:8px;margin-bottom:10px">${weightRows}</div>
      <button onclick="LearningEngine.resetWeights();LearningEngine.renderUI('learningPanel')"
        style="width:100%;padding:6px;background:rgba(255,61,107,.08);border:1px solid rgba(255,61,107,.25);border-radius:8px;color:var(--red);font-size:10px;cursor:pointer">
        ↺ Ağırlıkları Sıfırla
      </button>`;
  }

  return { recordSignal, closeSignal, getWeights, getStats, resetWeights, renderUI, syncFromSupabase };
})();
