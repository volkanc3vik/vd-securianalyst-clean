// ═══════════════════════════════════════════════
// RISK ENGINE — Dinamik kaldıraç, pozisyon boyutu,
// portfolio exposure, drawdown koruması
// ═══════════════════════════════════════════════
import { clamp } from '../modules/helpers.js';
import { Storage } from '../services/storage-service.js';

// Korelasyon grupları
const HIGH_CORR_BTC = ['ETH','BNB','SOL','AVAX','MATIC','ARB','OP'];
const CORR_GROUPS   = [
  ['ETH','ARB','OP','MATIC'],
  ['BNB','CAKE'],
  ['SOL','RAY','JTO'],
  ['AVAX','JOE'],
];

class RiskEngine {

  // ── Volatilite Ayarlı Kaldıraç ────────────────
  calcDynamicLeverage(atrPct, conf, regimeMode, setupGrade) {
    let base = atrPct > 5 ? 2 : atrPct > 4 ? 3 : atrPct > 3 ? 5 : atrPct > 2 ? 7 : atrPct > 1 ? 10 : 12;

    // Güven skoru
    if (conf >= 85) base += 3;
    else if (conf >= 75) base += 1;
    else if (conf < 55) base -= 2;
    else if (conf < 45) base -= 4;

    // Rejim
    if (regimeMode === 'PANIC')    base = Math.min(base, 2);
    if (regimeMode === 'VOLATILE') base = Math.min(base, 3);
    if (regimeMode === 'TREND' && conf > 70) base += 2;

    // Grade
    if (setupGrade === 'S') base += 2;
    else if (setupGrade === 'D') base -= 3;

    return clamp(Math.round(base), 1, 15);
  }

  // ── ATR Bazlı Pozisyon Boyutu ─────────────────
  calcPositionSize(portfolio, atr, price, riskPct) {
    if (!atr || !price || !portfolio) return null;
    const riskAmount  = portfolio * (riskPct / 100);
    const stopDist    = atr * 1.5;
    const stopPct     = (stopDist / price) * 100;
    const posSize     = riskAmount / stopDist;
    const posValue    = posSize * price;
    const posValuePct = (posValue / portfolio) * 100;
    return { riskAmount, stopDist, stopPct, posSize, posValue, posValuePct };
  }

  // ── Korelasyon Kontrolü ───────────────────────
  checkCorrelation(sym, openPositions = []) {
    const clean    = sym.replace('USDT', '').replace('PERP', '');
    const warnings = [];
    let corrCount  = 0;

    // BTC grubu
    if (HIGH_CORR_BTC.includes(clean)) {
      const openBTCCorr = openPositions.filter(p => HIGH_CORR_BTC.includes(p.sym?.replace('USDT', ''))).length;
      if (openBTCCorr >= 2) {
        warnings.push(`⚠ ${clean} BTC korelasyonlu — ${openBTCCorr} açık pozisyon var`);
        corrCount += openBTCCorr;
      }
    }

    // Alt gruplar
    CORR_GROUPS.forEach(group => {
      if (group.includes(clean)) {
        const groupOpen = openPositions.filter(p => group.includes(p.sym?.replace('USDT', ''))).length;
        if (groupOpen > 0) {
          warnings.push(`⚠ ${clean} ile aynı gruptaki ${groupOpen} pozisyon açık`);
          corrCount += groupOpen;
        }
      }
    });

    return {
      warnings,
      corrCount,
      risk: corrCount >= 3 ? 'HIGH' : corrCount >= 1 ? 'MEDIUM' : 'LOW',
    };
  }

  // ── Drawdown Koruması ─────────────────────────
  checkDrawdown() {
    const trades  = Storage.getTrades();
    const last10  = trades.slice(-10);
    if (last10.length < 3) return { block: false, warning: null };

    const losses = last10.filter(t => !t.win).length;
    const cumPnl = last10.reduce((s, t) => s + t.pnlPct, 0);

    if (losses >= 5 && cumPnl < -8) {
      return { block: true, warning: `🛑 Drawdown koruması — Son 10T: ${losses} kayıp, -%${Math.abs(cumPnl).toFixed(1)} PNL` };
    }
    if (losses >= 4 && cumPnl < -5) {
      return { block: false, warning: `⚠ Düşük performans — Boyutu küçült` };
    }
    if (losses >= 7) {
      return { block: true, warning: `🛑 ${losses}/10 kayıp — Dur, stratejiyi gözden geçir` };
    }
    return { block: false, warning: null };
  }

  // ── Tam Risk Analizi ──────────────────────────
  analyze({ sym, atrPct, conf, regimeMode, setupGrade, portfolio = 10000, price, atr }) {
    const lev    = this.calcDynamicLeverage(atrPct, conf, regimeMode, setupGrade);
    const riskPct = conf >= 80 ? 2 : conf >= 70 ? 1.5 : conf >= 55 ? 1 : 0.5;
    const pos    = this.calcPositionSize(portfolio, atr, price, riskPct);
    const corr   = this.checkCorrelation(sym);
    const dd     = this.checkDrawdown();

    return { lev, riskPct, pos, corr, dd, atrPct, conf, regimeMode, setupGrade, sym };
  }
}

export const RiskEng = new RiskEngine();
