// ════════════════════════════════════════════════════════════════════
// TI RISK ASSESSOR
// Setup Confidence ≠ Risk Level.
//
// Confidence (score): setup kalitesi, faktör kombinasyonu — Scorer üretir.
// Risk Level:         bu setup'a girersen ne kadar tehlikedeyim?
//
// Risk faktörleri (Confidence'tan bağımsız):
//   - Volatilite kondisyonu (extreme = high risk)
//   - Funding stresi (extreme = high risk)
//   - Trend overextension (sembol için mevcut hareket aşırı mı)
//   - HTF aleyhte mi?
//   - FBR (fake breakout risk)
//
// Çıktı: { level: 'Düşük'|'Orta'|'Yüksek', score: 0-100, reasons: [] }
// ════════════════════════════════════════════════════════════════════
window.TIRiskAssessor = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  function assess(setup, regimeDiag) {
    if (!setup || !setup.factors) {
      return { level: 'Orta', score: 50, reasons: [] };
    }

    let riskScore = 0;
    const reasons = [];

    // 1. Volatility risk
    const volQuality = regimeDiag?.vol?.quality;
    if (volQuality === 'EXTREME') {
      riskScore += 30;
      reasons.push('Aşırı volatilite — geniş hareket riski');
    } else if (volQuality === 'ELEVATED') {
      riskScore += 15;
      reasons.push('Yüksek volatilite ortamı');
    }

    // 2. Funding stresi
    const fundingFactor = setup.factors.find(f => f.code === 'FUNDING');
    if (fundingFactor?.available) {
      if (fundingFactor.score <= 3) {
        riskScore += 25;
        reasons.push('Funding stres altında — geç giriş baskısı');
      } else if (fundingFactor.score <= 5) {
        riskScore += 10;
      }
    }

    // 3. FBR — fake breakout risk
    const fbrFactor = setup.factors.find(f => f.code === 'FBR');
    if (fbrFactor?.available && fbrFactor.score >= 7) {
      riskScore += 25;
      reasons.push('Giriş mumunda fakeout işaretleri');
    } else if (fbrFactor?.available && fbrFactor.score >= 5) {
      riskScore += 10;
    }

    // 4. HTF alignment — aleyhte mi
    const htfFactor = setup.factors.find(f => f.code === 'HTF');
    if (htfFactor?.available && htfFactor.score <= 4) {
      riskScore += 20;
      reasons.push('HTF konfirmasyonu eksik');
    } else if (htfFactor?.available && htfFactor.score <= 6) {
      riskScore += 8;
    }

    // 5. Trend overextension — momentum factor'dan
    const momFactor = setup.factors.find(f => f.code === 'MOMENTUM');
    if (momFactor?.available && momFactor.score <= 3) {
      // Düşük momentum skoru burada RSI'ın overbought/oversold olduğunu işaret edebilir
      riskScore += 15;
      reasons.push('Momentum tükenme bölgesinde');
    }

    // 6. Volume zayıflığı
    const volFactor = setup.factors.find(f => f.code === 'VOLUME');
    if (volFactor?.available && volFactor.score <= 4) {
      riskScore += 10;
      reasons.push('Hacim konfirmasyonu zayıf');
    }

    // 7. Likidasyon yakınlığı (entry / sl yakın mı)
    if (setup.entry && setup.sl) {
      const slDistance = Math.abs(setup.entry - setup.sl) / setup.entry;
      if (slDistance < 0.005) {
        // SL %0.5'ten yakın — çok dar stop
        riskScore += 15;
        reasons.push('Stop çok dar — küçük hareket bile tetikleyebilir');
      }
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    let level;
    if (riskScore >= 55) level = 'Yüksek';
    else if (riskScore >= 25) level = 'Orta';
    else level = 'Düşük';

    return { level, score: riskScore, reasons };
  }

  return { assess };
})();
