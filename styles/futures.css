/* ════════════════════════════════════════════════════════════════════
   FUTURES MANUEL İŞLEM PANELİ — Tüm Stiller
   Mevcut neon/dark tema CSS değişkenleri ile uyumlu.
   ════════════════════════════════════════════════════════════════════ */

/* ── Container ─────────────────────────────────────────────────── */
.fp-container {
  background: rgba(8, 16, 28, .8);
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: 14px;
  padding: 14px 14px 12px;
  margin-top: 16px;
}

.fp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.fp-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.fp-count {
  font-size: 10px;
  padding: 2px 10px;
  background: rgba(0, 229, 160, .1);
  border: 1px solid rgba(0, 229, 160, .25);
  border-radius: 20px;
  color: var(--green);
  font-weight: 700;
}

.fp-count.zero {
  background: rgba(255, 255, 255, .04);
  border-color: rgba(255, 255, 255, .08);
  color: var(--text3);
}

.fp-balance {
  font-size: 10px;
  color: var(--text3);
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.fp-balance b {
  color: var(--text);
  font-family: 'Courier New', monospace;
  font-weight: 700;
}

.fp-balance-view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fp-balance-edit {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  transition: all .15s;
  line-height: 1;
}

.fp-balance-edit:hover {
  color: var(--cyan);
  border-color: rgba(0, 212, 255, .3);
  background: rgba(0, 212, 255, .06);
}

.fp-balance-edit-wrap {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, .35);
  border: 1px solid rgba(0, 212, 255, .35);
  border-radius: 6px;
  padding: 2px 6px;
}

.fp-balance-prefix {
  color: var(--text3);
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.fp-balance-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: 'Courier New', monospace;
  font-size: 11px;
  font-weight: 700;
  width: 90px;
  padding: 2px 0;
  -moz-appearance: textfield;
}

.fp-balance-input::-webkit-outer-spin-button,
.fp-balance-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.fp-balance-input.error {
  color: var(--red);
  animation: fpShakeX .25s ease-in-out;
}

@keyframes fpShakeX {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-3px); }
  75%      { transform: translateX(3px); }
}

.fp-balance-ok,
.fp-balance-cancel {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0 3px;
  line-height: 1;
}

.fp-balance-ok      { color: var(--green); }
.fp-balance-ok:hover { color: #00ffb0; }
.fp-balance-cancel   { color: var(--text3); }
.fp-balance-cancel:hover { color: var(--red); }

.fp-balance-tip {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: rgba(255, 61, 107, .14);
  color: var(--red);
  border: 1px solid rgba(255, 61, 107, .35);
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
  z-index: 50;
  display: none;
}

.fp-btn-open {
  margin-left: auto;
  padding: 6px 14px;
  background: rgba(0, 212, 255, .1);
  border: 1px solid rgba(0, 212, 255, .35);
  border-radius: 8px;
  color: var(--cyan);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  font-family: Inter, sans-serif;
  transition: all .2s;
}

.fp-btn-open:hover {
  background: rgba(0, 212, 255, .18);
  border-color: rgba(0, 212, 255, .5);
  box-shadow: 0 0 14px rgba(0, 212, 255, .25);
}

/* ── Boş durum ─────────────────────────────────────────────────── */
.fp-empty {
  text-align: center;
  padding: 28px 16px;
  color: var(--text3);
}

.fp-empty-icon { font-size: 30px; margin-bottom: 8px; opacity: .6; }
.fp-empty-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--text2); }
.fp-empty-sub { font-size: 10px; opacity: .8; }

/* ════════════════════════════════════════════════════════════════
   POZİSYON KARTI
   ════════════════════════════════════════════════════════════════ */
.fp-card {
  background: rgba(5, 10, 20, .97);
  border: 1px solid rgba(255, 255, 255, .08);
  border-top-width: 2px;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  position: relative;
}

.fp-card.long  { border-top-color: var(--green); }
.fp-card.short { border-top-color: var(--red); }

.fp-card.warn-liq {
  animation: fpCardPulse 1.2s ease-in-out infinite;
  box-shadow: 0 0 24px rgba(255, 61, 107, .25);
}

@keyframes fpCardPulse {
  0%, 100% { box-shadow: 0 0 14px rgba(255, 61, 107, .15); }
  50%      { box-shadow: 0 0 28px rgba(255, 61, 107, .45); }
}

/* ── Üst şerit ─────────────────────────────────────────────────── */
.fp-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, .25);
  border-bottom: 1px solid rgba(255, 255, 255, .05);
  flex-wrap: wrap;
}

.fp-sym {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: .5px;
}

.fp-meta {
  font-size: 9px;
  color: var(--text3);
  margin-left: 4px;
  letter-spacing: .5px;
}

