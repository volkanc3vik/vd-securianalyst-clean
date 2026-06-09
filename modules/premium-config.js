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
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  window.VDPremiumConfig = {
    hero: {
      title: 'Premium Crypto Intelligence Platform',
      subtitle: _t('prm.heroDesc', null, 'Yapay zeka destekli analiz motoru, Outcome Tracking, AI Learning, Performance Dashboard ve gelişmiş market intelligence araçlarına premium erişim.'),
      // Hero altı küçük premium metrik etiketleri
      chips: ['AI Market Intelligence', 'Outcome Tracking', 'Performance Dashboard', 'Full Archive Access'],
    },

    // Premium modüller — ikon + başlık + kısa açıklama (kartlarda gösterilir)
    modules: [
      { icon: '🧭', title: 'Intelligence Center', desc: _t('prm.featAdvanced', null, 'Gelişmiş analiz ekranı, tüm coinlerde derin teknik görünüm.') },
      { icon: '📈', title: 'AI Grafik Analizleri', desc: _t('prm.featChart', null, 'S/R, Entry/TP/SL, yapı ve formasyon katmanlı premium grafik.') },
      { icon: '🕒', title: 'Market Timeline', desc: _t('prm.featTimeline', null, 'Tüm piyasa olaylarının kronolojik, kategorili akışı.') },
      { icon: '🗂️', title: 'Full Archive', desc: _t('prm.featArchive', null, 'Geçmiş analizlerin tam arşivi ve detay kayıtları.') },
      { icon: '🎯', title: 'Outcome Tracking', desc: _t('prm.featTgOutcome', null, 'Telegram analizlerinin gerçek sonuç takibi ve doğrulaması.') },
      { icon: '🧠', title: 'AI Learning Insights', desc: _t('prm.featLearn', null, 'Geçmişten öğrenilen setup istatistikleri ve doğrulama oranları.') },
      { icon: '📊', title: 'Performance Dashboard', desc: _t('prm.featReport', null, 'Sistemin karnesi: doğrulama oranı, en iyi coin/timeframe/setup.') },
      { icon: '🪙', title: _t('prm.allCoinAnalyses', null, 'Tüm Coin Analizleri'), desc: _t('prm.noLimit', null, 'Tek coin sınırı yok — tüm coinlerde tam erişim.') },
      { icon: '✅', title: _t('prm.pastResults', null, 'Geçmiş Doğrulama Sonuçları'), desc: _t('prm.featTransparent', null, 'Hangi analiz doğrulandı, kısmen ya da doğrulanmadı — şeffaf.') },
      { icon: '💧', title: 'Smart Money Analysis', desc: _t('prm.featLiquidity', null, 'Likidite, order block ve kurumsal akış sinyalleri.') },
      { icon: '⚠️', title: 'Risk Engine', desc: _t('prm.featRisk', null, 'ATR/volatilite tabanlı risk ve momentum takibi.') },
      { icon: '🎚️', title: 'Setup Confidence', desc: _t('prm.featConfidence', null, 'Kurulum güven skoru ve teyit/eksik onay analizi.') },
      { icon: '🌐', title: 'Market Translator', desc: _t('prm.featInsights', null, 'Karmaşık piyasa verisini sade, okunur içgörülere çevirir.') },
    ],

    // Fayda odaklı liste (modül adı değil, kullanıcı faydası)
    benefits: [
      _t('prm.bulletAdvanced', null, 'Tüm coinlerde gelişmiş analiz ekranı'),
      _t('prm.bulletTg', null, 'Telegram’dan gelen analizlerin sonuç takibi'),
      _t('prm.bulletArchive', null, 'Geçmiş doğrulama kayıtlarına tam erişim'),
      _t('prm.bulletLearn', null, 'AI Learning ile öğrenilen setup istatistikleri'),
      'Performance Dashboard ile sistem karnesi',
      _t('prm.featChartShort', null, 'Premium grafik katmanları (S/R, Entry/TP/SL, yapı)'),
      'Risk ve momentum takibi',
      _t('prm.bulletTimeline', null, 'Market Timeline ile piyasa olay akışı'),
    ],

    // Paketler — GERÇEK fiyatlar (TL). Buradan düzenleyin.
    plans: [
      { id: 'daily',   icon: '⚡', name: _t('prm.dayAccess', null, '1 Günlük Erişim'),  price: '₺1.000',  period: _t('prm.per1', null, '/ 1 gün'),   tag: _t('prm.quickStart', null, 'Hızlı Başlangıç'),     highlight: false },
      { id: 'weekly',  icon: '🔥', name: _t('prm.weekAccess', null, '1 Haftalık Erişim'), price: '₺5.000',  period: _t('prm.per7', null, '/ 7 gün'),   tag: _t('prm.mostPreferred', null, 'En Çok Tercih Edilen'), highlight: true  },
      { id: 'monthly', icon: '👑', name: _t('prm.monthPremium', null, '1 Aylık Premium'),   price: '₺15.000', period: _t('prm.per30', null, '/ 30 gün'),  tag: _t('prm.bestValue', null, 'En Avantajlı'),         highlight: false },
    ],

    // İletişim — gerçek kullanıcı adı/numara buradan kolayca değiştirilir
    contact: {
      telegramUsername: 'volkanc3vik',   // t.me/<telegramUsername> — buradan yönetilir
    },

    // Hazır mesaj şablonları ({plan} → seçilen plan adı)
    messages: {
      perPlan: _t('prm.contactPerPlan', null, 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst {plan} erişim almak istiyorum.\n\nBilgi verebilir misiniz?'),
      general: _t('prm.contactGeneral', null, 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst Premium erişimi hakkında bilgi almak istiyorum.'),
    },

    // Sosyal kanıt: yalnız yeterli veri varsa göster
    socialProof: { enabled: true, minReviewed: 5 },

    // Kod giriş alanı + güven notu metinleri
    codeNote: _t('prm.haveCode', null, 'Premium kodun varsa buradan giriş yapabilirsin.'),
    trustNote: _t('prm.codesManual', null, 'Premium erişim kodları manuel olarak oluşturulur. İletişim sonrası ödeme ve aktivasyon süreci tamamlanır. Şirket / ödeme altyapısı tamamlandığında otomatik ödeme sistemi eklenecektir.'),
  };
})();
