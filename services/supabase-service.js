// ═══════════════════════════════════════════════
// SUPABASE SERVICE — Auth + Database
// signals ve ai_weights tablolarını yönetir
// ═══════════════════════════════════════════════

const SupabaseDB = (() => {

  const URL = 'https://affgbrpwuikpqgsapuvh.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZmdicnB3dWlrcHFnc2FwdXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzA4MDAsImV4cCI6MjA5NDcwNjgwMH0.8o0msNt9OQXJMbfLm8L0ipzPghCrAcvx1wKXBGT36Ds';

  const HEADERS = {
    'Content-Type' : 'application/json',
    'apikey'       : KEY,
    'Authorization': 'Bearer ' + KEY,
    'Prefer'       : 'return=representation',
  };

  // ── Temel CRUD ────────────────────────────────
  async function _insert(table, data) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}`, {
        method:  'POST',
        headers: HEADERS,
        body:    JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`DB insert ${table}:`, e.message); return null; }
  }

  async function _update(table, data, filter) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}?${filter}`, {
        method:  'PATCH',
        headers: HEADERS,
        body:    JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`DB update ${table}:`, e.message); return null; }
  }

  async function _select(table, filter = '', limit = 100) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}?${filter}&limit=${limit}`, {
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`DB select ${table}:`, e.message); return []; }
  }

  // ── SIGNALS TABLOSU ──────────────────────────

  // Yeni sinyal kaydet
  async function saveSignal(sig) {
    return _insert('signals', {
      sym:           sig.sym,
      direction:     sig.direction,
      entry:         sig.entry || null,
      confidence:    sig.confidence || null,
      funding:       sig.funding || null,
      oi:            sig.oi || null,
      ls_ratio:      sig.lsRatio || null,
      squeeze_risk:  sig.squeezeRisk || 0,
      crowd_risk:    sig.crowdRisk || 0,
      liq_pressure:  sig.liqPressure || 0,
      regime:        sig.regime || 'UNKNOWN',
      smc_structure: sig.smcStructure || null,
      tp:            sig.tp || null,
      sl:            sig.sl || null,
      status:        'OPEN',
      open_ts:       Date.now(),
    });
  }

  // Sinyal sonucunu güncelle
  async function closeSignal(id, { status, pnl, durationMin }) {
    return _update('signals', {
      status,
      pnl:          pnl || null,
      duration_min: durationMin || null,
      close_ts:     Date.now(),
    }, `id=eq.${id}`);
  }

  // Son sinyalleri getir
  async function getSignals(limit = 50) {
    return _select('signals', 'order=created_at.desc', limit);
  }

  // Açık sinyalleri getir
  async function getOpenSignals() {
    return _select('signals', 'status=eq.OPEN&order=created_at.desc', 100);
  }

  // İstatistik hesapla
  async function getStats() {
    const signals = await _select('signals', 'status=neq.OPEN&order=created_at.desc', 500);
    if (!signals.length) return null;

    const wins   = signals.filter(s => s.status === 'TP_HIT').length;
    const total  = signals.length;
    const wr     = (wins / total * 100).toFixed(1);
    const pnls   = signals.filter(s => s.pnl !== null).map(s => +s.pnl);
    const avgPnl = pnls.length ? (pnls.reduce((a,b)=>a+b,0)/pnls.length).toFixed(2) : null;

    // Regime bazlı
    const byRegime = {};
    signals.forEach(s => {
      if (!byRegime[s.regime]) byRegime[s.regime] = { wins:0, total:0 };
      byRegime[s.regime].total++;
      if (s.status === 'TP_HIT') byRegime[s.regime].wins++;
    });

    return { total, wins, wr, avgPnl, byRegime };
  }

  // ── AI_WEIGHTS TABLOSU ───────────────────────

  // Ağırlıkları Supabase'den yükle
  async function loadWeights() {
    const rows = await _select('ai_weights', '', 50);
    if (!rows.length) return null;
    const w = {};
    rows.forEach(r => { w[r.indicator] = +r.weight; });
    return w;
  }

  // Ağırlığı güncelle
  async function updateWeight(indicator, weight, win) {
    // Önce var mı kontrol et
    const existing = await _select('ai_weights', `indicator=eq.${indicator}`, 1);

    if (existing.length) {
      return _update('ai_weights', {
        weight,
        win_count:  win ? existing[0].win_count + 1 : existing[0].win_count,
        loss_count: win ? existing[0].loss_count : existing[0].loss_count + 1,
        updated_at: new Date().toISOString(),
      }, `indicator=eq.${indicator}`);
    } else {
      return _insert('ai_weights', {
        indicator,
        weight,
        win_count:  win ? 1 : 0,
        loss_count: win ? 0 : 1,
      });
    }
  }

  // Tüm ağırlıkları toplu güncelle
  async function saveWeights(weightsObj) {
    const promises = Object.entries(weightsObj).map(([k, v]) =>
      updateWeight(k, v, null)
    );
    return Promise.allSettled(promises);
  }

  // ── AUTH (mevcut) ────────────────────────────
  async function verifyCode(kod) {
    const r = await fetch(`${URL}/functions/v1/verify-code`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ kod }),
    });
    if (!r.ok) throw new Error('Sunucu hatası');
    return r.json();
  }

  // ═══════════════════════════════════════════════
  // ANALYSIS ARCHIVE — Public READ (anon key + RLS)
  // ───────────────────────────────────────────────
  // RLS gereği anon yalnızca review_status != 'pending' kayıtları görür.
  //
  // YAZMA BU SERVİSTE YOKTUR. Tüm insert/update yalnızca server-side
  // endpoint (api/analysis-archive.js — Aşama 3) + SERVICE ROLE ile
  // yapılır. Anon key ile yazma RLS tarafından reddedilir (tasarım gereği).
  // Service role key ASLA client koduna konmaz.
  // ═══════════════════════════════════════════════

  // Arşiv listesi (public). opts: { sym, status, sinceISO, limit, offset }
  // Pagination: offset ile sayfalama. Dönen satır sayısı limit'e eşitse
  // muhtemelen daha fazla kayıt var (feed "Daha Fazla Yükle" gösterir).
  async function listArchive(opts = {}) {
    const { sym, status, sinceISO, limit = 12, offset = 0 } = opts;
    let f = 'order=created_at.desc';
    if (sym)      f += `&sym=eq.${encodeURIComponent(sym)}`;
    if (status)   f += `&review_status=eq.${encodeURIComponent(status)}`;
    if (sinceISO) f += `&created_at=gte.${encodeURIComponent(sinceISO)}`;
    if (offset)   f += `&offset=${Math.max(0, parseInt(offset, 10) || 0)}`;
    return _select('analysis_archive', f, Math.min(limit, 100));
  }

  // Tek kayıt (public). Pending ise RLS gereği null döner.
  async function getArchiveById(id) {
    const rows = await _select('analysis_archive', `id=eq.${encodeURIComponent(id)}`, 1);
    return rows && rows[0] ? rows[0] : null;
  }

  // İstatistikler (public) — RPC. Pending SAYISI dahil ama pending
  // satırlarını sızdırmadan (SECURITY DEFINER fonksiyon) döner.
  async function getArchiveStats() {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/archive_public_stats`, {
        method:  'POST',
        headers: HEADERS,
        body:    '{}',
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch (e) { console.warn('DB archive_public_stats:', e.message); return null; }
  }

  // Coin filtresi için dinamik distinct coin listesi (public görünür kayıtlar).
  // RPC: [{ sym, cnt }] döner; review_status != 'pending' coin'leri.
  async function getArchiveCoins() {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/archive_distinct_coins`, {
        method:  'POST',
        headers: HEADERS,
        body:    '{}',
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch (e) { console.warn('DB archive_distinct_coins:', e.message); return []; }
  }

  return {
    saveSignal, closeSignal, getSignals, getOpenSignals, getStats,
    loadWeights, updateWeight, saveWeights,
    verifyCode,
    // Analysis Archive (public read)
    listArchive, getArchiveById, getArchiveStats, getArchiveCoins,
  };

})();

// ── Global export ────────────────────────────────────────────────
// const ile tanımlandığı için SupabaseDB otomatik olarak window'a
// eklenmez (var'ın aksine). Archive componentleri window.SupabaseDB
// kullandığından, açıkça bağlıyoruz.
if (typeof window !== 'undefined') window.SupabaseDB = SupabaseDB;
