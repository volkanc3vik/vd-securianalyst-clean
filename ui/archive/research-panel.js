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
  function _esc(s) { return (U.esc ? U.esc(s) : String(s == null ? '' : s)); }
  function _dirLabel(b) {
    if (U.directionLabel) return U.directionLabel(b);
    if (b === 'bullish') return 'LONG';
    if (b === 'bearish') return 'SHORT';
    return b || '—';
  }
  function _pct(v) { const n = Number(v); return (v == null || isNaN(n)) ? '—' : '%' + n; }
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
    const moveLine = resolved
      ? '<span class="aic-rsch-move">Lehte <span class="fav">' + _pct(rec.max_favorable_move_pct) + '</span> · Aleyhte <span class="adv">' + _pct(rec.max_adverse_move_pct) + '</span></span>'
      : '';
    return '' +
      '<div class="aic-pend-card">' +
        '<span class="aic-pend-toprow">' +
          '<span class="aic-pend-sym">' + _esc(rec.sym) + '</span>' +
          _statusPill(os) +
        '</span>' +
        '<span class="aic-pend-meta">' + _tierBadge(rec.radar_tier_at_open) + ' · ' + _esc(_dirLabel(rec.direction_bias)) + ' · Skor: ' + _esc(score) + '</span>' +
        moveLine +
        '<span class="aic-rsch-ctx">açılışta yaş: ' + ageStr + ' · rejim: ' + regime + ' · ' + _esc(_relTime(rec.created_at)) + '</span>' +
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

  function mount() {
    const el = document.getElementById(CONTAINER);
    if (!el) return;
    if (!_isAdmin()) { el.innerHTML = ''; el.hidden = true; return; }   // normal kullanıcı: hiç görmez
    _injectStyle();
    el.hidden = false;
    el.innerHTML = _shell('<div class="aic-pend-empty">"Yükle / Yenile" ile araştırma kayıtlarını getirin.</div>');
    _wire(el);
    if (_hasKey()) _load(el);   // key hazırsa otomatik getir
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  NS.Research = {
    mount: mount,
    refresh: function () { const el = document.getElementById(CONTAINER); if (el && _isAdmin()) _load(el); }
  };
})();
