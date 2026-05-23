// ════════════════════════════════════════════════════════════════════
// TELEGRAM FORMATTER
// Sinyal objesini Telegram HTML mesajına çevirir.
//
// Public API:
//   TelegramFormatter.format(signal, channelType) → { text } | { text:null, error }
//
// Onaylanmış Final Tasarım:
//   FREE  → 8 satır, kısa, merak uyandırıcı, VIP CTA içerir
//   VIP   → ~12 satır, fiyatlar (Entry/TP1/TP2/TP3/Stop) monospace
//   Risk  → 🟢 Düşük · 🟡 Orta · 🔴 Yüksek (renk-kodlu)
//   Setup → Phase 2 rationale dinamik kullanılır
//   $ işareti kullanılmaz
// ════════════════════════════════════════════════════════════════════
window.TelegramFormatter = (() => {
  'use strict';

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

  // ── Fiyat formatlama ─────────────────────────────────────────────
  function fmtPrice(v) {
    const n = +v;
    if (!Number.isFinite(n)) return '—';
    if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 100)   return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1)     return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (n >= 0.01)  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
    return n.toPrecision(4);
  }

  function fmtPct(v) {
    const n = +v;
    if (!Number.isFinite(n)) return '';
    const sign = n >= 0 ? '+' : '−';
    return `${sign}${Math.abs(n).toFixed(2)}%`;
  }

  function calcPct(price, target) {
    if (!Number.isFinite(+price) || !Number.isFinite(+target) || +price === 0) return null;
    return ((+target - +price) / +price) * 100;
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

  // ── Tier kararı ───────────────────────────────────────────────────
  function tierLabel(score) {
    const s = +score || 0;
    if (s >= 90) return 'ELITE';
    if (s >= 80) return 'STRONG';
    if (s >= 70) return 'VALID';
    if (s >= 60) return 'WEAK';
    return 'AVOID';
  }

  // ── Risk emoji (renk-kodlu) ──────────────────────────────────────
  function riskEmoji(level) {
    if (!level) return '⚪';
    const v = String(level).toLowerCase();
    if (v === 'düşük' || v === 'dusuk' || v === 'low')          return '🟢';
    if (v === 'orta'  || v === 'moderate' || v === 'medium')    return '🟡';
    if (v === 'yüksek' || v === 'yuksek' || v === 'high')       return '🔴';
    return '⚪';
  }

  function riskText(risk) {
    if (!risk) return '—';
    if (typeof risk === 'string') return risk;
    return risk.level || '—';
  }

  // ── Sinyalden temel veri çek ──────────────────────────────────────
  function _extractCore(signal) {
    const dir = (signal.dir || '').toUpperCase();
    const isLong  = dir === 'LONG';
    const isShort = dir === 'SHORT';

    // Skor: yöne göre
    let score;
    if (isLong)       score = signal.score ?? signal.lScore ?? signal.confidence;
    else if (isShort) score = signal.score ?? signal.sScore ?? signal.confidence;
    else              score = signal.score ?? signal.confidence ?? 0;

    // Fiyat seviyeleri — yön bazlı
    const entry = signal.entry ?? signal.price;
    let sl, tp1, tp2, tp3;
    if (isShort) {
      sl  = signal.slShort  ?? signal.sl;
      tp1 = signal.tp1Short ?? signal.tp1;
      tp2 = signal.tp2Short ?? signal.tp2;
      tp3 = signal.tp3Short ?? signal.tp3;
    } else {
      sl  = signal.sl;
      tp1 = signal.tp1;
      tp2 = signal.tp2;
      tp3 = signal.tp3;
    }

    return {
      sym:     signal.sym || '',
      symBase: (signal.sym || '').replace(/USDT$|USDC$|BUSD$/, ''),
      symDisp: cleanSymbol(signal.sym),
      dir,
      isLong,
      isShort,
      score:   +score || 0,
      risk:    signal.risk,
      entry,
      sl, tp1, tp2, tp3,
      rationale: signal.rationale || null,
    };
  }

  // ── FREE Format ──────────────────────────────────────────────────
  // Onaylanan tasarım:
  //   🚀 BTC/USDT LONG
  //   📊 Confidence: 87/100 · STRONG
  //   🟡 Risk: Orta
  //   💬 [Setup teaser, max ~80 char]
  //   👉 Detaylı giriş seviyeleri VIP kanalda: @vdaisignalsvip
  //   #BTC #LONG
  function _formatFree(c) {
    const sym = escapeHtml(c.symDisp);
    const dir = c.isLong ? 'LONG' : c.isShort ? 'SHORT' : c.dir;
    const dirEmoji = c.isLong ? '🚀' : '📉';
    const tier = tierLabel(c.score);
    const rEmoji = riskEmoji(riskText(c.risk));
    const rText = escapeHtml(riskText(c.risk));

    // Teaser cümlesi (rationale'i kısalt)
    let teaser;
    if (c.rationale && c.rationale.length > 0) {
      teaser = c.rationale.length > 90
        ? c.rationale.slice(0, 87) + '...'
        : c.rationale;
    } else {
      teaser = 'Çoklu indikatör konfluansı.';
    }
    teaser = escapeHtml(teaser);

    const tagBase = escapeHtml(c.symBase || 'CRYPTO');
    const tagDir  = escapeHtml(dir);

    return [
      `${dirEmoji} <b>${sym} ${dir}</b>`,
      ``,
      `📊 Confidence: <b>${c.score}/100</b> · ${tier}`,
      `${rEmoji} Risk: ${rText}`,
      ``,
      `💬 ${teaser}`,
      ``,
      `👉 Detaylı giriş seviyeleri VIP kanalda: @vdaisignalsvip`,
      ``,
      `#${tagBase} #${tagDir}`,
    ].join('\n');
  }

  // ── VIP Format ───────────────────────────────────────────────────
  // Onaylanan tasarım:
  //   💎 BTC/USDT LONG
  //   ━━━━━━━━━━━━━━━━
  //   ⚡ Entry: <code>68,450</code>
  //   🎯 TP1: <code>69,800</code> (+1.97%)
  //   ...
  //   🛑 Stop: <code>67,200</code> (−1.83%)
  //   📊 Confidence: 87/100 · STRONG
  //   🟡 Risk: Orta
  //   💡 Setup: HTF hizalama + likidite sweep + sağlıklı funding
  //   #BTC #LONG #STRONG #VDAI_VIP
  function _formatVip(c) {
    const sym = escapeHtml(c.symDisp);
    const dir = c.isLong ? 'LONG' : c.isShort ? 'SHORT' : c.dir;
    const tier = tierLabel(c.score);
    const rEmoji = riskEmoji(riskText(c.risk));
    const rText = escapeHtml(riskText(c.risk));

    const lines = [];
    lines.push(`💎 <b>${sym} ${dir}</b>`);
    lines.push(`━━━━━━━━━━━━━━━━`);
    lines.push(``);

    // Fiyatlar (monospace)
    if (c.entry) {
      lines.push(`⚡ Entry: <code>${escapeHtml(fmtPrice(c.entry))}</code>`);
    }
    if (c.tp1) {
      const p = calcPct(c.entry, c.tp1);
      const pct = (p != null) ? ` (${fmtPct(p)})` : '';
      lines.push(`🎯 TP1: <code>${escapeHtml(fmtPrice(c.tp1))}</code>${pct}`);
    }
    if (c.tp2) {
      const p = calcPct(c.entry, c.tp2);
      const pct = (p != null) ? ` (${fmtPct(p)})` : '';
      lines.push(`🎯 TP2: <code>${escapeHtml(fmtPrice(c.tp2))}</code>${pct}`);
    }
    if (c.tp3) {
      const p = calcPct(c.entry, c.tp3);
      const pct = (p != null) ? ` (${fmtPct(p)})` : '';
      lines.push(`🎯 TP3: <code>${escapeHtml(fmtPrice(c.tp3))}</code>${pct}`);
    }
    if (c.sl) {
      const p = calcPct(c.entry, c.sl);
      const pct = (p != null) ? ` (${fmtPct(p)})` : '';
      lines.push(`🛑 Stop: <code>${escapeHtml(fmtPrice(c.sl))}</code>${pct}`);
    }
    lines.push(``);

    lines.push(`📊 Confidence: <b>${c.score}/100</b> · ${tier}`);
    lines.push(`${rEmoji} Risk: ${rText}`);
    lines.push(``);

    // Setup açıklaması — tek satır, dinamik
    let setupTxt;
    if (c.rationale && c.rationale.length > 0) {
      setupTxt = c.rationale.length > 200
        ? c.rationale.slice(0, 197) + '...'
        : c.rationale;
    } else {
      setupTxt = 'Çoklu indikatör konfluansı.';
    }
    lines.push(`💡 Setup: ${escapeHtml(setupTxt)}`);
    lines.push(``);

    // Tag'ler
    const tagBase = escapeHtml(c.symBase || 'CRYPTO');
    const tagDir  = escapeHtml(dir);
    lines.push(`#${tagBase} #${tagDir} #${tier} #VDAI_VIP`);

    return lines.join('\n');
  }

  // ── Public API ────────────────────────────────────────────────────
  function format(signal, channelType) {
    if (!signal || typeof signal !== 'object') {
      return { text: null, error: 'invalid_signal' };
    }
    const ch = String(channelType || 'free').toLowerCase();
    const core = _extractCore(signal);

    if (!core.sym || (!core.isLong && !core.isShort)) {
      return { text: null, error: 'invalid_signal_shape' };
    }

    const text = ch === 'vip' ? _formatVip(core) : _formatFree(core);
    return { text };
  }

  return { format };
})();
