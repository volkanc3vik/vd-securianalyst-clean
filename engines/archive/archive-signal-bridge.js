// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — ARCHIVE SIGNAL BRIDGE (v29 — diagnostic'li)
// Telegram'a sinyal BAŞARIYLA gönderildiğinde Archive'a otomatik pending kayıt açar.
//
// Kaynak olay: TelegramDispatcher.sendSignal() başarıda yayar →
//   window 'vd:telegram:sent' { detail: { signal, channel, messageId } }
// Zincir: UI → TelegramController.sendCardSignal → Dispatcher.sendSignal → (event) → bu modül
//
// TEŞHİS: Her adımda [ARCHIVE_BRIDGE] log'u basar; canlıda tek sinyal gönderip
// konsoldan nerede koptuğunu görebilirsiniz. Hata olsa bile gönderimi ETKİLEMEZ.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const ENDPOINT = '/api/analysis-archive';
  const TAG = '[ARCHIVE_BRIDGE]';

  function _disp() { return window.TelegramDispatcher || null; }
  function _num(v) { const n = Number(v); return isNaN(n) ? null : n; }

  async function _onSent(ev) {
    try {
      const d = ev && ev.detail;
      console.log(TAG, 'event alındı (vd:telegram:sent)', {
        sym: d && d.signal && d.signal.sym, dir: d && d.signal && d.signal.dir,
        channel: d && d.channel, messageId: d && d.messageId,
      });

      if (!d || !d.signal) { console.warn(TAG, 'signal yok → atlanıyor'); return; }
      const s = d.signal;
      if (!s.sym) { console.warn(TAG, 'signal.sym yok → atlanıyor'); return; }

      const disp = _disp();
      if (!disp || typeof disp.adminFetch !== 'function') {
        console.warn(TAG, 'TelegramDispatcher.adminFetch yok → atlanıyor'); return;
      }
      if (!disp.hasAdminKey || !disp.hasAdminKey()) {
        console.warn(TAG, 'admin key YOK → auto-create atlandı. (Telegram admin mode aktif/anahtar girili olmalı.)'); return;
      }

      const dir = String(s.dir || '').toUpperCase();
      const entry = _num(s.entry);
      const price = entry != null ? entry : _num(s.price);

      const payload = {
        action: 'create',
        sym: s.sym,
        direction: dir,
        timeframe: s.tf || s.timeframe || 'auto',
        price_at_analysis: price != null ? price : 0,
        analysis_score: _num(s.confidence) != null ? _num(s.confidence) : _num(s.score),
        analysis_text: s.rationale || s.note || null,
        ai_learned: s.ai_learned || null,
        source: 'ai_engine',
        telegram_msg_id: (d.messageId != null) ? d.messageId : null,
        market_context: {
          origin: 'telegram_signal',
          channel: d.channel || null,
          telegram_signal_msg_id: (d.messageId != null) ? d.messageId : null,
          dir: dir, entry: entry, price: _num(s.price), sl: _num(s.sl),
          risk: (s.risk != null ? s.risk : null),
          confidence: _num(s.confidence), score: _num(s.score),
          sent_at: new Date().toISOString(),
        },
      };
      console.log(TAG, 'create gönderiliyor →', ENDPOINT, { sym: payload.sym, dir: payload.direction, price: payload.price_at_analysis, msgId: payload.telegram_msg_id });

      let r;
      try {
        r = await disp.adminFetch(ENDPOINT, payload);
      } catch (e) {
        console.warn(TAG, 'create isteği FIRLATTI:', e && e.message); return;
      }

      if (r && r.ok) {
        console.log(TAG, r.deduped ? 'zaten vardı (dedup)' : 'YENİ pending kayıt oluştu ✓', 'id=' + (r.row && r.row.id));
        try { window.dispatchEvent(new CustomEvent('vd:archive:created', { detail: { row: r.row || null, deduped: !!r.deduped } })); } catch (e) {}
      } else {
        console.warn(TAG, 'create BAŞARISIZ:', (r && r.error) || 'bilinmiyor', r);
      }
    } catch (e) {
      console.warn(TAG, 'beklenmeyen hata (yutuldu, gönderim etkilenmez):', e && e.message);
    }
  }

  window.addEventListener('vd:telegram:sent', _onSent);
  window.VDArchiveSignalBridge = { _onSent, _version: 'v29' };
  console.log(TAG, 'yüklendi ✓ — vd:telegram:sent dinleniyor (v29).');
})();
