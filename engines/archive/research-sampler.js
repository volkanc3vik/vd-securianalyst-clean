// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — ARAŞTIRMA ÖRNEKLEYİCİ (Research Sampler) — Aşama 2b
//
// AMAÇ (yalnız veri toplama / araştırma — sinyal/öneri DEĞİL):
//   Admin oturumu açıkken, SAATTE BİR TUR: AI Piyasa Radarı'nın o an TAZE
//   (son 15 dk içinde o kademeye girmiş) sınıfladığı kartlardan her kademeden
//   (WATCH / ARMED / CONFIRMED) ŞU ANA EN YAKIN (en taze) en çok 3 örnek alır ve
//   archive'a 'research' damgalı kayıt açar. Hedef: hangi kademenin / skor bandının
//   gerçekten daha çok DOĞRULANDIĞINI istatistiksel ölçmek.
//
// ZAMANLAMA (Volkan kararı):
//   • Admin girince OTOMATİK; ilk TAZE kart belirir belirmez (Ctrl+Shift+R'dan
//     sonra radar sıfırlandığı için genelde ilk taramada) HEMEN 1. tur açılır.
//   • Tur, ANCAK kayıt açıldığında "harcanmış" sayılır; taze kart yoksa harcanmaz,
//     her taramada tekrar denenir → kendi kendine açılır (kod/buton YOK).
//   • İlk turdan sonra HER 1 SAATTE bir tur (saat dolunca taze kart bulununca).
//   • Durdurmak istersen konsoldan VDResearchSampler.disable().
//   • TAZELİK: yalnız son 15 dk içinde o kademeye GİRMİŞ kartlar dikkate alınır.
//     1 saat önceden kalma bayat kartlar ALINMAZ (market değişti → yanlış veri).
//   • Bu 15 dk'lık taze listeden de ŞU ANA EN YAKIN (en yeni) 3 tanesi seçilir —
//     rastgele değil. Örn: 3/6/9/14 dk önceki kartlar varsa → 3, 6, 9 alınır (14 değil).
//   • Bir kademede taze kart yoksa → o kademe bu tur ATLANIR (zorla bayat alınmaz).
//
// GÜVENLİK:
//   • Yalnız ADMIN oturumunda. research kayıtları SUNUCU TARAFINDA
//     excluded_from_learning=true olur → public feed / istatistik / öğrenme /
//     Öncelik tier DIŞINDA kalır (Aşama 2a'da kanıtlandı, hiçbir yere sızmaz).
//   • Motor / scanner / radar / scoring mantığına DOKUNMAZ; yalnız create
//     API'sini çağırır. Hata olsa bile taramayı ETKİLEMEZ (her şey try/catch).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var ENDPOINT = '/api/analysis-archive';
  var TAG = '[RESEARCH_SAMPLER]';
  var LS_KEY = 'vd_research_sampler';   // '0' → kapalı (varsayılan AÇIK)

  var CFG = {
    get perTier() { return Math.max(1, Math.min(Number(window.VD_RESEARCH_PER_TIER) || 3, 6)); },
    get freshMin() { return Math.max(1, Number(window.VD_RESEARCH_FRESH_MIN) || 15); },  // tazelik (dk)
    get turnMin()  { return Math.max(1, Number(window.VD_RESEARCH_TURN_MIN) || 60); },   // tur aralığı (dk)
    get freshMs()  { return this.freshMin * 60000; },
    get turnMs()   { return this.turnMin * 60000; }
  };

  var _lastTurnAt = 0;   // 0 → ilk taramada hemen tur
  var _busy = false;

  // varsayılan AÇIK (yalnız açıkça '0' yapılırsa kapalı)
  function _enabled() { try { return localStorage.getItem(LS_KEY) !== '0'; } catch (e) { return true; } }
  function _disp() { return window.TelegramDispatcher || null; }
  function _num(v) { var n = Number(v); return isNaN(n) ? null : n; }

  function _regime() {
    try {
      var el = document.getElementById('regimeBadge');
      if (!el) return null;
      var m = (el.className || '').match(/regime-([A-Z]+)/);
      if (m && m[1]) return m[1];
      return (el.textContent || '').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g, '').trim() || null;
    } catch (e) { return null; }
  }

  // ŞU ANA EN YAKIN (en taze) önce: stageSince ne kadar büyükse o kadar yeni girmiş.
  // Rastgele DEĞİL — Volkan kararı: 15 dk pencere içinde de en yeni kartlar önceliklidir.
  function _byRecency(arr) {
    return arr.sort(function (a, b) { return (b.stageSince || 0) - (a.stageSince || 0); });
  }

  async function _create(disp, r) {
    var sym = String(r.sym || '').toUpperCase();
    var dir = (r.dir === 'SHORT') ? 'SHORT' : 'LONG';
    var stage = r.stage;
    var score = (r.s && r.s.score != null) ? _num(r.s.score) : null;
    var rsi = (r.s && r.s.rsi != null) ? _num(r.s.rsi) : null;
    var ageSec = (r.stageSince ? Math.round((Date.now() - r.stageSince) / 1000) : null);
    var payload = {
      action: 'create',
      sym: sym,
      direction: dir,
      timeframe: 'auto',                 // 5 saat pencere (production auto ile aynı kurallar)
      price_at_analysis: (r.price != null) ? r.price : 0,
      analysis_score: score,
      source: 'ai_engine_auto',
      sample_type: 'research',           // SUNUCU bunu görünce excluded_from_learning=true zorlar
      radar_tier_at_open: stage,         // WATCH / ARMED / CONFIRMED (örnekleme anındaki kademe)
      market_context: {
        origin: 'research_auto',
        radar_tier: stage,
        dir: dir,
        price: (r.price != null) ? r.price : null,
        score: score,
        rsi: rsi,
        regime: _regime(),
        btc_chg: (r.btcChg != null) ? r.btcChg : null,
        stage_age_sec: ageSec,           // örnekleme anında kartın yaşı (tazelik kanıtı)
        sampled_at: new Date().toISOString()
      }
    };
    var res;
    try {
      res = await disp.adminFetch(ENDPOINT, payload);
    } catch (e) {
      console.warn(TAG, sym, dir, stage, 'create FIRLATTI:', e && e.message);
      return false;
    }
    if (res && res.ok) {
      console.log(TAG, 'YENİ research ✓', sym, dir, stage, '(skor ' + score + ', yaş ' + ageSec + 'sn)',
        'id=' + (res.row && res.row.id));
      return true;
    }
    console.warn(TAG, sym, 'create BAŞARISIZ:', (res && res.error) || 'bilinmiyor');
    return false;
  }

  async function _onScan() {
    if (_busy) return;
    try {
      if (!_enabled()) return;                                        // kapalı → hiçbir şey yapma
      var disp = _disp();
      if (!disp || typeof disp.adminFetch !== 'function') return;     // admin köprüsü yok → sessiz
      if (!disp.hasAdminKey || !disp.hasAdminKey()) return;           // admin oturumu değil → sessiz
      var radar = window.VDEarlyRadar;
      if (!radar || typeof radar.classified !== 'function') return;   // radar hazır değil

      var now = Date.now();
      // SAATLİK TUR: ilk seferde (_lastTurnAt=0) hemen; sonra her turMs'de bir
      if (_lastTurnAt && (now - _lastTurnAt) < CFG.turnMs) return;

      var rows = radar.classified() || [];
      if (!rows.length) return;          // radar henüz boş → turu HARCAMA, sonraki taramada tekrar dene

      var fresh = CFG.freshMs;
      var k = CFG.perTier;
      var tiers = ['WATCH', 'ARMED', 'CONFIRMED'];
      var picks = [];
      for (var ti = 0; ti < tiers.length; ti++) {
        var st = tiers[ti];
        // bu kademede + TAZE (son freshMs içinde bu kademeye girmiş) kartlar
        var elig = rows.filter(function (r) {
          if (!r || r.stage !== st || !r.sym) return false;
          if (r.stageSince == null) return false;
          return (now - r.stageSince) <= fresh;            // BAYAT kartı alma
        });
        if (!elig.length) { console.log(TAG, st + ': son ' + CFG.freshMin + ' dk içinde taze kart yok → bu tur atlandı'); continue; }
        _byRecency(elig);                                  // ŞU ANA EN YAKIN (en taze) önce — rastgele değil
        picks = picks.concat(elig.slice(0, k));            // kademe başına ŞU ANA EN YAKIN k (=3); 15 dk içindeki daha eskiler elenir
      }

      if (!picks.length) {
        console.log(TAG, 'bu turda taze kart yok → tur HARCANMADI; sonraki taramada tekrar denenecek (taze kart belirince otomatik açılır).');
        return;
      }

      _lastTurnAt = now;                 // TAZE kart bulundu ve kayıt açılıyor → tur SAYILDI (sonraki tur ~1 saat sonra)
      _busy = true;
      console.log(TAG, 'TUR — ' + picks.length + ' taze örnek açılıyor →',
        picks.map(function (p) { return p.sym + ' ' + p.dir + '/' + p.stage; }).join(', '));
      for (var pi = 0; pi < picks.length; pi++) {
        await _create(disp, picks[pi]);
      }
    } catch (e) {
      console.warn(TAG, 'beklenmeyen hata (yutuldu, tarama etkilenmez):', e && e.message);
    } finally {
      _busy = false;
    }
  }

  window.addEventListener('vd:scan:complete', _onScan);

  window.VDResearchSampler = {
    _onScan: _onScan,
    config: CFG,
    disable: function () {
      try { localStorage.setItem(LS_KEY, '0'); console.log(TAG, 'KAPATILDI — yeni araştırma örneği toplanmayacak.'); } catch (e) {}
      return 'OFF';
    },
    enable: function () {
      try { localStorage.removeItem(LS_KEY); console.log(TAG, 'AÇIK (varsayılan).'); } catch (e) {}
      return 'ON';
    },
    status: function () { return _enabled() ? 'ON' : 'OFF'; },
    // test için: bir sonraki taramada saat beklemeden hemen 1 tur açtırır
    runNow: function () { _lastTurnAt = 0; console.log(TAG, 'sonraki taramada hemen 1 tur açılacak (test).'); return 'armed'; }
  };

  console.log(TAG, 'yüklendi ✓ — OTOMATİK (admin oturumunda). Durum:', (_enabled() ? 'AÇIK' : 'KAPALI'),
    '| tur:', CFG.turnMin + 'dk, tazelik:', CFG.freshMin + 'dk, kademe başına:', CFG.perTier);
})();
