// ════════════════════════════════════════════════════════════════════
// modules/premium-config.js
// PREMIUM SALES FUNNEL — config (fiyat / link / metin / mesaj TEK KAYNAK)
//
// Manuel satış modeli: ödeme entegrasyonu YOK. CTA → Telegram
// hazır mesajla iletişim → manuel ödeme + manuel premium kod.
// Funnel hiçbir değeri hardcode etmez; hepsini buradan okur.
// window.VDPremiumConfig
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  window.VDPremiumConfig = {
    hero: {
      title: 'Premium Crypto Intelligence Platform',
      subtitle: 'Yapay zeka destekli analiz motoru, Outcome Tracking, AI Learning, Performance Dashboard ve gelişmiş market intelligence araçlarına premium erişim.',
      // Hero altı küçük premium metrik etiketleri
      chips: ['AI Market Intelligence', 'Outcome Tracking', 'Performance Dashboard', 'Full Archive Access'],
    },

    // Premium modüller — ikon + başlık + kısa açıklama (kartlarda gösterilir)
    modules: [
      { icon: '🧭', title: 'Intelligence Center', desc: 'Gelişmiş analiz ekranı, tüm coinlerde derin teknik görünüm.' },
      { icon: '📈', title: 'AI Grafik Analizleri', desc: 'S/R, Entry/TP/SL, yapı ve formasyon katmanlı premium grafik.' },
      { icon: '🕒', title: 'Market Timeline', desc: 'Tüm piyasa olaylarının kronolojik, kategorili akışı.' },
      { icon: '🗂️', title: 'Full Archive', desc: 'Geçmiş analizlerin tam arşivi ve detay kayıtları.' },
      { icon: '🎯', title: 'Outcome Tracking', desc: 'Telegram analizlerinin gerçek sonuç takibi ve doğrulaması.' },
      { icon: '🧠', title: 'AI Learning Insights', desc: 'Geçmişten öğrenilen setup istatistikleri ve doğrulama oranları.' },
      { icon: '📊', title: 'Performance Dashboard', desc: 'Sistemin karnesi: doğrulama oranı, en iyi coin/timeframe/setup.' },
      { icon: '🪙', title: 'Tüm Coin Analizleri', desc: 'Tek coin sınırı yok — tüm coinlerde tam erişim.' },
      { icon: '✅', title: 'Geçmiş Doğrulama Sonuçları', desc: 'Hangi analiz doğrulandı, kısmen ya da doğrulanmadı — şeffaf.' },
      { icon: '💧', title: 'Smart Money Analysis', desc: 'Likidite, order block ve kurumsal akış sinyalleri.' },
      { icon: '⚠️', title: 'Risk Engine', desc: 'ATR/volatilite tabanlı risk ve momentum takibi.' },
      { icon: '🎚️', title: 'Setup Confidence', desc: 'Kurulum güven skoru ve teyit/eksik onay analizi.' },
      { icon: '🌐', title: 'Market Translator', desc: 'Karmaşık piyasa verisini sade, okunur içgörülere çevirir.' },
    ],

    // Fayda odaklı liste (modül adı değil, kullanıcı faydası)
    benefits: [
      'Tüm coinlerde gelişmiş analiz ekranı',
      'Telegram’dan gelen analizlerin sonuç takibi',
      'Geçmiş doğrulama kayıtlarına tam erişim',
      'AI Learning ile öğrenilen setup istatistikleri',
      'Performance Dashboard ile sistem karnesi',
      'Premium grafik katmanları (S/R, Entry/TP/SL, yapı)',
      'Risk ve momentum takibi',
      'Market Timeline ile piyasa olay akışı',
    ],

    // Paketler — GERÇEK fiyatlar (TL). Buradan düzenleyin.
    plans: [
      { id: 'daily',   icon: '⚡', name: '1 Günlük Erişim',  price: '₺1.000',  period: '/ 1 gün',   tag: 'Hızlı Başlangıç',     highlight: false },
      { id: 'weekly',  icon: '🔥', name: '1 Haftalık Erişim', price: '₺5.000',  period: '/ 7 gün',   tag: 'En Çok Tercih Edilen', highlight: true  },
      { id: 'monthly', icon: '👑', name: '1 Aylık Premium',   price: '₺15.000', period: '/ 30 gün',  tag: 'En Avantajlı',         highlight: false },
    ],

    // İletişim — gerçek kullanıcı adı/numara buradan kolayca değiştirilir
    contact: {
      telegramUsername: 'volkanc3vik',   // t.me/<telegramUsername> — buradan yönetilir
    },

    // Hazır mesaj şablonları ({plan} → seçilen plan adı)
    messages: {
      perPlan: 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst {plan} erişim almak istiyorum.\n\nBilgi verebilir misiniz?',
      general: 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst Premium erişimi hakkında bilgi almak istiyorum.',
    },

    // Sosyal kanıt: yalnız yeterli veri varsa göster
    socialProof: { enabled: true, minReviewed: 5 },

    // Kod giriş alanı + güven notu metinleri
    codeNote: 'Premium kodun varsa buradan giriş yapabilirsin.',
    trustNote: 'Premium erişim kodları manuel olarak oluşturulur. İletişim sonrası ödeme ve aktivasyon süreci tamamlanır. Şirket / ödeme altyapısı tamamlandığında otomatik ödeme sistemi eklenecektir.',
  };
})();
