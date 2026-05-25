// ═══════════════════════════════════════════════
// SUPABASE SERVICE — Backend auth & data
// ═══════════════════════════════════════════════

class SupabaseService {
  constructor() {
    this._supabaseUrl = null;
    this._anonKey    = null;
    this._client     = null;
  }

  // ── Edge Function çağrısı — kod doğrulama ──
  async verifyCode(kod) {
    const EDGE_URL = 'https://affgbrpwuikpqgsapuvh.supabase.co/functions/v1/verify-code';
    const r = await fetch(EDGE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ kod }),
    });
    if (!r.ok) throw new Error('Sunucu hatası');
    return r.json();
  }

  // ── Admin kontrolü ──
  isAdmin(kodData) {
    return kodData?.is_admin === true;
  }

  // ── Erişim süresi ──
  getAccessDays(kodData) {
    return kodData?.sure_gun ?? 30;
  }
}

export const SupabaseAPI = new SupabaseService();
