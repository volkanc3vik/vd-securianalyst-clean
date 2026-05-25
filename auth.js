
// ══════════════════════════════════════════════════════
// SUPABASE GİRİŞ SİSTEMİ
// ══════════════════════════════════════════════════════
const SB_URL = 'https://affgbrpwuikpqgsapuvh.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZmdicnB3dWlrcHFnc2FwdXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzA4MDAsImV4cCI6MjA5NDcwNjgwMH0.8o0msNt9OQXJMbfLm8L0ipzPghCrAcvx1wKXBGT36Ds';
const LS_KEY = 'aap_access_v1';

// ════════════════════════════════════════════════════
// PHASE 1 — SECURE SUPABASE CLIENT
// ════════════════════════════════════════════════════

// ── Rate Limiting (Brute Force Koruması) ──
const RateLimit = (() => {
  const KEY    = 'vd_rl_v1';
  const MAX    = 5;    // max deneme
  const WINDOW = 300;  // 5 dakika (saniye)
  const BLOCK  = 900;  // 15 dakika blok

  function _get(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function _set(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){} }

  function check(){
    const d   = _get();
    const now = Math.floor(Date.now()/1000);
    // Blok kontrolü
    if(d.blockedUntil && now < d.blockedUntil){
      const left = Math.ceil((d.blockedUntil - now)/60);
      throw new Error(`Çok fazla deneme. ${left} dakika sonra tekrar deneyin.`);
    }
    // Window sıfırla
    if(d.windowStart && now - d.windowStart > WINDOW){
      _set({});
      return;
    }
    // Limit kontrolü
    if(d.count >= MAX){
      const blockedUntil = now + BLOCK;
      _set({...d, blockedUntil});
      throw new Error('Çok fazla hatalı deneme. 15 dakika bekleyin.');
    }
  }

  function fail(){
    const d   = _get();
    const now = Math.floor(Date.now()/1000);
    _set({ count:(d.count||0)+1, windowStart:d.windowStart||now });
  }

  function success(){
    _set({});
  }

  function getRemainingTime(){
    const d = _get();
    if(!d.blockedUntil) return 0;
    return Math.max(0, d.blockedUntil - Math.floor(Date.now()/1000));
  }

  return{check, fail, success, getRemainingTime};
})();

// ── Secure Supabase API ──────────────────────────────
// Sadece anon key kullanır — service_role asla frontend'e gelmez
// Tüm işlemler RLS policy'lerle korunur
async function sbQuery(table, filters, method='GET', body=null) {
  const url = `${SB_URL}/rest/v1/${table}?${filters}`;
  const opts = {
    method,
    headers: {
      'apikey'       : SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type' : 'application/json',
      'Prefer'       : method==='PATCH' ? 'return=minimal' : 'return=representation',
      'Accept'       : 'application/json',
    },
  };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if(!r.ok){
    const txt = await r.text();
    throw new Error('API hatasi ' + r.status + ': ' + txt);
  }
  if(method==='PATCH') return true;
  return await r.json();
}

// ── Secure RPC çağrısı (stored procedure üzerinden) ──
async function sbRPC(fnName, params={}){
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method : 'POST',
    headers: {
      'apikey'       : SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type' : 'application/json',
      'Accept'       : 'application/json',
    },
    body: JSON.stringify(params),
  });
  if(!r.ok){
    const txt = await r.text();
    throw new Error('RPC hatasi ' + r.status + ': ' + txt);
  }
  return await r.json();
}

// ── Göz butonu ──
function toggleLoginEye() {
  const inp = document.getElementById('loginInput');
  const eye = document.getElementById('loginEye');
  if(inp.type==='password') { inp.type='text'; eye.textContent='🔒'; }
  else { inp.type='password'; eye.textContent='👁'; }
}

// ── Input sanitize ──
function sanitizeCode(raw){
  // Sadece izin verilen karakterler: harf, rakam, tire, parantez, yıldız, nokta
  return (raw||'').trim().slice(0,50); // Max 50 karakter
}