.fp-pill {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .5px;
}

.fp-pill.long  { background: rgba(0, 229, 160, .15); color: var(--green); border: 1px solid rgba(0, 229, 160, .35); }
.fp-pill.short { background: rgba(255, 61, 107, .15); color: var(--red);   border: 1px solid rgba(255, 61, 107, .35); }

.fp-warn {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .5px;
}
.fp-warn.liq { background: rgba(255, 61, 107, .15);  color: var(--red);    border: 1px solid rgba(255, 61, 107, .4); }
.fp-warn.sl  { background: rgba(255, 122, 0, .15);   color: var(--orange); border: 1px solid rgba(255, 122, 0, .4); }
.fp-warn.tp  { background: rgba(0, 212, 255, .12);   color: var(--cyan);   border: 1px solid rgba(0, 212, 255, .35); }

.fp-duration {
  margin-left: auto;
  font-size: 10px;
  color: var(--text3);
  font-family: 'Courier New', monospace;
}

.fp-btn-close {
  padding: 5px 12px;
  background: rgba(255, 61, 107, .1);
  border: 1px solid rgba(255, 61, 107, .35);
  border-radius: 6px;
  color: var(--red);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  font-family: Inter, sans-serif;
  transition: all .2s;
}

.fp-btn-close:hover {
  background: rgba(255, 61, 107, .2);
  box-shadow: 0 0 10px rgba(255, 61, 107, .3);
}

/* ── 3x3 Metrik Grid ───────────────────────────────────────────── */
.fp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, .04);
  border-bottom: 1px solid rgba(255, 255, 255, .05);
}

.fp-cell {
  padding: 11px 14px;
  background: rgba(5, 10, 20, .97);
}

.fp-cell-label {
  font-size: 9px;
  color: var(--text3);
  letter-spacing: 1.2px;
  margin-bottom: 4px;
  font-weight: 600;
}

.fp-cell-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  font-family: 'Courier New', monospace;
}

.fp-cell.hero .fp-cell-val { font-size: 18px; font-weight: 900; }
.fp-cell .fp-cell-val.pos   { color: var(--green); }
.fp-cell .fp-cell-val.neg   { color: var(--red); }
.fp-cell .fp-cell-val.warn  { color: var(--orange); }
.fp-cell .fp-cell-val.crit  { color: var(--red); }
.fp-cell .fp-cell-val.cyan  { color: var(--cyan); }
.fp-cell .fp-cell-val.muted { color: var(--text2); }

/* ════════════════════════════════════════════════════════════════
   PRICE BAR — Anahtar görsel öğe
   ════════════════════════════════════════════════════════════════ */
.fp-bar-wrap {
  padding: 18px 14px 14px;
  background: rgba(3, 6, 14, .9);
}

.fp-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: var(--text3);
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
}

.fp-bar-track {
  position: relative;
  height: 8px;
  margin-bottom: 38px;
  border-radius: 4px;
  overflow: visible;
}

.fp-bar-bg {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, .05);
}

.fp-bar-zone-sl {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(255, 61, 107, .35), rgba(255, 61, 107, .08));
}

.fp-bar-zone-profit {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(90deg, rgba(0, 229, 160, .08), rgba(0, 229, 160, .22));
}

/* Mark price marker — büyük canlı yeşil/kırmızı nokta */
.fp-bar-marker {
  position: absolute;
  top: -5px;
  z-index: 5;
  transform: translateX(-50%);
  transition: left .35s cubic-bezier(.22, 1, .36, 1);
}

.fp-bar-marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, .6);
  box-shadow: 0 0 10px currentColor;
  animation: fpDotPulse 1.6s ease-in-out infinite;
}

.fp-bar-marker.profit .fp-bar-marker-dot { background: var(--green); color: var(--green); }
.fp-bar-marker.loss   .fp-bar-marker-dot { background: var(--red);   color: var(--red); }

@keyframes fpDotPulse {
  0%, 100% { transform: scale(1);    box-shadow: 0 0 10px currentColor; }
  50%      { transform: scale(1.15); box-shadow: 0 0 18px currentColor; }
}

.fp-bar-marker-price {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 800;
  color: inherit;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  text-shadow: 0 1px 4px rgba(0, 0, 0, .8);
}

/* Level markers (SL, Entry, TP1, TP2, TP3) */
.fp-bar-level {
  position: absolute;
  top: -4px;
  transform: translateX(-50%);
  z-index: 3;
  text-align: center;
}

.fp-bar-level-tick {
  width: 2px;
  height: 16px;
  margin: 0 auto;
  background: currentColor;
  border-radius: 1px;
  opacity: .7;
}

