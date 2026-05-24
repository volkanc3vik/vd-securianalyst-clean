// ═══════════════════════════════════════════════
// AI ENGINE — Ağırlıklı konfirmasyon + karar motoru
// ═══════════════════════════════════════════════
import { CONFIRMATION_WEIGHTS, SETUP_GRADES } from '../modules/constants.js';
import { clamp, getCurrentSession } from '../modules/helpers.js';

class AIEngine {

  // ── Ağırlıklı Konfirmasyon Sistemi ───────────
  evaluate({ closes, candles, ind, entry, oiData, btcData, wsData, regimeMode, smcData, fakeBreak, sym }) {
    if (!entry || !ind) return null;

    const isLong = entry.dir === 'LONG';
    const price  = closes[closes.length - 1];

    // Hacim hesapla
    const vols = candles.slice(-10).map(c => c.v);
    const avgV = vols.slice(0, -1).reduce((a, b) => a + b, 0) / 9;
    const volR = candles[candles.length - 1].v / avgV;

    // Her koşulu değerlendir
    const results = this._evalConditions({ isLong, ind, volR, oiData, btcData, wsData, entry, smcData, fakeBreak, regimeMode, price });

    // Toplam skor
    const maxScore   = Object.values(CONFIRMATION_WEIGHTS).reduce((a, b) => a + b, 0);
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const pct        = clamp(Math.round(totalScore / maxScore * 100), 0, 100);

    const confirmed = results.filter(r => r.status === 'confirmed').length;
    const pending   = results.filter(r => r.status === 'pending').length;
    const failed    = results.filter(r => r.status === 'failed').length;
    const critFailed = results.filter(r => r.critical && r.status === 'failed');

    const grade = this._grade(pct, confirmed, critFailed.length > 0);
    const aiSummary = this._buildSummary(entry.dir, grade, confirmed, results.length, pct, results, sym);

    return { conditions: results, score: pct, confirmed, pending, failed, grade, aiSummary, critFailed };
  }

