// ═══════════════════════════════════════════════
// SMART MONEY ENGINE — BOS, CHoCH, OB, FVG, Sweeps
// UI'dan tamamen bağımsız
// ═══════════════════════════════════════════════

class SmartMoneyEngine {

  // ── Liquidity Sweep (Likidite Süpürmesi) ──────
  detectLiquiditySweep(candles) {
    const sweeps = [];
    const n = candles.length;
    for (let i = 5; i < n; i++) {
      const c    = candles[i];
      const prev = candles.slice(i - 5, i);
      const maxH = Math.max(...prev.map(p => p.h));
      const minL = Math.min(...prev.map(p => p.l));
      const body = Math.abs(c.c - c.o);
      const total = c.h - c.l;
      const wickR = total > 0 ? body / total : 1;

      if (c.h > maxH && c.c < maxH && wickR < 0.4 && total > 0) {
        sweeps.push({ type: 'bearish_sweep', price: c.h, idx: i, msg: 'Buy-side likidite toplandı' });
      }
      if (c.l < minL && c.c > minL && wickR < 0.4 && total > 0) {
        sweeps.push({ type: 'bullish_sweep', price: c.l, idx: i, msg: 'Sell-side likidite toplandı' });
      }
    }
    return sweeps.slice(-5);
  }

  // ── Order Blocks ──────────────────────────────
  detectOrderBlocks(candles) {
    const obs = [];
    const n   = candles.length;
    for (let i = 2; i < n - 1; i++) {
      const c    = candles[i];
      const next = candles[i + 1];
      const body = Math.abs(c.c - c.o);
      const avgB = candles.slice(i - 5, i).map(x => Math.abs(x.c - x.o)).reduce((a, b) => a + b, 0) / 5;

      if (c.c < c.o && next.c > next.o && body > avgB * 1.5 && next.c > c.h) {
        obs.push({ type: 'bullish', high: c.o, low: c.l, idx: i, desc: 'Kurumsal alım bölgesi' });
      }
      if (c.c > c.o && next.c < next.o && body > avgB * 1.5 && next.c < c.l) {
        obs.push({ type: 'bearish', high: c.h, low: c.o, idx: i, desc: 'Kurumsal satış bölgesi' });
      }
    }
    return obs.slice(-4);
  }

  // ── Fair Value Gaps ───────────────────────────
  detectFVG(candles) {
    const fvgs = [];
    const n    = candles.length;
    for (let i = 1; i < n - 1; i++) {
      const prev = candles[i - 1];
      const next = candles[i + 1];

      if (prev.h < next.l && (next.l - prev.h) / prev.h > 0.001) {
        const filled = candles.slice(i + 1).some(c => c.l <= prev.h);
        if (!filled) fvgs.push({ type: 'bullish', high: next.l, low: prev.h, idx: i });
      }
      if (prev.l > next.h && (prev.l - next.h) / prev.l > 0.001) {
        const filled = candles.slice(i + 1).some(c => c.h >= prev.l);
        if (!filled) fvgs.push({ type: 'bearish', high: prev.l, low: next.h, idx: i });
      }
    }
    return fvgs.slice(-4);
  }

  // ── CHoCH / BOS ───────────────────────────────
  detectMarketStructure(candles) {
    const n   = candles.length;
    const pts = [];
    let pH = null, pL = null;

    for (let i = 2; i < n - 2; i++) {
      const c = candles[i], p = candles[i-1], pp = candles[i-2], nx = candles[i+1];
      if (p.h >= pp.h && p.h >= c.h && p.h >= nx.h) {
        pts.push({ type: pH !== null ? (p.h > pH ? 'HH' : 'LH') : 'HH', price: p.h, idx: i-1 });
        pH = p.h;
      }
      if (p.l <= pp.l && p.l <= c.l && p.l <= nx.l) {
        pts.push({ type: pL !== null ? (p.l < pL ? 'LL' : 'HL') : 'LL', price: p.l, idx: i-1 });
        pL = p.l;
      }
    }

    const recent = pts.slice(-6);
    const highs  = recent.filter(p => p.type === 'HH' || p.type === 'LH');
    const lows   = recent.filter(p => p.type === 'LL' || p.type === 'HL');
    const bullish = highs.some(h => h.type === 'HH') && lows.some(l => l.type === 'HL');
    const bearish = highs.some(h => h.type === 'LH') && lows.some(l => l.type === 'LL');

    // CHoCH
    const lastTypes = recent.slice(-4).map(p => p.type);
    const choch = (lastTypes.includes('HH') && lastTypes.includes('LL')) ||
                  (lastTypes.includes('HL') && lastTypes.includes('LH'));
    const bos   = lastTypes.slice(-2).every(t => t === 'HH') ||
                  lastTypes.slice(-2).every(t => t === 'LL');

    return {
      points: recent,
      trend:  bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'NEUTRAL',
      choch,
      bos,
      eqHighs: highs.filter(h => h.type === 'LH').length >= 2,
      eqLows:  lows.filter(l => l.type === 'HL').length >= 2,
    };
  }

  // ── Stop Hunt ─────────────────────────────────
  detectStopHunt(candles) {
    const n     = candles.length;
    const hunts = [];
    for (let i = 3; i < n; i++) {
      const c    = candles[i];
      const prev = candles.slice(i - 3, i);
      const body = Math.abs(c.c - c.o);
      const total = c.h - c.l;
      const wickU = c.h - Math.max(c.o, c.c);
      const wickL = Math.min(c.o, c.c) - c.l;

      if (wickU > body * 2 && wickU > total * 0.4 && total > 0) {
        const swept = Math.max(...prev.map(p => p.h));
        if (c.h > swept) {
          hunts.push({ type: 'bearish_hunt', price: c.h, idx: i,
            desc: `Stop hunt yukarı — %${(wickU/c.c*100).toFixed(2)} wick` });
        }
      }
      if (wickL > body * 2 && wickL > total * 0.4 && total > 0) {
        const swept = Math.min(...prev.map(p => p.l));
        if (c.l < swept) {
          hunts.push({ type: 'bullish_hunt', price: c.l, idx: i,
            desc: `Stop hunt aşağı — %${(wickL/c.c*100).toFixed(2)} wick` });
        }
      }
    }
    return hunts.slice(-3);
  }

  // ── Tam SMC Analizi ───────────────────────────
  analyze(candles, price) {
    if (!candles?.length) return null;
    return {
      sweeps:  this.detectLiquiditySweep(candles),
      obs:     this.detectOrderBlocks(candles),
      fvgs:    this.detectFVG(candles),
      ms:      this.detectMarketStructure(candles),
      hunts:   this.detectStopHunt(candles),
      // Shorthand flags for confirmation engine
      ob:      this.detectOrderBlocks(candles).length > 0,
      choch:   this.detectMarketStructure(candles).choch,
      bos:     this.detectMarketStructure(candles).bos,
    };
  }
}

export const SMCEngine = new SmartMoneyEngine();