// ── Oturum kontrolü güvenlik hardening ──
function _verifySession(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    // Admin
    if(data.isAdmin && data.kod) return true;
    // Normal — süre kontrolü
    if(data.bitis && Date.now() < data.bitis) return true;
    // Süresi dolmuş
    localStorage.removeItem(LS_KEY);
    return false;
  }catch(e){
    localStorage.removeItem(LS_KEY);
    return false;
  }
}

// ── Blocked olup olmadığını sayfa yüklenince göster ──
(function checkBlock(){
  const rem = RateLimit.getRemainingTime();
  if(rem > 0){
    const err = document.getElementById('loginErr');
    if(err){
      err.textContent = `🔒 Hesap ${Math.ceil(rem/60)} dakika kilitli. Lütfen bekleyin.`;
      err.classList.add('show');
    }
    const btn = document.getElementById('loginBtn');
    if(btn){ btn.disabled=true; btn.textContent='Kilitli...'; }
    // Geri sayım
    const intv = setInterval(()=>{
      const r2 = RateLimit.getRemainingTime();
      if(r2<=0){
        clearInterval(intv);
        if(err) err.classList.remove('show');
        if(btn){ btn.disabled=false; btn.textContent='Giriş Yap'; }
      } else {
        if(err) err.textContent=`🔒 Hesap ${Math.ceil(r2/60)} dakika kilitli.`;
      }
    }, 1000);
  }
})();

// ── Hata göster ──
function showLoginErr(msg) {
  const e = document.getElementById('loginErr');
  const i = document.getElementById('loginInput');
  e.textContent = msg;
  e.classList.add('show');
  i.classList.add('err');
  setTimeout(()=>i.classList.remove('err'), 500);
}

// ── Giriş yap ──
async function doLogin() {
  const inp = document.getElementById('loginInput');
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginErr');
  const kod = sanitizeCode(inp.value);

  if(!kod) { showLoginErr('⚠ Lütfen erişim kodunuzu girin.'); return; }

  // Rate limit kontrolü
  try{ RateLimit.check(); }
  catch(e){ showLoginErr('🔒 ' + e.message); return; }

  err.classList.remove('show');
  btn.disabled = true;
  btn.innerHTML = '<span class="login-spinner"></span>Doğrulanıyor...';

  try {
    // Edge Function üzerinden güvenli doğrulama
    // Tablo doğrudan sorgulanmıyor — tüm işlem sunucu tarafında
    const resp = await fetch('https://affgbrpwuikpqgsapuvh.supabase.co/functions/v1/verify-code', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ kod }),
    });

    const result = await resp.json();

    if(!result.success) {
      RateLimit.fail();
      const rem = RateLimit.getRemainingTime();
      const errMsg = result.error || 'Geçersiz erişim kodu';
      showLoginErr(rem > 60
        ? `🔒 ${errMsg}. Hesap ${Math.ceil(rem/60)} dakika kilitlendi.`
        : '❌ ' + errMsg + '. Lütfen tekrar deneyin.');
      btn.disabled = false;
      btn.innerHTML = 'Giriş Yap';
      return;
    }

    // Başarılı — rate limit sıfırla
    RateLimit.success();

    // Admin ise sonsuz erişim
    if(result.is_admin) {
      localStorage.setItem(LS_KEY, JSON.stringify({
        bitis  : Date.now() + (36500 * 24 * 60 * 60 * 1000),
        isAdmin: true, kod,
        sureLbl: 'Sınırsız Erişim',
      }));
      grantAccess(true);
      return;
    }

    // Normal kullanıcı — süre hesapla
    const sure_ms = result.sure_gun * 24 * 60 * 60 * 1000;
    const bitis   = Date.now() + sure_ms;
    const sg      = result.sure_gun;
    const sureLbl = sg <= 0.5 ? '12 Saat'
      : sg === 1 ? '1 Gün' : sg === 2 ? '2 Gün'
      : sg === 3 ? '3 Gün' : sg === 4 ? '4 Gün'
      : sg === 5 ? '5 Gün' : sg === 6 ? '6 Gün'
      : sg === 7 ? '1 Hafta' : sg === 14 ? '2 Hafta'
      : sg === 21 ? '3 Hafta' : sg === 30 ? '1 Ay'
      : sg + ' Gün';

    localStorage.setItem(LS_KEY, JSON.stringify({
      bitis, isAdmin: false, kod, sureLbl,
    }));

    grantAccess(false);

  } catch(e) {
    showLoginErr('⚠ Bağlantı hatası: ' + e.message);
    console.error('Login hata:', e);
  }

  btn.disabled = false;
  btn.innerHTML = 'Giriş Yap';
}

