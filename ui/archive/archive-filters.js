// ════════════════════════════════════════════════════════════════════
// VDArchive · FILTERS
// Coin (dinamik RPC), Durum, Zaman aralığı (created_at). State değişince
// onChange(state) çağrılır. Public'te pending durumu SEÇENEK olarak yok.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = NS.util;

  const RANGES = [
    { key: '7',   label: '7g'   },
    { key: '30',  label: '30g'  },
    { key: '90',  label: '90g'  },
    { key: 'all', label: _t('arc.all', null, 'Tümü') },
  ];
  const STATUS_OPTS = [
    { v: '',                    t: _t('arc.allStatuses', null, 'Tüm Durumlar')      },
    { v: 'validated',           t: _t('arc.validated', null, 'Doğrulandı')        },
    { v: 'partially_validated', t: _t('arc.partlyValidated', null, 'Kısmen Doğrulandı') },
    { v: 'not_validated',       t: _t('arc.notValidated', null, 'Doğrulanmadı')      },
  ];

  const state = { sym: '', status: '', range: 'all' };
  let _onChange = null;

  function sinceISO() {
    if (state.range === 'all') return null;
    const days = parseInt(state.range, 10);
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  function getState() {
    return { sym: state.sym, status: state.status, range: state.range, sinceISO: sinceISO() };
  }

  function _emit() { if (typeof _onChange === 'function') _onChange(getState()); }

  async function _buildCoinOptions() {
    let coins = [];
    try { coins = window.SupabaseDB ? await window.SupabaseDB.getArchiveCoins() : []; } catch (e) { coins = []; }
    const opts = ['<option value="">'+_t('arc.allCoins', null, 'Tüm Coinler')+'</option>'];
    (coins || []).forEach(c => {
      opts.push(`<option value="${U.esc(c.sym)}">${U.esc(c.sym)} (${c.cnt})</option>`);
    });
    return opts.join('');
  }

  async function render(containerId, onChange) {
    _onChange = onChange;
    const el = document.getElementById(containerId);
    if (!el) return;

    const coinOptions = await _buildCoinOptions();
    const statusOptions = STATUS_OPTS.map(o => `<option value="${o.v}">${U.esc(o.t)}</option>`).join('');
    const rangeBtns = RANGES.map(r =>
      `<button type="button" data-range="${r.key}" class="${state.range === r.key ? 'active' : ''}">${U.esc(r.label)}</button>`
    ).join('');

    el.innerHTML = `
      <div class="aic-filter-field">
        <span>Coin</span>
        <select class="aic-select" data-aic-filter="sym">${coinOptions}</select>
      </div>
      <div class="aic-filter-field">
        <span>Durum</span>
        <select class="aic-select" data-aic-filter="status">${statusOptions}</select>
      </div>
      <div class="aic-filter-field">
        <span>Zaman (analiz tarihi)</span>
        <div class="aic-range" role="group" aria-label="${_t('arc.timeRange', null, 'Zaman aralığı')}">${rangeBtns}</div>
      </div>
      <div class="aic-filter-spacer"></div>
      <div class="aic-result-count" data-aic-count></div>`;

    el.querySelector('[data-aic-filter="sym"]').addEventListener('change', (e) => { state.sym = e.target.value; _emit(); });
    el.querySelector('[data-aic-filter="status"]').addEventListener('change', (e) => { state.status = e.target.value; _emit(); });
    el.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.range = btn.getAttribute('data-range');
        el.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b === btn));
        _emit();
      });
    });
  }

  function setCount(text) {
    const c = document.querySelector('[data-aic-count]');
    if (c) c.textContent = text || '';
  }

  NS.Filters = { render, getState, setCount };
})();
