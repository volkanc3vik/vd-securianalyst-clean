// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — ANALYSIS ARCHIVE CONFIG (Aşama 1)
//
// TEK KAYNAK: Tüm eşikler, cooldown'lar, review pencereleri ve durum
// sabitleri burada. Koda dağınık sabit değer GÖMÜLMEZ; herkes bunu okur.
//
// Kullanım (sonraki aşamalarda):
//   const C = window.VDArchiveConfig;
//   if (score >= C.recording.minAnalysisScore) { ... }
//   const hours = C.reviewWindows[timeframe] ?? C.reviewWindowsDefaultHours;
//
// NOT: Object.freeze ile derin kilitli — runtime'da değiştirilemez.
// Namespace: window.VDArchiveConfig
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CONFIG = {
    version: 'v19',

    // ── Kayıt eşikleri (otomatik kayıt) ──────────────────────────────
    recording: {
      // AI Engine: bu skorun üstündeki analizler arşive PENDING düşer
      minAnalysisScore: 80,
      // TI Setup Scorer / Best Setup: maturity bu eşiğin üstündeyse kaydet
      setupMaturityThreshold: 90,
      // Aynı coin için iki kayıt arası min süre (saat) — spam/şişme önleme
      symbolCooldownHours: 4,
      // Güvenlik: tablo şişmesini önlemek için günlük üst sınır (guard)
      dailyMaxRecords: 20,
    },

    // ── Review pencereleri (timeframe → kaç saat sonra değerlendirilir) ─
    // Merkezi; ileride '1D','1W' eklenebilir.
    reviewWindows: {
      '15m': 4,
      '1h':  24,
      '4h':  72,
    },
    // Bilinmeyen timeframe için varsayılan
    reviewWindowsDefaultHours: 24,

    // ── Validation (pencere içi yol bazlı; sadece son fiyat DEĞİL) ─────
    // direction_realized ve validation_score bu eşiklere göre hesaplanır.
    validation: {
      // Yön "doğrulandı" sayılması için gereken min lehte hareket (%)
      validatedMovePct: 1.5,
      // "Kısmen doğrulandı" için ara eşik (%)
      partialMovePct: 0.5,
      // Bunun üstünde ters hareket olursa "doğrulanmadı" sayılır (%)
      adverseMovePct: 1.5,
    },

    // ── Durum sabitleri (string literal kullanma, bunları kullan) ─────
    statuses: {
      PENDING:        'pending',
      VALIDATED:      'validated',
      PARTIAL:        'partially_validated',
      NOT_VALIDATED:  'not_validated',
    },

    // ── Kaynak sabitleri ──────────────────────────────────────────────
    sources: {
      AI_ENGINE: 'ai_engine',
      TI_SETUP:  'ti_setup',
    },

    // ── Yön sabitleri ─────────────────────────────────────────────────
    directions: {
      BULLISH: 'bullish',
      BEARISH: 'bearish',
      NEUTRAL: 'neutral',
    },

    // ── Review kaynağı ────────────────────────────────────────────────
    reviewSources: {
      AUTO:   'auto',
      MANUAL: 'manual',
    },
  };

  // Derin dondur — runtime mutasyonu engelle
  function deepFreeze(o) {
    Object.getOwnPropertyNames(o).forEach((k) => {
      const v = o[k];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    });
    return Object.freeze(o);
  }

  // Yardımcı: timeframe → review window saat
  function reviewWindowHours(timeframe) {
    return CONFIG.reviewWindows[timeframe] ?? CONFIG.reviewWindowsDefaultHours;
  }

  const API = deepFreeze({
    ...CONFIG,
    reviewWindowHours, // fonksiyon — freeze referansı korur
  });

  // Global
  if (typeof window !== 'undefined') {
    window.VDArchiveConfig = API;
  }
  // CommonJS (Node/test) uyumluluğu — opsiyonel
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
