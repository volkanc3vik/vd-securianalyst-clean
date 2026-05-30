// ════════════════════════════════════════════════════════════════════
// modules/premium-config.js
// PREMIUM SALES FUNNEL — config (fiyat/link/metin TEK KAYNAK)
//
// Fiyatlar ve iletişim linkleri PLACEHOLDER'dır — buradan düzenleyin.
// Funnel hiçbir değeri hardcode etmez; hepsini buradan okur.
// window.VDPremiumConfig
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDPremiumConfig) return;

  window.VDPremiumConfig = {
    hero: {
      title: '🚀 Premium Kripto Analiz Platformu',
      subtitle: 'Yapay zeka destekli analizler, geçmiş doğrulama sonuçları, AI öğrenme sistemi, market intelligence araçları ve tüm premium modüllere erişim.',
    },

    // Premium ile açılan modüller (ikon + etiket)
    features: [
      { icon: '🧭', label: 'Intelligence Center' },
      { icon: '📈', label: 'AI Grafik Analizleri' },
      { icon: '🕒', label: 'Full Timeline' },
      { icon: '🗂️', label: 'Full Archive' },
      { icon: '🎯', label: 'Outcome Tracking' },
      { icon: '🧠', label: 'AI Learning Insights' },
      { icon: '📊', label: 'Performance Dashboard' },
      { icon: '🪙', label: 'Tüm Coin Analizleri' },
      { icon: '✅', label: 'Geçmiş Doğrulama Sonuçları' },
    ],

    // Plan kartları — fiyatlar PLACEHOLDER (config'ten gelir)
    plans: [
      { id: 'weekly',  icon: '🔥', name: 'Haftalık Erişim',  price: '₺—', period: '/ 7 gün',   note: 'Hızlı başlangıç', highlight: false },
      { id: 'biweekly',icon: '⚡', name: '15 Günlük Erişim', price: '₺—', period: '/ 15 gün',  note: 'Popüler',        highlight: true  },
      { id: 'monthly', icon: '👑', name: 'Aylık Premium',     price: '₺—', period: '/ 30 gün',  note: 'En iyi değer',   highlight: false },
    ],

    // İletişim / CTA linkleri — PLACEHOLDER (gerçek hesaplarla değiştirin)
    contact: {
      telegram: 'https://t.me/your_premium_contact',
      whatsapp: 'https://wa.me/900000000000',
      // Ana CTA hangi kanalı açsın: 'telegram' | 'whatsapp'
      primary: 'telegram',
    },

    // Sosyal kanıt gösterilsin mi (veri yoksa zaten otomatik gizlenir)
    socialProof: { enabled: true },
  };
})();
