/* ════════════════════════════════════════════════════════════════════
   VD FUNNEL CSS (Mini-Aşama B.2)
   - Welcome toast (Telegram referans karşılama)
   - TI panel click hover (sembol tıklanabilir)
   ════════════════════════════════════════════════════════════════════ */

/* ════════════ WELCOME TOAST ════════════ */
.vd-welcome-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9995;
  max-width: 360px;
  min-width: 280px;
  background: rgba(11, 15, 22, 0.96);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* Cyan border — ayırt edici stil */
  border: 1px solid rgba(0, 212, 255, 0.45);
  border-left: 3px solid var(--cyan, #00d4ff);
  border-radius: 8px;
  padding: 12px 16px 12px 14px;
  box-shadow: 0 6px 24px rgba(0, 212, 255, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  color: var(--text, #e6ecf3);
  cursor: pointer;
  transform: translateX(calc(100% + 32px));
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s;
  opacity: 0;
}

.vd-welcome-toast.vd-welcome-toast-visible {
  transform: translateX(0);
  opacity: 1;
}

.vd-welcome-toast-hide {
  opacity: 0 !important;
  transform: translateX(20px) !important;
}

.vd-welcome-toast-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cyan, #00d4ff);
  margin-bottom: 4px;
  letter-spacing: 0.2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.vd-welcome-toast-body {
  font-size: 12.5px;
  color: var(--text2, #a8b3c0);
  line-height: 1.5;
}

.vd-welcome-toast-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--text3, #6b7785);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}

.vd-welcome-toast-close:hover {
  color: var(--text, #e6ecf3);
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 640px) {
  .vd-welcome-toast {
    top: 12px;
    right: 12px;
    left: 12px;
    max-width: none;
    min-width: 0;
  }
}

/* ════════════ TI PANEL CLICK HOVER ════════════ */
/* Sadece data-clickable işaretliyse stilleri uygula — TI panel
   dosyalarına dokunmadan, ti-click-handler.js bu attribute'u ekler */

.ti-best-sym[data-clickable="true"],
.ti-watch-sym[data-clickable="true"] {
  cursor: pointer;
  transition: color 0.15s ease;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.ti-best-sym[data-clickable="true"]:hover,
.ti-watch-sym[data-clickable="true"]:hover {
  color: var(--cyan, #00d4ff);
}

/* Hover'da sağda küçük ok */
.ti-best-sym[data-clickable="true"]::after,
.ti-watch-sym[data-clickable="true"]::after {
  content: "→";
  display: inline-block;
  opacity: 0;
  margin-left: 4px;
  font-weight: 600;
  color: var(--cyan, #00d4ff);
  transition: opacity 0.15s ease, margin-left 0.15s ease;
  pointer-events: none;
}

.ti-best-sym[data-clickable="true"]:hover::after,
.ti-watch-sym[data-clickable="true"]:hover::after {
  opacity: 0.85;
  margin-left: 6px;
}

/* Aktif (tıklanmış) state — kısa flaş */
.ti-best-sym[data-clickable="true"]:active,
.ti-watch-sym[data-clickable="true"]:active {
  opacity: 0.65;
}