  _evalConditions({ isLong, ind, volR, oiData, btcData, wsData, entry, smcData, fakeBreak, regimeMode }) {
    const checks = [
      {
        id: 'ema_full', weight: CONFIRMATION_WEIGHTS.ema_full, label: 'EMA Hizalama', critical: false,
        eval: () => {
          if (isLong) {
            if (ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50) return { status: 'confirmed', score: 12, detail: '9>21>50 ✓' };
            if (ind.ema9 > ind.ema21) return { status: 'pending', score: 6, detail: '9>21, 50 bekleniyor' };
            return { status: 'failed', score: 0, detail: 'EMA negatif' };
          } else {
            if (ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50) return { status: 'confirmed', score: 12, detail: '9<21<50 ✓' };
            if (ind.ema9 < ind.ema21) return { status: 'pending', score: 6, detail: '9<21, 50 bekleniyor' };
            return { status: 'failed', score: 0, detail: 'EMA yükseliş hizası' };
          }
        },
      },
      {
        id: 'macd', weight: CONFIRMATION_WEIGHTS.macd, label: 'MACD', critical: false,
        eval: () => {
          const ok = isLong ? ind.macd.hist > 0 : ind.macd.hist < 0;
          return ok
            ? { status: 'confirmed', score: 10, detail: `Hist: ${ind.macd.hist > 0 ? '+' : ''}${ind.macd.hist.toFixed(4)}` }
            : { status: 'failed',    score: 0,  detail: `Hist: ${ind.macd.hist.toFixed(4)}` };
        },
      },
      {
        id: 'rsi', weight: CONFIRMATION_WEIGHTS.rsi, label: 'RSI Bölge', critical: false,
        eval: () => {
          const r = ind.rsi;
          if (isLong) {
            if (r >= 45 && r <= 65) return { status: 'confirmed', score: 8,  detail: `RSI: ${r.toFixed(1)} ✓` };
            if (r > 72)             return { status: 'failed',    score: 0,  detail: `RSI: ${r.toFixed(1)} aşırı alım` };
            return                         { status: 'pending',   score: 4,  detail: `RSI: ${r.toFixed(1)}` };
          } else {
            if (r >= 32 && r <= 55) return { status: 'confirmed', score: 8,  detail: `RSI: ${r.toFixed(1)} ✓` };
            if (r < 28)             return { status: 'failed',    score: 0,  detail: `RSI: ${r.toFixed(1)} aşırı satım` };
            return                         { status: 'pending',   score: 4,  detail: `RSI: ${r.toFixed(1)}` };
          }
        },
      },
      {
        id: 'volume', weight: CONFIRMATION_WEIGHTS.volume, label: 'Hacim Onayı', critical: false,
        eval: () => {
          if (volR >= 1.5) return { status: 'confirmed', score: 10, detail: `${volR.toFixed(1)}x ort.` };
          if (volR >= 1.2) return { status: 'pending',   score: 6,  detail: `${volR.toFixed(1)}x artıyor` };
          return                  { status: 'failed',    score: 0,  detail: `${volR.toFixed(1)}x yetersiz` };
        },
      },
      {
        id: 'rr', weight: CONFIRMATION_WEIGHTS.rr, label: 'R/R Oranı', critical: true,
        eval: () => {
          const rr = entry?.rr || 0;
          if (rr >= 2.5) return { status: 'confirmed', score: 10, detail: `1:${rr} ✓` };
          if (rr >= 2.0) return { status: 'confirmed', score: 8,  detail: `1:${rr}` };
          if (rr >= 1.5) return { status: 'pending',   score: 5,  detail: `1:${rr} düşük` };
          return                { status: 'failed',    score: 0,  detail: `1:${rr} yetersiz` };
        },
      },
      {
        id: 'no_fake', weight: CONFIRMATION_WEIGHTS.no_fake, label: 'Fake Breakout Yok', critical: true,
        eval: () => fakeBreak
          ? { status: 'failed',    score: 0,  detail: 'Fake breakout tespit edildi' }
          : { status: 'confirmed', score: 10, detail: 'Fake breakout riski yok' },
      },
      {
        id: 'smc', weight: CONFIRMATION_WEIGHTS.smc, label: 'SMC Yapı', critical: false,
        eval: () => {
          if (!smcData) return { status: 'pending', score: 4, detail: 'SMC analizi bekleniyor' };
          const pts = (smcData.sweeps?.length ? 1 : 0) + (smcData.ob ? 1 : 0) + (smcData.choch ? 1 : 0);
          if (pts >= 2) return { status: 'confirmed', score: 8, detail: `${pts} SMC sinyali` };
          if (pts >= 1) return { status: 'pending',   score: 5, detail: `${pts} SMC sinyali` };
          return              { status: 'failed',    score: 0, detail: 'SMC yapı yok' };
        },
      },
      {
        id: 'regime', weight: CONFIRMATION_WEIGHTS.regime, label: 'Market Rejimi', critical: false,
        eval: () => {
          if (regimeMode === 'TREND')                         return { status: 'confirmed', score: 8, detail: 'Trend modu ✓' };
          if (regimeMode === 'PANIC' && isLong)               return { status: 'failed',    score: 0, detail: 'Panik modu' };
          if (regimeMode === 'VOLATILE')                      return { status: 'pending',   score: 3, detail: 'Volatil market' };
          return                                                     { status: 'pending',   score: 5, detail: regimeMode || '—' };
        },
      },
      {
        id: 'btc', weight: CONFIRMATION_WEIGHTS.btc, label: 'BTC Korelasyon', critical: false,
        eval: () => {
          if (!btcData) return { status: 'pending', score: 4, detail: 'BTC verisi bekleniyor' };
          const chg = btcData.chg || 0;
          if ((isLong && chg > 0.5) || (!isLong && chg < -0.5))
            return { status: 'confirmed', score: 8, detail: `BTC ${chg > 0 ? '+' : ''}${chg.toFixed(2)}%` };
          if (Math.abs(chg) < 0.5)
            return { status: 'pending',   score: 4, detail: `BTC nötr` };
          return { status: 'failed', score: 0, detail: `BTC ters yön` };
        },
      },
      {
        id: 'ob_imbalance', weight: CONFIRMATION_WEIGHTS.ob_imbalance, label: 'Order Book', critical: false,
        eval: () => {
          if (!wsData?.obImbalance) return { status: 'pending', score: 4, detail: 'WS bekleniyor' };
          const obi = wsData.obImbalance;
          if ((isLong && obi > 0.6) || (!isLong && obi < 0.4))
            return { status: 'confirmed', score: 8, detail: `${isLong ? 'Alım' : 'Satış'} baskısı %${(obi * 100).toFixed(0)}` };
          return { status: 'pending', score: 4, detail: `OB dengeli` };
        },
      },
      {
        id: 'funding', weight: CONFIRMATION_WEIGHTS.funding, label: 'Funding Sağlıklı', critical: false,
        eval: () => {
          if (!oiData?.fund && oiData?.fund !== 0) return { status: 'pending', score: 4, detail: 'Funding bekleniyor' };
          const f = oiData.fund;
          if ((isLong && f > 0.08) || (!isLong && f < -0.08))
            return { status: 'failed',    score: 0, detail: `Funding aşırı: %${f.toFixed(3)}` };
          if (Math.abs(f) < 0.05)
            return { status: 'confirmed', score: 8, detail: `Funding: %${f.toFixed(3)} ✓` };
          return { status: 'pending', score: 5, detail: `Funding: %${f.toFixed(3)}` };
        },
      },
    ];

    return checks.map(c => {
      const result = c.eval();
      return { ...c, ...result, eval: undefined };
    });
  }