.fp-bar-level.entry .fp-bar-level-tick {
  width: 3px;
  height: 20px;
  opacity: 1;
}

.fp-bar-level.hit .fp-bar-level-tick {
  opacity: 1;
  box-shadow: 0 0 10px currentColor;
  animation: fpLevelHit 1s ease-in-out infinite;
}

@keyframes fpLevelHit {
  0%, 100% { box-shadow: 0 0 6px currentColor;  opacity: .85; }
  50%      { box-shadow: 0 0 18px currentColor; opacity: 1; }
}

.fp-bar-level-label {
  font-size: 8px;
  font-weight: 800;
  color: inherit;
  margin-top: 4px;
  white-space: nowrap;
  letter-spacing: .5px;
}

.fp-bar-level-price {
  font-size: 8px;
  color: var(--text3);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  margin-top: 1px;
}

.fp-bar-level.sl     { color: var(--red); }
.fp-bar-level.entry  { color: var(--text); }
.fp-bar-level.tp1    { color: var(--green); }
.fp-bar-level.tp2    { color: var(--cyan); }
.fp-bar-level.tp3    { color: var(--purple); }

/* ── Alt durum çubuğu ──────────────────────────────────────────── */
.fp-status {
  padding: 10px 14px;
  background: rgba(0, 0, 0, .25);
  border-top: 1px solid rgba(255, 255, 255, .04);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.fp-status-msg {
  font-size: 10px;
  color: var(--text2);
  font-weight: 600;
}

.fp-status-legend {
  font-size: 9px;
  color: var(--text3);
  display: flex;
  gap: 12px;
}

.fp-status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fp-status-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.fp-status-progress {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
}

/* TP/SL hit badge'leri */
.fp-hit-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .5px;
  animation: fpBadgeFlash .8s ease-in-out;
}

.fp-hit-badge.tp { background: rgba(0, 229, 160, .2); color: var(--green); border: 1px solid var(--green); }
.fp-hit-badge.sl { background: rgba(255, 61, 107, .2); color: var(--red);   border: 1px solid var(--red); }

@keyframes fpBadgeFlash {
  0%   { transform: scale(.6); opacity: 0; }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

/* ════════════════════════════════════════════════════════════════
   MODAL (Manuel İşlem Aç)
   ════════════════════════════════════════════════════════════════ */
.fm-overlay {
  position: fixed;
  inset: 0;
  z-index: 99990;
  background: rgba(0, 0, 0, .82);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fmFadeIn .2s ease;
}

@keyframes fmFadeIn { from { opacity: 0; } to { opacity: 1; } }

.fm-modal {
  background: rgba(5, 10, 20, .99);
  border: 1px solid rgba(255, 255, 255, .1);
  border-top: 2px solid var(--green);
  border-radius: 14px;
  padding: 20px;
  width: 100%;
  max-width: 440px;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 32px 80px rgba(0, 0, 0, .95);
  animation: fmSlideIn .25s cubic-bezier(.22, 1, .36, 1);
}

.fm-modal.short { border-top-color: var(--red); }

@keyframes fmSlideIn {
  from { transform: translateY(20px) scale(.97); opacity: 0; }
  to   { transform: translateY(0) scale(1);     opacity: 1; }
}

.fm-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.fm-head-sym {
  font-size: 15px;
  font-weight: 900;
  color: var(--text);
}

.fm-x {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text3);
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 8px;
}
.fm-x:hover { color: var(--text); }

/* Yön toggle */
.fm-dir-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.fm-dir-btn {
  padding: 9px 0;
  background: rgba(255, 255, 255, .03);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 8px;
  color: var(--text2);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  font-family: Inter, sans-serif;
  letter-spacing: 1px;
  transition: all .2s;
}

.fm-dir-btn.active.long {
  background: rgba(0, 229, 160, .15);
  border-color: var(--green);
  color: var(--green);
  box-shadow: 0 0 12px rgba(0, 229, 160, .25);
}

.fm-dir-btn.active.short {
  background: rgba(255, 61, 107, .15);
  border-color: var(--red);
  color: var(--red);
  box-shadow: 0 0 12px rgba(255, 61, 107, .25);
}

/* Mode toggle (Cross/Isolated) */
.fm-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 10px;
  color: var(--text3);
}

.fm-mode-btn {
  padding: 5px 12px;
  background: rgba(255, 255, 255, .03);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 6px;
  color: var(--text2);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  font-family: Inter, sans-serif;
  letter-spacing: .5px;
  transition: all .2s;
}

.fm-mode-btn.active {
  background: rgba(0, 212, 255, .12);
  border-color: var(--cyan);
  color: var(--cyan);
}

