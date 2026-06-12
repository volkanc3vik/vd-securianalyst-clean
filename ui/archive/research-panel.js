// ════════════════════════════════════════════════════════════════════
// VDArchive · ARAŞTIRMA KATMANI (admin-only research monitoring panel)
//
// Yalnız admin görür (NS.Admin.isAdmin). SALT-OKUNUR: research kayıtlarını
// (sample_type='research') service-role endpoint'ten çeker
// (POST /api/analysis-archive {action:'list_research'}, x-admin-key) ve
// kademe kademe (CONFIRMED / ARMED / WATCH) + özet (kademe başına doğrulanma)
// gösterir.
//
// GÜVENLİK / TASARIM:
//   • Public feed / stats / RLS DEĞİŞMEZ; bu kayıtlar müşteriye GÖRÜNMEZ.
//   • Normal kullanıcı bu paneli HİÇ görmez (render edilmez).
//   • Kartlar DISPLAY-ONLY (modal açmaz) → yanlışlıkla manuel review olmaz;
//     sonuçları gece outcome cron'u otomatik çözer.
//   • Mevcut .aic-pend-* sınıflarını kullanır → panel görünümüyle birebir uyum.
//   • Oran (doğrulanma %) yalnız yeterli çözülmüş kayıt varsa gösterilir
//     (az veriyle yanıltıcı yüzde çıkmasın).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U  = NS.util || { esc: (s) => String(s == null ? '' : s) };
  const API = '/api/analysis-archive';
  const CONTAINER = 'aic-research';
  const RATE_MIN_RESOLVED = 10;   // oran ancak bu kadar çözülmüş kayıt olunca gösterilir

  function _isAdmin() { return !!(NS.Admin && NS.Admin.isAdmin && NS.Admin.isAdmin()); }
  function _disp() { return window.TelegramDispatcher || null; }
  function _hasKey() { const d = _disp(); return !!(d && d.hasAdminKey && d.hasAdminKey()); }
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }
  function _esc(s) { return (U.esc ? U.esc(s) : String(s == null ? '' : s)); }
  function _dirLabel(b) {
    if (U.directionLabel) return U.directionLabel(b);
    if (b === 'bullish') return 'LONG';
    if (b === 'bearish') return 'SHORT';
    return b || '—';
  }
  function _pct(v) { const n = Number(v); return (v == null || isNaN(n)) ? '—' : '%' + n; }
  function _fmtDT(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
             d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso); }
  }
  function _relTime(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 60000) return 'az önce';
    const min = Math.floor(diff / 60000);
    if (min < 60) return min + ' dk önce';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' saat önce';
    return Math.floor(hr / 24) + ' gün önce';
  }
  // "3 saat sonra" / "17 dakika sonra" — sonuç penceresine kalan süre
  function _relFuture(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = t - Date.now();
    if (diff <= 0) return 'şimdi';
    const min = Math.floor(diff / 60000);
    if (min < 60) return min + ' dakika sonra';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' saat sonra';
    const day = Math.floor(hr / 24);
    const remHr = hr % 24;
    return day + ' gün' + (remHr ? ' ' + remHr + ' saat' : '') + ' sonra';
  }
  function _statusPill(os) {
    switch (os) {
      case 'confirmed':   return '<span class="aic-pend-pill aic-rsch-ok">🟢 Doğrulandı</span>';
      case 'invalidated': return '<span class="aic-pend-pill aic-rsch-bad">🔴 Geçersiz</span>';
      case 'partial':     return '<span class="aic-pend-pill aic-rsch-mid">🟡 Kısmi</span>';
      case 'expired':     return '<span class="aic-pend-pill aic-pend-wait">⚪ Süre doldu</span>';
      default:            return '<span class="aic-pend-pill aic-pend-wait">⏳ Bekliyor</span>';
    }
  }
  function _tierBadge(t) {
    const cls = (t === 'CONFIRMED') ? 'aic-rsch-t-c'
              : (t === 'ARMED')     ? 'aic-rsch-t-a'
              : (t === 'WATCH')     ? 'aic-rsch-t-w' : 'aic-rsch-t-u';
    return '<span class="aic-rsch-tier ' + cls + '">' + _esc(t || '—') + '</span>';
  }

  function _injectStyle() {
    if (document.getElementById('aic-rsch-style')) return;
    const css =
      '#aic-research .aic-pend-card{cursor:default}' +
      '#aic-research .aic-pend-card:hover{transform:none}' +
      '#aic-research .aic-rsch-intro{font-size:12px;color:var(--v4-text-2,#7FA9C9);margin:2px 0 12px;line-height:1.5}' +
      '#aic-research .aic-rsch-sum{display:grid;gap:7px;margin-bottom:14px}' +
      '#aic-research .aic-rsch-sumrow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:8px 11px;border:1px solid var(--v4-border,rgba(255,255,255,0.08));border-radius:11px;background:rgba(2,5,13,0.4)}' +
      '#aic-research .aic-rsch-tier{font-weight:700;font-size:11px;letter-spacing:.04em;padding:2px 9px;border-radius:999px;border:1px solid rgba(154,160,166,.35);color:#9aa0a6}' +
      '#aic-research .aic-rsch-t-c{color:#E3B341;border-color:rgba(227,179,65,.5)}' +
      '#aic-research .aic-rsch-t-a{color:#E8943A;border-color:rgba(232,148,58,.5)}' +
      '#aic-research .aic-rsch-t-w{color:#9aa0a6;border-color:rgba(154,160,166,.5)}' +
      '#aic-research .aic-rsch-t-u{color:#9aa0a6;border-color:rgba(154,160,166,.3);opacity:.8}' +
      '#aic-research .aic-rsch-sumstat{font-size:12px;color:var(--v4-text-2,#7FA9C9)}' +
      '#aic-research .aic-rsch-rate{font-size:12px;font-weight:700;margin-left:auto;color:var(--v4-text,#EAF6FF)}' +
      '#aic-research .aic-rsch-rate.muted{font-weight:500;color:var(--v4-text-3,#4a6a85)}' +
      '#aic-research .aic-rsch-secthead{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--v4-text-3,#4a6a85);margin:14px 0 7px}' +
      '#aic-research .aic-pend-pill.aic-rsch-ok{background:rgba(46,160,67,.16);color:#3fb950}' +
      '#aic-research .aic-pend-pill.aic-rsch-bad{background:rgba(248,81,73,.16);color:#f85149}' +
      '#aic-research .aic-pend-pill.aic-rsch-mid{background:rgba(210,153,34,.16);color:#d29922}' +
      '#aic-research .aic-rsch-move{font-size:12px;color:var(--v4-text-2,#7FA9C9)}' +
      '#aic-research .aic-rsch-move .fav{color:#3fb950;font-weight:600}' +
      '#aic-research .aic-rsch-move .adv{color:#f85149;font-weight:600}' +
      '#aic-research .aic-rsch-q{font-size:8.5px;font-weight:800;padding:1px 6px;border-radius:6px;border:1px solid;margin-right:4px}' +
      '#aic-research .aic-rsch-times{font-size:9px;color:var(--v4-text-3,#5b7a94);margin-left:4px}' +
      '.aic-rs-host{display:block;width:100%}' +
      '.aic-rs{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0 4px;width:100%}' +
      '.aic-rs-box{background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.14);border-radius:9px;padding:8px 10px;text-align:center}' +
      '.aic-rs-v{font-size:16px;font-weight:800;font-family:ui-monospace,Menlo,monospace;color:var(--v4-text,#dfeefd)}' +
      '.aic-rs-l{font-size:8.5px;color:var(--v4-text-3,#5b7a94);letter-spacing:.04em;margin-top:3px;text-transform:uppercase}' +
      '.aic-oi{margin:10px 0 4px;padding:9px 11px;background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.18);border-radius:9px}' +
      '.aic-oi-title{font-size:9px;font-weight:800;letter-spacing:.06em;color:#00d4ff;margin-bottom:5px}' +
      '.aic-oi-row{display:flex;justify-content:space-between;font-size:11px;color:var(--v4-text-2,#7FA9C9);padding:2px 0}' +
      '.aic-oi-row .v{font-weight:700;font-family:ui-monospace,Menlo,monospace}' +
      '.aic-mh{margin:10px 0 4px;padding:10px 12px;background:rgba(127,119,221,.05);border:1px solid rgba(127,119,221,.3);border-radius:9px}' +
      '.aic-mh-title{font-size:9px;font-weight:800;letter-spacing:.06em;color:#afa9ec;margin-bottom:7px}' +
      '.aic-mh-new{font-size:8px;color:#cecbf6;background:#534ab7;padding:1px 7px;border-radius:8px;margin-left:5px}' +
      '.aic-mh-t{width:100%;font-size:11px;border-collapse:collapse;table-layout:fixed}' +
      '.aic-mh-head td{color:var(--v4-text-3,#5b7a94);font-size:9px;letter-spacing:.04em;padding:2px 0}' +
      '.aic-mh-r td{padding:4px 0;border-top:1px solid rgba(29,52,80,.8)}' +
      '.aic-mh-h{font-family:ui-monospace,Menlo,monospace;color:var(--v4-text,#dfeefd);width:36px}' +
      '.aic-mh-n{font-family:ui-monospace,Menlo,monospace;text-align:right;padding-right:8px}' +
      '.aic-mh-peak{background:rgba(0,212,255,.06)}' +
      '.aic-mh-peak .aic-mh-h{color:#00d4ff;font-weight:700}' +
      '.aic-mh-chip{font-size:9px;font-weight:800;padding:1px 7px;border-radius:8px;border:1px solid}' +
      '.aic-mh-bars{display:flex;align-items:flex-end;gap:14px;height:52px;margin:10px 2px 2px;border-bottom:1px solid rgba(29,52,80,.8)}' +
      '.aic-mh-bw{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end}' +
      '.aic-mh-bar{width:24px;border-radius:2px}' +
      '.aic-mh-bw span{font-size:9px;color:var(--v4-text-3,#5b7a94);font-family:ui-monospace,Menlo,monospace}' +
      '.aic-mh-sum{font-size:10.5px;color:var(--v4-text-2,#7fa9c9);margin-top:7px;line-height:1.5}' +
      '#aic-research .aic-rsch-due{font-size:11.5px;color:var(--v4-text-2,#7FA9C9)}' +
      '#aic-research .aic-rsch-due.ready{color:#E3B341;font-weight:600}' +
      '#aic-research .aic-rsch-ctx{font-size:11px;color:var(--v4-text-3,#4a6a85);font-family:var(--mono,monospace)}';
    const tag = document.createElement('style');
    tag.id = 'aic-rsch-style';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function _shell(inner) {
    const keyArea = _hasKey()
      ? ''
      : '<div class="aic-pend-keyrow">' +
          '<input type="password" class="aic-pend-key" data-rsch-key placeholder="Admin Key (oturum)" autocomplete="off">' +
          '<button class="aic-pend-keybtn" data-rsch-keyset type="button">Etkinleştir</button>' +
        '</div>';
    return '' +
      '<div class="aic-pend">' +
        '<div class="aic-pend-hdr">' +
          '<span class="aic-pend-title">🔬 Araştırma Katmanı <span class="aic-pend-tag">yalnızca admin</span></span>' +
          '<span id="aicRunnerStatsHost" class="aic-rs-host"></span>' +
          '<button class="aic-pend-refresh" data-rsch-load type="button">Yükle / Yenile</button>' +
        '</div>' +
        keyArea +
        '<div class="aic-pend-body" data-rsch-body>' + (inner || '') + '</div>' +
      '</div>';
  }

  function _sumRowHTML(tier, s) {
    const resolved = s.confirmed + s.invalidated + s.partial + s.other;
    let rate;
    if (resolved >= RATE_MIN_RESOLVED) {
      const r = Math.round((s.confirmed / resolved) * 100);
      rate = '<span class="aic-rsch-rate">doğrulanma %' + r + '</span>';
    } else {
      rate = '<span class="aic-rsch-rate muted">oran: az veri</span>';
    }
    const breakdown = resolved
      ? ' (' + s.confirmed + '🟢 ' + s.invalidated + '🔴' + (s.partial ? ' ' + s.partial + '🟡' : '') + ')'
      : '';
    return '<div class="aic-rsch-sumrow">' +
      _tierBadge(tier) +
      '<span class="aic-rsch-sumstat">' + s.total + ' kayıt · ' + s.pending + ' bekliyor · ' + resolved + ' çözüldü' + breakdown + '</span>' +
      rate +
    '</div>';
  }

  // Outcome Quality rozeti — 4 etiket (Volkan onaylı)
  function _qualityBadge(q) {
    if (!q) return '';
    const M = {
      clean_confirmed:            { t: _t('rp.qClean', null, 'Temiz Confirm'),        c: '#36d399' },
      confirmed_then_reversed:    { t: _t('rp.qReversed', null, 'Confirm → Geri Döndü'), c: '#ff8a3d' },
      invalidated_then_recovered: { t: _t('rp.qRecovered', null, 'Invalid → Toparladı'), c: '#00d4ff' },
      clean_invalidated:          { t: _t('rp.qCleanInv', null, 'Temiz Invalid'),     c: '#8b98ac' },
    };
    const m = M[q]; if (!m) return '';
    return '<span class="aic-rsch-q" style="color:' + m.c + ';border-color:' + m.c + '55;background:' + m.c + '14" title="Outcome Quality">' + m.t + '</span> ';
  }

  function _cardHTML(rec) {
    const mc = rec.market_context || {};
    const score = rec.analysis_score != null ? (rec.analysis_score + '/100') : '—';
    const os = rec.outcome_status || 'pending';
    const resolved = (os !== 'pending');
    const ageSec = mc.stage_age_sec;
    const ageStr = (ageSec != null && !isNaN(Number(ageSec)))
      ? (Number(ageSec) < 90 ? Number(ageSec) + ' sn' : Math.round(Number(ageSec) / 60) + ' dk')
      : '—';
    const regime = mc.regime ? _esc(mc.regime) : '—';

    // 5. satır: çözülmüşse hareket sonucu, bekliyorsa sonuç penceresine kalan süre
    let outcomeLine;
    if (resolved) {
      // ── OUTCOME INTELLIGENCE satırı: MFE/MAE + Kapanış + süreler ──
      const wc = rec.window_close_pct;
      const wcCls = (wc != null && wc >= 0) ? 'fav' : 'adv';
      const wcStr = (wc != null) ? ' · Kapanış <span class="' + wcCls + '">' + _pct(wc) + '</span>' : '';
      const ttc = rec.time_to_confirm_min, tti = rec.time_to_invalid_min;
      const tStr = (ttc != null || tti != null)
        ? '<span class="aic-rsch-times">' + (ttc != null ? '↑' + ttc + 'dk' : '') + (ttc != null && tti != null ? ' · ' : '') + (tti != null ? '↓' + tti + 'dk' : '') + '</span>'
        : '';
      outcomeLine = '<span class="aic-rsch-move">' + _qualityBadge(rec.outcome_quality) + 'Lehte <span class="fav">' + _pct(rec.max_favorable_move_pct) + '</span> · Aleyhte <span class="adv">' + _pct(rec.max_adverse_move_pct) + '</span>' + wcStr + ' ' + tStr + '</span>';
    } else {
      const due = rec.review_due_at ? new Date(rec.review_due_at).getTime() : null;
      outcomeLine = (due != null && !isNaN(due) && due <= Date.now())
        ? '<span class="aic-rsch-due ready">📊 5 saat doldu — sıradaki turda çözülecek</span>'
        : '<span class="aic-rsch-due">⏳ Sonuç: ' + _esc(_relFuture(rec.review_due_at)) + '</span>';
    }

    // Yapı bekleyen-inceleme kartıyla AYNI (7 satır) → aynı yükseklik/boyut.
    return '' +
      '<div class="aic-pend-card">' +
        '<span class="aic-pend-toprow">' +
          '<span class="aic-pend-sym">' + _esc(rec.sym) + '</span>' +
          _statusPill(os) +
        '</span>' +
        '<span class="aic-pend-meta">auto · ' + _esc(_dirLabel(rec.direction_bias)) + '</span>' +
        '<span class="aic-pend-meta">' + _tierBadge(rec.radar_tier_at_open) + ' · Skor: ' + _esc(score) + '</span>' +
        '<span class="aic-pend-rel">⏱ Açıldı: ' + _esc(_relTime(rec.created_at)) + '</span>' +
        outcomeLine +
        '<span class="aic-rsch-ctx">rejim: ' + regime + ' · açılışta yaş: ' + ageStr + '</span>' +
        '<span class="aic-pend-date">' + _esc(_fmtDT(rec.created_at)) + '</span>' +
      '</div>';
  }

  function _renderBody(body, data) {
    const sum = data.summary || {};
    const bt = sum.byTier || {};
    const overall = sum.overall || { total: 0 };
    let html = '<div class="aic-rsch-intro">Gizli araştırma havuzu — public track record\'a <b>karışmaz</b>, yalnız sana görünür. Amaç: hangi kademe / skor bandı daha çok doğruluyor, onu ölçmek.</div>';
    html += '<div class="aic-rsch-sum">';
    ['CONFIRMED', 'ARMED', 'WATCH'].forEach((t) => { if (bt[t]) html += _sumRowHTML(t, bt[t]); });
    if (bt.UNKNOWN && bt.UNKNOWN.total) html += _sumRowHTML('UNKNOWN', bt.UNKNOWN);
    html += '</div>';
    html += '<div class="aic-rsch-secthead">Toplam ' + (overall.total || 0) + ' kayıt' + (sum.capped ? '+' : '') + ' · son ' + (data.shown || 0) + ' tanesi aşağıda</div>';

    const recent = data.recent || [];
    if (!recent.length) {
      html += '<div class="aic-pend-empty">Henüz araştırma kaydı yok. Tarama sayfasında admin girişi yapınca otomatik toplanır.</div>';
    } else {
      const groups = { CONFIRMED: [], ARMED: [], WATCH: [], UNKNOWN: [] };
      recent.forEach((r) => {
        const t = (r.radar_tier_at_open === 'CONFIRMED' || r.radar_tier_at_open === 'ARMED' || r.radar_tier_at_open === 'WATCH') ? r.radar_tier_at_open : 'UNKNOWN';
        groups[t].push(r);
      });
      ['CONFIRMED', 'ARMED', 'WATCH', 'UNKNOWN'].forEach((t) => {
        if (!groups[t].length) return;
        html += '<div class="aic-rsch-secthead">' + _esc(t) + ' (' + groups[t].length + ')</div>';
        html += '<div class="aic-pend-grid">' + groups[t].map(_cardHTML).join('') + '</div>';
      });
    }
    body.innerHTML = html;
  }

  let _busy = false;
  async function _load(root) {
    if (_busy) return;
    const body = root.querySelector('[data-rsch-body]');
    const d = _disp();
    if (!_hasKey()) { if (body) body.innerHTML = '<div class="aic-pend-empty">Görüntülemek için admin anahtarını etkinleştirin.</div>'; return; }
    if (!d || typeof d.adminFetch !== 'function') { if (body) body.innerHTML = '<div class="aic-pend-empty">Admin sistemi yüklenmedi.</div>'; return; }
    _busy = true;
    if (body) body.innerHTML = '<div class="aic-pend-empty">Yükleniyor…</div>';
    try {
      const r = await d.adminFetch(API, { action: 'list_research', limit: 120 });
      if (r && r.ok) { if (body) _renderBody(body, r); }
      else if (body) { body.innerHTML = '<div class="aic-pend-empty">Yüklenemedi: ' + _esc((r && r.error) || 'bilinmiyor') + '</div>'; }
    } catch (e) {
      if (body) body.innerHTML = '<div class="aic-pend-empty">İstek başarısız.</div>';
    } finally { _busy = false; }
  }

  function _wire(root) {
    const loadBtn = root.querySelector('[data-rsch-load]');
    if (loadBtn) loadBtn.addEventListener('click', () => _load(root));
    const keyBtn = root.querySelector('[data-rsch-keyset]');
    if (keyBtn) {
      keyBtn.addEventListener('click', () => {
        const inp = root.querySelector('[data-rsch-key]');
        const d = _disp();
        if (d && typeof d.setAdminKey === 'function' && d.setAdminKey((inp && inp.value || '').trim())) {
          mount();
          const r2 = document.getElementById(CONTAINER);
          if (r2) _load(r2);
        }
      });
    }
  }

  // ── REVIEW RUNNER İSTATİSTİK ŞERİDİ ─────────────────────────────────
  // Kuyruk sağlığı: Pending / Due / Bugün / Son Saat / ETA / Sağlık.
  // runner_stats action'ından gelir; 60 sn'de bir tazelenir.
  const HEALTH_MAP = {
    HEALTHY:  { t: 'SAĞLIKLI',     c: '#36d399' },
    CLEARING: { t: 'TEMİZLENİYOR', c: '#00d4ff' },
    BACKLOG:  { t: 'BİRİKME',      c: '#ff8a3d' },
    CRITICAL: { t: 'KRİTİK',       c: '#f85149' },
  };
  function _etaTxt(h) {
    if (h == null) return '—';
    if (h < 1) return Math.round(h * 60) + ' dk';
    if (h < 48) return h.toFixed(1) + ' saat';
    return (h / 24).toFixed(1) + ' gün';
  }
  function _statsHTML(d) {
    const hm = HEALTH_MAP[d.health] || { t: d.health || '—', c: 'var(--v4-text-2)' };
    const box = (lbl, val, col) =>
      '<div class="aic-rs-box"><div class="aic-rs-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + val + '</div><div class="aic-rs-l">' + lbl + '</div></div>';
    return '<div class="aic-rs" id="aicRunnerStats">' +
      box('Pending', d.pending) +
      box('Due (süresi dolmuş)', d.due, d.due > 0 ? '#ff8a3d' : '#36d399') +
      box('Bugün Çözülen', d.processed_today, '#36d399') +
      box('Son 1 Saat', d.processed_last_hour) +
      box('Temizlenme (ETA)', _etaTxt(d.eta_hours), d.eta_hours != null && d.eta_hours > 48 ? '#f85149' : null) +
      box('Kuyruk Sağlığı', '<span style="color:' + hm.c + '">●</span> ' + hm.t, hm.c) +
      '</div>';
  }
  let _rsTimer = null;
  async function _loadStats(el) {
    const d = window.TelegramDispatcher;
    if (!d || typeof d.adminFetch !== 'function') return;
    try {
      const r = await d.adminFetch(API, { action: 'runner_stats' });
      if (!r || !r.ok) return;
      const host = el.querySelector('#aicRunnerStatsHost');
      if (host) host.innerHTML = _statsHTML(r);
    } catch (e) {}
  }

  function mount() {
    const el = document.getElementById(CONTAINER);
    if (!el) return;
    if (!_isAdmin()) { el.innerHTML = ''; el.hidden = true; return; }   // normal kullanıcı: hiç görmez
    _injectStyle();
    el.hidden = false;
    el.innerHTML = _shell('<div class="aic-pend-empty">"Yükle / Yenile" ile araştırma kayıtlarını getirin.</div>');
    _wire(el);
    if (_hasKey()) _load(el);   // key hazırsa otomatik getir
    _loadStats(el);
    if (_rsTimer) clearInterval(_rsTimer);
    _rsTimer = setInterval(function () { _loadStats(el); }, 60_000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  NS.Research = {
    mount: mount,
    refresh: function () { const el = document.getElementById(CONTAINER); if (el && _isAdmin()) _load(el); }
  };
})();
