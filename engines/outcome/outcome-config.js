// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — First-Hit Outcome Engine: KONFİGÜRASYON (config-managed)
// Build 163B. Eşikler buradan yönetilir. Tüm yüzdeler % cinsinden.
// window = inceleme penceresi (saat).
//
// Kural (first-hit): kayıt açıldıktan sonra fiyat ÖNCE hangi eşiğe değdiyse
//   sonuç ona göre kapanır. Max favorable/adverse SADECE bilgi.
// ═══════════════════════════════════════════════════════════════════

export const OUTCOME_ENGINE_VERSION = 'first_hit_v1';

// Intrabar belirsizlik: tek mumda hem confirm hem invalid değerse → kim kazanır?
// Volkan kararı: invalid (muhafazakâr).
export const INTRABAR_TIE_BREAK = 'invalid';

// Timeframe profilleri (Volkan onaylı değerler)
export const PROFILES = {
  '15m': { confirm: 0.8, invalid: 0.6, partial: 0.35, window: 4 },
  '1h':  { confirm: 1.5, invalid: 1.0, partial: 0.7,  window: 24 },
  '4h':  { confirm: 3.0, invalid: 2.0, partial: 1.2,  window: 72 },
};

// Diğer timeframe'leri en yakın profile grupla.
//   sub-hour (1m..45m) → 15m · (1h,2h) → 1h · (4h,6h,8h,12h,1d,1w...) → 4h
//   auto/bilinmeyen → güvenli orta = 1h
export function profileFor(timeframe) {
  const t = String(timeframe || '').toLowerCase().trim();
  if (/^(4h|6h|8h|12h|1d|2d|3d|1w|1week|daily)$/.test(t)) return { key: '4h', ...PROFILES['4h'] };
  if (/^(1h|2h)$/.test(t)) return { key: '1h', ...PROFILES['1h'] };
  if (/^(1m|3m|5m|15m|30m|45m)$/.test(t)) return { key: '15m', ...PROFILES['15m'] };
  return { key: '1h', ...PROFILES['1h'] };
}
