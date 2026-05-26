// ════════════════════════════════════════════════════════════════════
// TI WARNINGS CARD
// Genel piyasa + Best Setup uyarıları.
// Spam yok — controller zaten filtrelenmiş halini gönderiyor.
// ════════════════════════════════════════════════════════════════════
window.TIWarningsCard = (() => {
  'use strict';

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _iconFor(severity) {
    if (severity === 'high') return '⚠';
    if (severity === 'med')  return '!';
    return '·';
  }

  function render(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return ''; // boşsa kart hiç çıkmasın
    }

    const rows = warnings.map(w => {
      const sev  = w.severity || 'low';
      const icon = _iconFor(sev);
      return `
        <div class="ti-warn-row ${_esc(sev)}">
          <span class="ti-warn-icon">${icon}</span>
          <span>${_esc(w.msg || '')}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>UYARILAR</div>
        <div class="ti-warnings">${rows}</div>
      </div>
    `;
  }

  return { render };
})();