  _grade(pct, confirmed, hasCritFailed) {
    if (hasCritFailed) return SETUP_GRADES.D;
    if (pct >= 85 && confirmed >= 8) return SETUP_GRADES.S;
    if (pct >= 72 && confirmed >= 7) return SETUP_GRADES.A;
    if (pct >= 58 && confirmed >= 5) return SETUP_GRADES.B;
    if (pct >= 42 && confirmed >= 4) return SETUP_GRADES.C;
    return SETUP_GRADES.D;
  }

  _buildSummary(dir, grade, confirmed, total, pct, results, sym) {
    const sn = (sym || '—').replace('USDT', '');
    const missing = results.filter(r => r.status !== 'confirmed').map(r => r.label).slice(0, 3);

    if (grade === SETUP_GRADES.S)
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Kurumsal kalite ${dir} setup.`;
    if (grade === SETUP_GRADES.A)
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Güçlü ${dir} setup. ${missing.join(', ')} bekleniyor.`;
    if (grade === SETUP_GRADES.B)
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Erken momentum. ${missing.join(', ')} eksik.`;
    if (grade === SETUP_GRADES.C)
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Agresif giriş — stop sıkı tutulmalı.`;
    return `${sn} — ${confirmed}/${total} onay (%${pct}). Zayıf setup — konfirmasyon bekle.`;
  }

  // ── Adaptif skor modifiyeri (geçmiş performans) ──
  getScoreModifier(sym, setupGrade) {
    const trades = [];
    try { JSON.parse(localStorage.getItem('vd_trade_memory') || '[]').slice(-100).forEach(t => trades.push(t)); } catch {}
    if (trades.length < 3) return 0;

    const sn  = sym?.replace('USDT', '') || '';
    let mod   = 0;

    const ct  = trades.filter(t => t.sym === sn);
    if (ct.length >= 3) {
      const wr = ct.filter(t => t.win).length / ct.length;
      if (wr >= 0.7) mod += 5; else if (wr <= 0.35) mod -= 8;
    }

    const session = getCurrentSession();
    const st = trades.filter(t => t.session === session);
    if (st.length >= 3) {
      const wr = st.filter(t => t.win).length / st.length;
      if (wr >= 0.65) mod += 3; else if (wr <= 0.35) mod -= 5;
    }

    return clamp(mod, -20, 15);
  }
}

export const AIEng = new AIEngine();