.fm-balance-disp {
  margin-left: auto;
  font-size: 11px;
  color: var(--text2);
  font-family: 'Courier New', monospace;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.fm-balance-disp b { color: var(--text); }

.fm-balance-view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fm-balance-edit {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all .15s;
  line-height: 1;
}

.fm-balance-edit:hover {
  color: var(--cyan);
  border-color: rgba(0, 212, 255, .3);
  background: rgba(0, 212, 255, .06);
}

.fm-balance-edit-wrap {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, .35);
  border: 1px solid rgba(0, 212, 255, .35);
  border-radius: 6px;
  padding: 3px 7px;
}

.fm-balance-prefix {
  color: var(--text3);
  font-size: 11px;
}

.fm-balance-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: 700;
  width: 100px;
  padding: 2px 0;
  -moz-appearance: textfield;
}

.fm-balance-input::-webkit-outer-spin-button,
.fm-balance-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.fm-balance-input.error {
  color: var(--red);
  animation: fpShakeX .25s ease-in-out;
}

.fm-balance-ok,
.fm-balance-cancel {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  line-height: 1;
}

.fm-balance-ok       { color: var(--green); }
.fm-balance-ok:hover  { color: #00ffb0; }
.fm-balance-cancel    { color: var(--text3); }
.fm-balance-cancel:hover { color: var(--red); }

.fm-balance-tip {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: rgba(255, 61, 107, .14);
  color: var(--red);
  border: 1px solid rgba(255, 61, 107, .35);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
  z-index: 50;
  display: none;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Form */
.fm-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.fm-field { display: flex; flex-direction: column; }

.fm-field-label {
  font-size: 9px;
  color: var(--text3);
  letter-spacing: 1px;
  margin-bottom: 4px;
  font-weight: 600;
}

.fm-input {
  width: 100%;
  background: rgba(255, 255, 255, .04);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--text);
  font-size: 12px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  box-sizing: border-box;
  transition: border-color .15s;
}
.fm-input:focus { outline: none; border-color: rgba(0, 212, 255, .5); }

.fm-input.sl  { color: var(--red); }
.fm-input.tp1 { color: var(--green); }
.fm-input.tp2 { color: var(--cyan); }
.fm-input.tp3 { color: var(--purple); }

.fm-readout {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0, 212, 255, .06);
  border: 1px solid rgba(0, 212, 255, .25);
  border-radius: 8px;
  color: var(--cyan);
  font-size: 12px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  box-sizing: border-box;
}

/* Likidasyon önizleme */
.fm-liq {
  font-size: 10px;
  text-align: center;
  margin-bottom: 14px;
  padding: 8px 10px;
  background: rgba(255, 122, 0, .08);
  border: 1px solid rgba(255, 122, 0, .25);
  border-radius: 8px;
  color: var(--orange);
  line-height: 1.6;
}

.fm-error {
  font-size: 11px;
  color: var(--red);
  background: rgba(255, 61, 107, .08);
  border: 1px solid rgba(255, 61, 107, .25);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 12px;
  text-align: center;
  font-weight: 600;
}

.fm-cta {
  width: 100%;
  padding: 13px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  font-family: Inter, sans-serif;
  letter-spacing: 1.2px;
  transition: all .2s;
}

.fm-cta.long {
  background: linear-gradient(90deg, rgba(0, 229, 160, .18), rgba(0, 229, 160, .08));
  border-color: rgba(0, 229, 160, .5);
  color: var(--green);
}
.fm-cta.long:hover  { box-shadow: 0 0 22px rgba(0, 229, 160, .35); }

.fm-cta.short {
  background: linear-gradient(90deg, rgba(255, 61, 107, .18), rgba(255, 61, 107, .08));
  border-color: rgba(255, 61, 107, .5);
  color: var(--red);
}
.fm-cta.short:hover { box-shadow: 0 0 22px rgba(255, 61, 107, .35); }

/* ════════════════════════════════════════════════════════════════
   MOBİL
   ════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .fp-grid { grid-template-columns: repeat(2, 1fr); }
  .fp-cell.hero .fp-cell-val { font-size: 16px; }
  .fp-card-top { padding: 8px 10px; gap: 6px; }
  .fp-sym { font-size: 13px; }
  .fp-bar-wrap { padding: 14px 10px 12px; }
  .fp-bar-level-label { font-size: 7px; }
  .fp-bar-level-price { font-size: 7px; }
  .fp-btn-open { padding: 5px 10px; font-size: 10px; }

  .fm-modal { padding: 16px; }
  .fm-form { grid-template-columns: 1fr; }
}

@media (max-width: 420px) {
  .fp-grid { grid-template-columns: 1fr; }
  .fp-cell.hero .fp-cell-val { font-size: 18px; }
}