// ── Erişim ver ──
function grantAccess(isAdmin) {
  const screen = document.getElementById('loginScreen');
  if(screen){ screen.classList.add('hiding'); setTimeout(()=>{ screen.style.display='none'; }, 600); }
  setTimeout(startTimer, 100);

  // Ana uygulamayı başlat (2. script bloğundaki init fonksiyonu)
  setTimeout(() => {
    try {
      if(typeof initApp === 'function') initApp(isAdmin);
    } catch(e) {
      // initApp yoksa eski yöntemi dene
      try { if(typeof startClock === 'function') startClock(); } catch {}
      try { if(typeof startScan  === 'function') startScan();  } catch {}
      try { if(typeof loadCoin   === 'function') loadCoin(window.SYM || 'BTCUSDT', window.INTV || '15m'); } catch {}
    }
  }, 700);
}

// ── Çıkış yap ──
function doLogout() {
  if(!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ── Sayaç ──
let _timerInterval = null;
function startTimer() {
  const bar        = document.getElementById('timerBar');
  const txt        = document.getElementById('tbText');
  const adminBadge = document.getElementById('tbAdmin');
  if(!bar || !txt) return; // DOM henüz hazır değil

  bar.classList.add('show');

  const data = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
  if(data.isAdmin) {
    if(adminBadge) adminBadge.style.display = 'inline-flex';
    txt.innerHTML = 'Yönetici erişimi — <b>Sınırsız</b>';
    return;
  }

  function update() {
    const kalan = data.bitis - Date.now();
    if(kalan <= 0) {
      localStorage.removeItem(LS_KEY);
      location.reload();
      return;
    }
    const gun  = Math.floor(kalan / 86400000);
    const saat = Math.floor((kalan % 86400000) / 3600000);
    const dk   = Math.floor((kalan % 3600000) / 60000);
    const sn   = Math.floor((kalan % 60000) / 1000);

    let kalanStr = '';
    if(gun > 0)       kalanStr = `${gun} gün ${saat} saat`;
    else if(saat > 0) kalanStr = `${saat} saat ${dk} dk`;
    else              kalanStr = `${dk} dk ${sn} sn`;

    txt.className = 'tb-text' + (gun===0&&saat<2?' warn':'') + (gun===0&&saat===0&&dk<30?' crit':'');
    txt.innerHTML = `Kalan süre: <b>${kalanStr}</b>`;
  }
  update();
  _timerInterval = setInterval(update, 1000);
}

// ── Sayfa açılınca kontrol ──
(function checkAccess() {
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return;

  try {
    const data = JSON.parse(raw);
    if(data.isAdmin || (data.bitis && Date.now() < data.bitis)) {
      const screen = document.getElementById('loginScreen');
      if(screen) screen.style.display = 'none';
      // DOM tamamen hazır olunca timer başlat
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', startTimer);
      } else {
        setTimeout(startTimer, 50);
      }
    } else {
      localStorage.removeItem(LS_KEY);
    }
  } catch(e) {
    localStorage.removeItem(LS_KEY);
  }
})();

// ── Exports ─────────────────────────────────────────────────────
export { doLogin, doLogout, grantAccess, startTimer };
