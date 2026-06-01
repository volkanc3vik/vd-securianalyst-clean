// ════════════════════════════════════════════════════════════════════
// ui/academy/academy.js  — VD Academy render (Phase 2)
//
// Bölümler: Teori · Grafikte Görünüm · Trader Anlamı · Riskli Hata ·
//   📈 Gerçek Örnekler (Timeline) · 📊 Sonuç İstatistiği (Archive) ·
//   🕒 Son Timeline Olayları · 📈 Grafikte Göster (Phase 3 stub)
//
// Free   : teori + İLK örnek (1 coin)
// Premium: tüm örnekler + outcome + başarı oranı + son timeline + grafikte göster
// Render-only. Scanner/Timeline/Archive/Access/Funnel'a DOKUNMAZ (yalnız okuma).
// window.VDAcademy
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const D = () => window.VDAcademyData || { categories: [], lessons: [] };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const LEVEL = { temel:{label:'Temel',cls:'lvl-temel'}, orta:{label:'Orta',cls:'lvl-orta'}, ileri:{label:'İleri',cls:'lvl-ileri'} };

  let _filter = 'all', _query = '';

  function _access() { try { if (window.VDAccess && window.VDAccess.level) return window.VDAccess.level(); } catch (e) {} return 'free'; }
  function _isPremium() { const a = _access(); return a === 'premium' || a === 'admin'; }

  function _rel(ts) {
    const m = Math.floor((Date.now() - (+ts || 0)) / 60000);
    if (m < 1) return 'az önce'; if (m < 60) return m + ' dk önce';
    const h = Math.floor(m / 60); if (h < 24) return h + ' sa önce';
    return Math.floor(h / 24) + ' gün önce';
  }

  // ── Kart ──
  function _card(les) {
    const lv = LEVEL[les.level] || LEVEL.temel;
    const premium = _isPremium();
    const tags = (les.events || []).map(t => `<span class="ac-evtag" data-evtag>🔗 ${esc(t)}</span>`).join('');

    // Örnekler placeholder (hydrate ile dolar)
    const examplesBox = `<div class="ac-sec"><div class="ac-sec-lbl">📈 Gerçek Örnekler</div><div class="ac-examples" data-examples>…</div></div>`;

    if (!premium) {
      // FREE: teori + ilk örnek + kilit
      return `
      <article class="ac-card" data-cat="${esc(les.cat)}" data-level="${esc(les.level)}" data-id="${esc(les.id)}">
        <div class="ac-card-head">
          <div class="ac-badges"><span class="ac-lvl ${lv.cls}">${lv.label}</span>${les.level==='ileri'?'<span class="ac-prem-badge">Premium</span>':''}</div>
          <h3 class="ac-title">${esc(les.title)}</h3>
          <div class="ac-short">${esc(les.short)}</div>
        </div>
        <div class="ac-sec"><div class="ac-sec-lbl">📈 Gerçek Örnekler</div><div class="ac-examples" data-examples data-free="1">…</div></div>
        <div class="ac-lock">
          <div class="ac-lock-ic">🔒</div>
          <div class="ac-lock-tx">Grafikte görünüm · trader anlamı · risk notu · <b>tüm örnekler</b> · başarı oranı ve son Timeline olayları <b>Premium</b> üyeler içindir.</div>
          <button class="ac-lock-btn" type="button" data-ac-premium>🚀 Premium'a Geç</button>
        </div>
      </article>`;
    }

    // PREMIUM: tam içerik
    return `
      <article class="ac-card" data-cat="${esc(les.cat)}" data-level="${esc(les.level)}" data-id="${esc(les.id)}">
        <div class="ac-card-head">
          <div class="ac-badges"><span class="ac-lvl ${lv.cls}">${lv.label}</span></div>
          <h3 class="ac-title">${esc(les.title)}</h3>
          <div class="ac-short">${esc(les.short)}</div>
        </div>
        <div class="ac-detail">
          <div class="ac-d-row"><div class="ac-d-lbl">📈 Grafikte nasıl görünür?</div><div class="ac-d-val">${esc(les.chart)}</div></div>
          <div class="ac-d-row"><div class="ac-d-lbl">🎯 Trader için ne anlama gelir?</div><div class="ac-d-val">${esc(les.trader)}</div></div>
          <div class="ac-d-row ac-d-warn"><div class="ac-d-lbl">⚠️ Riskli yorumlama hatası</div><div class="ac-d-val">${esc(les.mistake)}</div></div>
        </div>
        ${examplesBox}
        <div class="ac-sec"><div class="ac-sec-lbl">📊 Sonuç İstatistiği <span class="ac-sec-sub">(son 30 gün)</span></div><div class="ac-outcome" data-outcome>…</div></div>
        <div class="ac-sec" data-condstat hidden><div class="ac-sec-lbl">📊 Enrichment Başarısı <span class="ac-sec-sub">(arşiv geneli)</span></div><div class="ac-condstat">…</div></div>
        <div class="ac-sec ac-tl-sec">
          <div class="ac-sec-lbl">🕒 Son Timeline Olayları ${tags ? `<span class="ac-evtags-inline">${tags}</span>` : ''}</div>
          <div class="ac-timeline" data-timeline>…</div>
        </div>
        <button class="ac-chart-btn" type="button" data-ac-chart data-id="${esc(les.id)}">📈 Grafikte Göster →</button>
      </article>`;
  }

  // ── Hydration: Timeline örnekleri + Archive outcome ──
  function _hydrateCard(cardEl) {
    const id = cardEl.dataset.id;
    const B = window.VDAcademyBridge;
    if (!B) return;
    const ex = B.examplesFor(id);

    // Gerçek örnekler
    const exBox = cardEl.querySelector('[data-examples]');
    if (exBox) {
      const free = exBox.dataset.free === '1';
      const coins = free ? ex.coins.slice(0, 1) : ex.coins.slice(0, 12);
      if (coins.length) {
        exBox.innerHTML = coins.map(c => `<span class="ac-coin">${esc(c)}</span>`).join('')
          + (free && ex.coins.length > 1 ? `<span class="ac-coin ac-coin-more">+${ex.coins.length - 1} · Premium</span>` : '')
          + (!free ? `<span class="ac-ex-count">${ex.count} olayda görüldü</span>` : '');
      } else {
        exBox.innerHTML = '<span class="ac-ex-empty">Henüz kayıtlı örnek yok — tarama biriktikçe burada görünecek.</span>';
      }
    }

    // Son Timeline olayları (premium)
    const tlBox = cardEl.querySelector('[data-timeline]');
    if (tlBox) {
      if (ex.events.length) {
        tlBox.innerHTML = ex.events.map(e => `<div class="ac-tl-row" data-ac-tl data-coin="${esc(e.sym)}" data-id="${esc(id)}" title="Grafikte Göster"><span class="ac-tl-coin">${esc(e.sym)}</span><span class="ac-tl-msg">${esc(e.msg||'')}</span><span class="ac-tl-time">${_rel(e.ts)}</span><span class="ac-tl-go">📈</span></div>`).join('');
      } else {
        tlBox.innerHTML = '<span class="ac-ex-empty">İlgili Timeline olayı henüz yok.</span>';
      }
    }
  }

  function _hydrateOutcome() {
    const B = window.VDAcademyBridge; if (!B) return;
    B.loadArchive().then(() => {
      document.querySelectorAll('.ac-card [data-outcome]').forEach(box => {
        const card = box.closest('.ac-card'); if (!card) return;
        const les = D().lessons.find(l => l.id === card.dataset.id); if (!les) return;
        const o = B.outcomeFor(les);
        if (o) {
          box.innerHTML = `
            <div class="ac-oc-grid">
              <div class="ac-oc"><div class="ac-oc-v">${o.total}</div><div class="ac-oc-l">olay</div></div>
              <div class="ac-oc ok"><div class="ac-oc-v">${o.validated}</div><div class="ac-oc-l">doğrulandı</div></div>
              <div class="ac-oc warn"><div class="ac-oc-v">${o.partial}</div><div class="ac-oc-l">kısmi</div></div>
              <div class="ac-oc bad"><div class="ac-oc-v">${o.rejected}</div><div class="ac-oc-l">başarısız</div></div>
              <div class="ac-oc rate"><div class="ac-oc-v">%${o.rate}</div><div class="ac-oc-l">başarı</div></div>
            </div>`;
        } else {
          box.innerHTML = '<span class="ac-ex-empty">Bu yapı için yeterli sonuç verisi yok.</span>';
        }
      });
    });
  }

  function _hydrateCondStat() {
    const B = window.VDAcademyBridge; if (!B || !B.loadStats) return;
    B.loadStats().then(() => {
      document.querySelectorAll('.ac-card [data-condstat]').forEach(sec => {
        const card = sec.closest('.ac-card'); if (!card) return;
        let s = null; try { s = B.conditionStatFor(card.dataset.id); } catch (e) {}
        if (!s) { sec.remove(); return; }              // bu ders için eşleme yok → bölümü kaldır
        const box = sec.querySelector('.ac-condstat'); if (!box) return;
        sec.removeAttribute('hidden');
        if (s.state === 'ok') {
          box.innerHTML = `<div class="ac-oc-grid">
              <div class="ac-oc"><div class="ac-oc-v">${s.n}</div><div class="ac-oc-l">örnek</div></div>
              <div class="ac-oc rate"><div class="ac-oc-v">%${s.rate}</div><div class="ac-oc-l">başarı</div></div>
            </div>${s.label ? `<div class="ac-ex-count">${esc(s.label)}</div>` : ''}`;
        } else if (s.state === 'insufficient') {
          box.innerHTML = `<span class="ac-ex-empty">Yetersiz Veri (n=${s.n || 0} · min 20).</span>`;
        } else {
          box.innerHTML = '<span class="ac-ex-empty">Veri Toplanıyor — v76 sonrası kayıtlardan dolar.</span>';
        }
      });
    });
  }

  // ── Filtre + arama ──
  function _visible(les) {
    if (_filter !== 'all' && les.cat !== _filter) return false;
    if (_query) { const q = _query.toLowerCase(); const hay = (les.title + ' ' + les.short + ' ' + (les.events||[]).join(' ')).toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  }
  function _renderGrid() {
    const grid = document.getElementById('acGrid'); if (!grid) return;
    const list = D().lessons.filter(_visible);
    grid.innerHTML = list.length ? list.map(_card).join('') : '<div class="ac-empty">Aramanıza uygun ders bulunamadı.</div>';
    const cnt = document.getElementById('acCount'); if (cnt) cnt.textContent = list.length + ' ders';
    // hydrate
    grid.querySelectorAll('.ac-card').forEach(_hydrateCard);
    if (_isPremium()) _hydrateOutcome();
    if (_isPremium()) _hydrateCondStat();
  }
  function _renderFilters() {
    const wrap = document.getElementById('acFilters'); if (!wrap) return;
    const btn = (id,label,icon) => `<button class="ac-filter${_filter===id?' active':''}" data-cat="${id}" type="button">${icon?icon+' ':''}${esc(label)}</button>`;
    wrap.innerHTML = btn('all','Tümü','◈') + D().categories.map(c => btn(c.id, c.label, c.icon)).join('');
  }

  function _gotoChart(lessonId, sym) {
    // örnek coin yoksa makul bir varsayılan ile yine grafiğe gidip katmanı aç
    const finalSym = (sym && sym.replace(/USDT$/,'') ? sym : 'BTCUSDT');
    try { sessionStorage.setItem('vd_academy_chart_intent', JSON.stringify({ lesson: lessonId, sym: finalSym, ts: Date.now() })); } catch (e) {}
    location.href = 'index.html?lesson=' + encodeURIComponent(lessonId) + '&sym=' + encodeURIComponent(finalSym);
  }

  function _wire() {
    document.getElementById('acFilters')?.addEventListener('click', e => {
      const b = e.target.closest('.ac-filter'); if (!b) return;
      _filter = b.dataset.cat; _renderFilters(); _renderGrid();
    });
    const s = document.getElementById('acSearch');
    if (s) s.addEventListener('input', () => { _query = s.value.trim(); _renderGrid(); });
    document.getElementById('acGrid')?.addEventListener('click', e => {
      if (e.target.closest('[data-ac-premium]')) {
        if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin(); else location.href = 'index.html#premium';
        return;
      }
      // Timeline olay etiketine tıkla → kartın timeline bölümünü vurgula
      const tag = e.target.closest('[data-evtag]');
      if (tag) { const sec = tag.closest('.ac-card')?.querySelector('.ac-tl-sec'); if (sec) { sec.classList.add('ac-flash'); sec.scrollIntoView({behavior:'smooth',block:'nearest'}); setTimeout(()=>sec.classList.remove('ac-flash'),1200); } return; }
      // Timeline olayı satırı → o coin ile grafik köprüsü
      const row = e.target.closest('[data-ac-tl]');
      if (row) { _gotoChart(row.dataset.id, (row.dataset.coin||'') + 'USDT'); return; }
      // Grafikte Göster
      const cb = e.target.closest('[data-ac-chart]');
      if (cb) {
        // Phase 3'te AI Grafik Analizi açılıp formasyon highlight edilecek.
        // Şimdilik ders+coin parametresiyle dashboard'a yönlendirme köprüsü (zararsız).
        const id = cb.dataset.id;
        const card = cb.closest('.ac-card');
        const firstCoin = card?.querySelector('.ac-coin:not(.ac-coin-more)')?.textContent?.trim();
        _gotoChart(id, firstCoin ? firstCoin + 'USDT' : '');
      }
    });
    window.addEventListener('vd:access:changed', () => { _renderGrid(); });
  }

  function init() {
    _renderFilters(); _renderGrid(); _wire();
    const lvl = document.getElementById('acAccess');
    if (lvl) { const a=_access(); const map={admin:'◈ Admin — tam erişim',premium:'◈ Premium — tam erişim',teaser:'◈ Önizleme',free:'◈ Free — temel erişim'}; lvl.textContent=map[a]||map.free; lvl.className='ac-access ac-access-'+a; }
  }

  window.VDAcademy = { init, _renderGrid };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
