// ═══════════════════════════════════════════════
// FORMATTERS — Fiyat, yüzde, hacim formatlayıcılar
// ═══════════════════════════════════════════════

/**
 * Fiyatı uygun decimal ile formatla
 */
export function formatPrice(price) {
  if (!price && price !== 0) return '—';
  const p = +price;
  const dec = p > 1000 ? 2 : p > 1 ? 4 : p > 0.01 ? 5 : 7;
  return '$' + p.toLocaleString('en', {
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  });
}

/**
 * Yüzde formatla (+/- prefix)
 */
export function formatPct(val, decimals = 2) {
  if (val === null || val === undefined) return '—';
  const v = +val;
  return (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%';
}

/**
 * Büyük sayıları kısalt (1.2M, 450K vb.)
 */
export function formatVolume(val) {
  if (!val && val !== 0) return '—';
  const v = +val;
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

/**
 * Timestamp → relative time (örn: "2 dk önce")
 */
export function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)   return sec + 's önce';
  if (sec < 3600) return Math.floor(sec / 60) + 'dk önce';
  if (sec < 86400)return Math.floor(sec / 3600) + 'sa önce';
  return Math.floor(sec / 86400) + 'g önce';
}

/**
 * Sembol temizle (BTCUSDT → BTC)
 */
export function cleanSym(sym) {
  return (sym || '').replace('USDT', '').replace('PERP', '');
}

/**
 * Süreyi formatla (saniye → "2m 30s")
 */
export function formatDuration(sec) {
  if (sec < 60)   return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

/**
 * Sayıyı fixed ile formatla, null kontrolü ile
 */
export function fmt(val, decimals = 2, fallback = '—') {
  if (val === null || val === undefined) return fallback;
  return (+val).toFixed(decimals);
}

/**
 * DOM element içeriğini güvenli set et
 */
export function setEl(id, val, color = null) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  if (color) el.style.color = color;
}

/**
 * Renk — pozitif/negatif değere göre
 */
export function signColor(val) {
  return +val >= 0 ? 'var(--green)' : 'var(--red)';
}
