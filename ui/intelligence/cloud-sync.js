// ════════════════════════════════════════════════════════════════════
// CLOUD SYNC (build 143) — AI öğrenme motorunu buluta bağlar
//
// AMAÇ: Tarayıcı geçmişi/localStorage silinince öğrenme verisi (adaptif
//   ağırlıklar + analiz geçmişi + coin performansı + pattern) KAYBOLMASIN.
//   localStorage blob'u ('ai_analyst_pro_v2') Supabase 'ai_engine_state'
//   tek satırına (id='global') senkronlanır → kalıcı + cihazlar arası.
//
// GÜVENLİ TASARIM (motoru yeniden YAZMAZ):
//   • localStorage birincil/hızlı önbellek olarak KALIR. Bulut çökerse,
//     tablo yoksa veya ağ yoksa → motor eskisi gibi local çalışır (kırılmaz).
//   • Açılışta: bulut daha güncelse (v) local'i bulutla doldur + motoru tazele.
//     Local daha güncelse bulutu local ile tohumla.
//   • Her ~8sn: local değiştiyse buluta yaz (last-write-wins, v=timestamp).
//
// NOT: supabase-service.js'ten SONRA yüklenmeli (window.SupabaseDB gerekir).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDCloudSync) return;
  var KEY = 'ai_analyst_pro_v2';
  var _lastPushed = '';
  var _started = false;

  function readLocal() { try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function writeLocal(blob) { try { localStorage.setItem(KEY, JSON.stringify(blob)); return true; } catch (e) { return false; } }
  function hasDB() { return !!(window.SupabaseDB && SupabaseDB.loadEngineState && SupabaseDB.saveEngineState); }
  function refreshEngine() {
    try { if (typeof AI !== 'undefined' && AI.load) AI.load(true); } catch (e) {}
    try { if (typeof renderAI === 'function') renderAI(); } catch (e) {}
  }

  function hydrate() {
    if (!hasDB()) return Promise.resolve();
    return Promise.resolve(SupabaseDB.loadEngineState()).then(function (row) {
      var local = readLocal();
      var lv = (local && local.v) || 0;
      var cv = (row && row.v) || 0;
      if (row && row.data && cv >= lv) {
        // Bulut daha güncel (ya da local boş) → local'i doldur, motoru tazele
        writeLocal(row.data);
        _lastPushed = JSON.stringify(row.data);
        refreshEngine();
      } else if (local && lv > cv) {
        // Local daha güncel → bulutu tohumla (sunucu üzerinden, admin anahtarıyla)
        _lastPushed = JSON.stringify(local);
        return cloudSave(local);
      }
    }).catch(function () {});
  }

  // Buluta YAZMA artık SUNUCU üzerinden (service-role) + admin anahtarıyla yapılır.
  // Anon yazma kapalı. Admin oturumda değilse (anahtar yok) → sessizce atlar (yalnızca okuma).
  function cloudSave(blob) {
    var d = window.TelegramDispatcher;
    if (!d || typeof d.adminFetch !== 'function' || !(d.hasAdminKey && d.hasAdminKey())) {
      return Promise.resolve(null); // admin değil → yazma yok (normal ziyaretçi sadece okur)
    }
    var v = (blob && blob.v) || Date.now();
    return Promise.resolve(d.adminFetch('/api/ai-state', { data: blob, v: v }, { method: 'POST' }))
      .then(function (resp) {
        if (!resp || resp.ok === false) throw new Error((resp && resp.error) || 'save_failed');
        return resp;
      });
  }

  function push(force) {
    if (!hasDB()) return Promise.resolve(null);
    var local = readLocal(); if (!local) return Promise.resolve(null);
    var s; try { s = JSON.stringify(local); } catch (e) { return Promise.resolve(null); }
    if (!force && s === _lastPushed) return Promise.resolve(null);   // değişmediyse atla
    _lastPushed = s;
    return Promise.resolve(cloudSave(local)).catch(function () { _lastPushed = ''; });
  }

  function start() {
    if (_started) return; _started = true;
    hydrate();
    setInterval(push, 8000);
    window.addEventListener('pagehide', function () { try { push(); } catch (e) {} }); // bfcache uyumlu (beforeunload DEĞİL)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 800); });
  else setTimeout(start, 800);
  setTimeout(start, 2000); // SupabaseDB geç yüklenirse ikinci deneme

  window.VDCloudSync = { hydrate: hydrate, push: push };
})();
