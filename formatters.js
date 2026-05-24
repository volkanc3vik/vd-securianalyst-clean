// ════════════════════════════════════════════════════════════════════
// AI NARRATOR — Anthropic Claude API ile gerçek market yorumu
// API key eklenince otomatik devreye girer
// ════════════════════════════════════════════════════════════════════
const AINarrator = (() => {

  const CONFIG = {
    apiKey:  '', // ← Yarın buraya ekle
    model:   'claude-opus-4-20250514',
    enabled: false,
    maxTokens: 400,
    lastCallTs: 0,
    minInterval: 30000, // 30 saniyede bir max 1 çağrı
  };

  // ── Setup ────────────────────────────────────────────────────────
  function setup(apiKey) {
    if (apiKey?.length > 10) {
      CONFIG.apiKey  = apiKey;
      CONFIG.enabled = true;
      console.log('✅ AI Narrator (Opus 4.7) aktif');
      _updateBadge(true);
    } else {
      CONFIG.enabled = false;
      _updateBadge(false);
    }
  }

  function _updateBadge(enabled) {
    const badge = document.getElementById('aiNarratorBadge');
    if (!badge) return;
    badge.textContent  = enabled ? '🔵 Opus 4.7' : '⚪ API Key Yok';
    badge.style.color  = enabled ? 'var(--cyan)' : 'var(--text3)';
  }

  // ── Market verisini prompt'a çevir ───────────────────────────────
  function _buildPrompt(data) {
    const {
      sym, dir, price, chg,
      ind, oiData, btcData, wsData,
      regimeMode, smcData, fakeBreak,
      liqResult, squeezeResult, crowdResult,
      conf, entry,
    } = data;

    const symClean = (sym || 'BTCUSDT').replace('USDT', '');

    return `Sen profesyonel bir kripto futures trading analistsin. Aşağıdaki piyasa verisini analiz et ve Türkçe, net, kısa bir yorum yap.

COIN: ${symClean}/USDT Perpetual
FİYAT: $${price} (${chg >= 0 ? '+' : ''}${chg?.toFixed(2)}%)
YÖN SİNYALİ: ${dir || '—'}
GÜVEN SKORU: ${conf || 0}/100

TEKNİK ANALİZ:
- RSI: ${ind?.rsi?.toFixed(1) || '—'}
- EMA Hizalama: ${ind?.emaAlign || '—'}
- MACD Histogram: ${ind?.macd?.hist > 0 ? 'Pozitif' : 'Negatif'} (${ind?.macd?.hist?.toFixed(4) || '—'})
- ATR: ${ind?.atr?.toFixed(2) || '—'}

PİYASA VERİSİ:
- Funding Rate: ${oiData?.fund !== null ? '%' + oiData?.fund?.toFixed(3) : '—'}
- L/S Ratio: ${oiData?.lsRatio?.toFixed(2) || '—'}
- OI Değişim: ${oiData?.oiChange ? '%' + oiData.oiChange : '—'}
- BTC: ${btcData?.chg !== undefined ? (btcData.chg >= 0 ? '+' : '') + btcData.chg?.toFixed(2) + '%' : '—'}

MARKET REJIMI: ${regimeMode || 'SIDEWAYS'}

SMART MONEY:
- Likidite Süpürmesi: ${smcData?.sweeps?.length > 0 ? 'VAR' : 'YOK'}
- CHoCH: ${smcData?.choch ? 'VAR' : 'YOK'}
- Order Block: ${smcData?.ob ? 'VAR' : 'YOK'}
- Fake Breakout Riski: ${fakeBreak ? 'YÜKSEK' : 'DÜŞÜK'}

INTELLIGENCE:
- Squeeze Riski: ${squeezeResult?.squeezeRisk || 0}% (${squeezeResult?.dominantType?.replace('_', ' ') || '—'})
- Crowd Riski: ${crowdResult?.crowdRisk || 0}%
- Likidasyon Baskısı: ${liqResult?.liquidationPressure || 0}%

${entry ? `GİRİŞ SETEBİ: ${dir} @ $${entry.entry} | Stop: $${entry.stop} | TP1: $${entry.tp1} | R/R: 1:${entry.rr}` : ''}

Lütfen şunları yap:
1. Piyasanın şu an ne yaptığını 1-2 cümle ile anlat
2. En önemli riski belirt
3. En önemli fırsatı belirt
4. Net bir öneri ver (gir / bekle / kaçın)

Maksimum 4 cümle. Teknik jargon kullan ama anlaşılır ol. Direkt ve özlü ol.`;
  }

  // ── Ana analiz fonksiyonu ─────────────────────────────────────────
  async function analyze(data) {
    if (!CONFIG.enabled) {
      return {
        text: null,
        source: 'disabled',
      };
    }

    // Rate limiting
    const now = Date.now();
    if (now - CONFIG.lastCallTs < CONFIG.minInterval) {
      return { text: null, source: 'rate_limited' };
    }
    CONFIG.lastCallTs = now;

    try {
      _setLoading(true);

      const prompt = _buildPrompt(data);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         CONFIG.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      CONFIG.model,
          max_tokens: CONFIG.maxTokens,
          messages: [{
            role:    'user',
            content: prompt,
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API hatası');
      }

      const result = await response.json();
      const text   = result.content?.[0]?.text || '';

      _renderNarrative(text, data.sym);
      _setLoading(false);

      return { text, source: 'opus' };

    } catch (e) {
      console.warn('AI Narrator hata:', e.message);
      _setLoading(false);
      _renderError(e.message);
      return { text: null, source: 'error', error: e.message };
    }
  }

  // ── UI Render ─────────────────────────────────────────────────────
  function _setLoading(loading) {
    const el = document.getElementById('aiNarratorText');
    if (!el) return;
    if (loading) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;color:var(--text3)">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--cyan);animation:aiPulse 1s infinite"></div>
          Opus 4.7 analiz ediyor...
        </div>`;
    }
  }

  function _renderNarrative(text, sym) {
    const el  = document.getElementById('aiNarratorText');
    const tsEl = document.getElementById('aiNarratorTs');
    if (!el) return;

    const symClean = (sym || '').replace('USDT', '');
    const time     = new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });

    el.innerHTML = `
      <div style="font-size:11px;line-height:1.7;color:var(--text2)">
        ${text.replace(/\n/g, '<br>')}
      </div>`;

    if (tsEl) tsEl.textContent = `${symClean} · ${time}`;
  }

  function _renderError(msg) {
    const el = document.getElementById('aiNarratorText');
    if (!el) return;
    el.innerHTML = `<div style="font-size:10px;color:var(--red)">⚠ ${msg}</div>`;
  }

  function isEnabled() { return CONFIG.enabled; }

  return { setup, analyze, isEnabled };
})();
