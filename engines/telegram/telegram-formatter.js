// ════════════════════════════════════════════════════════════════════
// TELEGRAM FORMATTER (Mini-Aşama A — Dil Dönüşümü)
//
// Public API:
//   TelegramFormatter.format(signal, channelType) → { text } | { text:null, error }
//
// HUKUKİ DÖNÜŞÜM KURALLARI:
//   - "Sinyal" → "Analiz çıktısı"
//   - "Entry / TP / SL" → ASLA TELEGRAM'DA GÖSTERİLMEZ
//   - "LONG/SHORT" → "Yön eğilimi" altında bağlamlı kullanılır
//   - "Confidence" → "Algoritmik güven seviyesi"
//   - "Setup" → "Teknik koşullar"
//   - VIP kanal CTA YOK — sadece web site CTA
//   - Her mesajın altında: "Yatırım tavsiyesi değildir."
//
// FUNNEL STRATEJİSİ:
//   - Tam fiyat seviyeleri ASLA Telegram'da yer almaz
//   - "Detaylı analiz platformda" hissi
//   - Web site CTA: vd-securianalyst.com/?sym=X&ref=tg
//
// NOT: Backend hâlâ 'free' ve 'vip' channel kabul ediyor (geriye uyumluluk).
// Ama mesaj formatı tek tip. VIP kanal stratejik olarak kaldırılıyor.
// ════════════════════════════════════════════════════════════════════
window.TelegramFormatter = (() => {
  'use strict';

  // ── Site funnel URL config ───────────────────────────────────────
  const SITE_URL = 'https://vd-securianalyst.com';

  function _funnelUrl(symBase) {
    const sym = encodeURIComponent(symBase || '');
    return `${SITE_URL}/?sym=${sym}&ref=tg&utm_source=telegram`;
  }

  // ── HTML escape ──────────────────────────────────────────────────
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Sembol görsel formatı (BTCUSDT → BTC/USDT) ───────────────────
  function cleanSymbol(sym) {
    if (!sym) return '—';
    const s = String(sym).toUpperCase();
    if (s.endsWith('USDT')) return s.slice(0, -4) + '/USDT';
    if (s.endsWith('USDC')) return s.slice(0, -4) + '/USDC';
    if (s.endsWith('BUSD')) return s.slice(0, -4) + '/BUSD';
    return s;
  }

  // ── Risk emoji (renk-kodlu) ──────────────────────────────────────
  function riskEmoji(level) {
    if (!level) return '⚪';
    const v = String(level).toLowerCase();
    if (v === 'düşük' || v === 'dusuk' || v === 'low')       return '🟢';
    if (v === 'orta'  || v === 'moderate' || v === 'medium') return '🟡';
    if (v === 'yüksek' || v === 'yuksek' || v === 'high')    return '🔴';
    return '⚪';
  }

  function riskText(risk) {
    if (!risk) return '—';
    if (typeof risk === 'string') return risk;
    return risk.level || '—';
  }

  // ── Algoritmik güven seviyesi yorumlaması ────────────────────────
  // Tier label artık "STRONG/ELITE" gibi vaatkâr değil, "yüksek destek" gibi nötr
  function confidenceLabel(score) {
    const s = +score || 0;
    if (s >= 90) return 'Çok yüksek teknik destek';
    if (s >= 80) return 'Yüksek teknik destek';
    if (s >= 70) return 'Orta-yüksek teknik destek';
    if (s >= 60) return 'Orta teknik destek';
    return 'Düşük teknik destek';
  }

  // ── Sinyalden temel veri çek ──────────────────────────────────────
  // NOT: entry, sl, tp1/2/3 hâlâ extract ediliyor — internal kullanım için
  // (controller bunları VIP tracker'a iletecek). AMA Telegram mesajında YOK.
  function _extractCore(signal) {
    const dir = (signal.dir || '').toUpperCase();
    const isLong  = dir === 'LONG';
    const isShort = dir === 'SHORT';

    let score;
    if (isLong)       score = signal.score ?? signal.lScore ?? signal.confidence;
    else if (isShort) score = signal.score ?? signal.sScore ?? signal.confidence;
    else              score = signal.score ?? signal.confidence ?? 0;

    return {
      sym:     signal.sym || '',
      symBase: (signal.sym || '').replace(/USDT$|USDC$|BUSD$/, ''),
      symDisp: cleanSymbol(signal.sym),
      dir,
      isLong,
      isShort,
      score:   +score || 0,
      risk:    signal.risk,
      rationale: signal.rationale || null,
    };
  }

  // ── Teknik koşullar listesi (rationale'dan çıkar) ────────────────
  // Rationale örneği: "HTF momentum + likidite sweep + sağlıklı funding"
  // → ['HTF hizalama', 'Likidite testi', 'Funding desteği']
  function _technicalConditions(rationale) {
    if (!rationale || typeof rationale !== 'string') {
      return ['Çoklu indikatör konfluansı'];
    }
    // " + " veya "," ile ayır, max 4 koşul
    const parts = rationale.split(/\s*[+,]\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return ['Çoklu indikatör konfluansı'];
    // Riskli kelimeleri yumuşat
    return parts.slice(0, 4).map(p =>
      p.replace(/\bsweep\b/gi, 'testi')
       .replace(/\bmomentum\b/gi, 'momentum desteği')
       .replace(/\bfunding\b/gi, 'funding seviyesi')
    );
  }

  // ── ANA FORMAT (eski Free formatın evrilmiş hali) ────────────────
  // Bu format hem 'free' hem 'vip' channel için kullanılır.
  // VIP kanal kaldırılıyor ama backend hâlâ kabul ediyor.
  function _formatAnalysis(c) {
    const sym      = escapeHtml(c.symDisp);
    const dir      = c.isLong ? 'LONG' : c.isShort ? 'SHORT' : c.dir;
    const dirEmoji = c.isLong ? '▲' : c.isShort ? '▼' : '◆';
    const rEmoji   = riskEmoji(riskText(c.risk));
    const rText    = escapeHtml(riskText(c.risk));
    const confLabel = confidenceLabel(c.score);

    const conditions = _technicalConditions(c.rationale);
    const conditionsBlock = conditions.map(t => `✓ ${escapeHtml(t)}`).join('\n');

    const funnelUrl = _funnelUrl(c.symBase);
    const tagBase = escapeHtml(c.symBase || 'KRIPTO');

    return [
      `📊 <b>${sym}</b> · Algoritmik yön eğilimi: <b>${dirEmoji} ${dir}</b>`,
      ``,
      `⚡ Algoritmik güven seviyesi: <b>${c.score}/100</b>`,
      `<i>${escapeHtml(confLabel)}</i>`,
      ``,
      `${rEmoji} Risk seviyesi: ${rText}`,
      ``,
      `📋 Teknik koşullar:`,
      conditionsBlock,
      ``,
      `🔍 Detaylı analiz, fiyat haritası ve AI yorumu platformda.`,
      ``,
      `🚀 <a href="${funnelUrl}">Premium Kripto Analiz Platformunu Aç</a>`,
      ``,
      `<i>⚠ Yatırım tavsiyesi değildir. Bilgilendirme amaçlıdır.</i>`,
      ``,
      `#${tagBase} #TeknikAnaliz #AI #Kripto`,
    ].join('\n');
  }

  // ── Public API ────────────────────────────────────────────────────
  // channelType parametresi backward compatibility için kabul ediliyor,
  // ama tek format döndürüyoruz (VIP kanal artık kullanılmıyor)
  function format(signal, channelType) {
    if (!signal || typeof signal !== 'object') {
      return { text: null, error: 'invalid_signal' };
    }
    const core = _extractCore(signal);

    if (!core.sym || (!core.isLong && !core.isShort)) {
      return { text: null, error: 'invalid_signal_shape' };
    }

    const text = _formatAnalysis(core);
    return { text };
  }

  return { format };
})();
