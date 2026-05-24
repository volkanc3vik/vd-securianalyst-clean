// ═══════════════════════════════════════════════
// CONSTANTS — Tüm sabit değerler merkezi
// ═══════════════════════════════════════════════

export const API = {
  BASE:  'https://api.binance.com',
  FBASE: 'https://fapi.binance.com',
  WS:    'wss://fstream.binance.com',
};

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h'];

export const DEFAULT_SYM  = 'BTCUSDT';
export const DEFAULT_INTV = '15m';

export const SCAN_INTERVAL    = 120_000; // 2 dakika
export const REFRESH_INTERVAL =  30_000; // 30 saniye
export const TRACK_INTERVAL   =  20_000; // 20 saniye

export const RISK_LEVELS = {
  LOW:      { label: 'DÜŞÜK RİSK',  cls: 'risk-low'  },
  MEDIUM:   { label: 'ORTA RİSK',   cls: 'risk-med'  },
  HIGH:     { label: 'YÜKSEK RİSK', cls: 'risk-high' },
  CRITICAL: { label: 'KRİTİK RİSK', cls: 'risk-crit' },
};

export const REGIME_MODES = ['TREND', 'RANGE', 'BREAKOUT', 'VOLATILE', 'SQUEEZE', 'PANIC', 'SIDEWAYS'];

export const SESSIONS = {
  ASIA:     { start: 0,  end: 8,  label: 'Asya',     color: '#f0a500' },
  LONDON:   { start: 8,  end: 13, label: 'Londra',   color: 'var(--cyan)' },
  NEW_YORK: { start: 13, end: 21, label: 'New York', color: 'var(--green)' },
  AFTER:    { start: 21, end: 24, label: 'Sonrası',  color: 'var(--text3)' },
};

export const TOAST_DURATION  = 6_000;  // ms
export const TOAST_MAX       = 3;
export const NOTIF_MAX       = 200;

export const STORAGE_KEYS = {
  TRADE_MEMORY:    'vd_trade_memory',
  TOAST_ENABLED:   'vd_toast_enabled',
  NOTIF_STORE:     'vd_notifications',
  USER_PREFS:      'vd_user_prefs',
};

export const CONFIRMATION_WEIGHTS = {
  ema_full:     12,
  macd:         10,
  rsi:           8,
  volume:       10,
  btc:           8,
  rr:           10,
  smc:           8,
  no_fake:      10,
  regime:        8,
  ob_imbalance:  8,
  funding:       8,
};

export const SETUP_GRADES = {
  S: { stars: '⭐⭐⭐', label: 'ELITE SETUP',      color: '#b39dfa', bg: 'rgba(157,125,250,.2)' },
  A: { stars: '⭐⭐',  label: 'STRONG SETUP',     color: 'var(--green)', bg: 'rgba(0,229,160,.12)' },
  B: { stars: '⭐',   label: 'CONFIRMED SETUP',  color: 'var(--yellow)', bg: 'rgba(255,193,7,.1)' },
  C: { stars: '⚡',   label: 'AGGRESSIVE ENTRY', color: 'var(--orange)', bg: 'rgba(255,122,0,.1)' },
  D: { stars: '○',    label: 'WEAK SETUP',        color: 'var(--text3)', bg: 'rgba(255,255,255,.05)' },
};
