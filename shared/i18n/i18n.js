// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — i18n ÇEKİRDEĞİ (ZIP 170.B-1) — SADECE MOTOR
//
// Bu adımda HİÇBİR METİN ÇEVRİLMEZ. Yalnız altyapı kurulur:
//   • Dil durumu (tr / en) + localStorage hafızası ('vd_lang', varsayılan tr)
//   • <html lang> dinamik yönetimi
//   • t(anahtar, yedek) sözlük arama (sözlükler şimdilik BOŞ → yedek/anahtar döner)
//   • applyStatic(): [data-i18n] / [data-i18n-attr] düğümlerini çevirir
//     (şimdilik sayfalarda böyle düğüm YOK → no-op; B-2+ kullanılacak)
//   • Nav'a TR/EN dil değiştirici enjekte eder (üst nav + mobil drawer)
//
// GÜVENLİK: Mevcut hiçbir mantığa dokunmaz. nav.js DEĞİŞMEZ (switcher buradan
// DOM'a eklenir). Metin katmanı 170.B-2+ adımlarında doldurulacak.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var LS_KEY  = 'vd_lang';
  var LANGS   = ['tr', 'en'];
  var DEFAULT = 'tr';

  // ── SÖZLÜKLER — 170.B-2: ortak metinler (nav, footer, toast, login). Onaylı çeviriler.
  var DICT = {
    tr: {
      'nav.performans': 'Performans',
      'footer.disclaimer': '⚠ Bu sistem yatırım tavsiyesi değildir. Kripto para yatırımları yüksek risk içerir. Kendi araştırmanızı yapın.',
      'toast.welcome': 'Hoş geldiniz',
      'toast.welcomeSource': '{src} hoş geldiniz',
      'toast.analysisLoaded': '{sym} analizi yüklendi · İncelemeye başlayın',
      'toast.platformLoaded': 'Analiz platformu yüklendi',
      'login.premiumActivation': 'PREMIUM AKTİVASYON',
      'login.premiumDesc': 'Premium üyelik kodunuzu girin. Tüm coinler ve detaylı analizler açılacak.',
      'login.premiumCode': 'Premium Kodu',
      'login.codePlaceholder': 'Premium kodunuzu girin...',
      'login.activate': 'Premium’u Aktive Et',
      'login.signIn': 'Giriş Yap',
      'login.verifying': 'Doğrulanıyor...',
      'login.enterCode': '⚠ Lütfen erişim kodunuzu girin.',
      'login.invalidCode': 'Geçersiz erişim kodu',
      'login.tooManyTry': 'Çok fazla deneme. {n} dakika sonra tekrar deneyin.',
      'login.tooManyFail': 'Çok fazla hatalı deneme. 15 dakika bekleyin.',
      'login.lockedWait': '🔒 Hesap {n} dakika kilitli. Lütfen bekleyin.',
      'login.locked': '🔒 Hesap {n} dakika kilitli.',
      'login.lockedAfter': '🔒 {msg}. Hesap {n} dakika kilitlendi.',
      'login.tryAgainSuffix': '. Lütfen tekrar deneyin.',
      'login.deviceLimit': '🔒 Bu premium kodu izin verilen cihaz sayısına ulaşmıştır. Destek için support@vd-securianalyst.com',
      'login.lockedBtn': 'Kilitli...',
      'login.connError': '⚠ Bağlantı hatası: {msg}',
      'login.noCodeFooter': 'Premium kodun yoksa sitede free olarak kullanmaya devam edebilirsin.',
      'login.contactForCode': 'Kod almak için iletişime geç.',
      'timer.remaining': 'Kalan:',
      'timer.unitDay': 'g',
      'timer.unitHour': 's',
      'timer.unitMin': 'dk',
      'timer.unitSec': 'sn',
      'timer.adminAccess': 'Yönetici erişimi',
      'timer.unlimited': 'Sınırsız',
      'access.unlimited': 'Sınırsız Erişim',
      'access.day1': '1 Gün',
      'access.days': '{n} Gün',
      'welcome.close': 'Kapat',
      'welcome.title': 'VD SecuriAnalyst\u2019e Hoş geldiniz',
      'welcome.subtitle': 'AI destekli kripto teknik analiz platformu. Algoritmik analizler ve teknik formasyonlar bilgilendirme amaçlıdır.',
      'welcome.warn1': 'Bu platform <strong>yatırım tavsiyesi vermez</strong>.',
      'welcome.warn2': 'İçerikler eğitim ve bilgilendirme amaçlıdır.',
      'welcome.warn3': 'Yatırım kararları kullanıcı sorumluluğundadır.',
      'welcome.linkTerms': 'Kullanım Koşulları',
      'welcome.linkRisk': 'Risk Bildirimi',
      'welcome.linkKvkk': 'KVKK Aydınlatma Metni',
      'welcome.termsHtml': 'Devam ederek {t}, {r} ve {k}\u2019ni okumayı ve kabul etmeyi onaylamış sayılırsınız.',
      'welcome.btnTerms': 'Kullanım Koşullarını Oku',
      'welcome.btnAccept': 'Anladım, Devam Et',
      'ti.headerTitle': '◈ Piyasa İstihbarat Terminali',
      'ti.waitingData': 'veri bekleniyor',
      'ti.relNow': 'şimdi',
      'ti.relSec': '{n}sn önce',
      'ti.relMin': '{n}dk önce',
      'ti.relHour': '{n}sa önce',
      'ti.cgActive': 'CoinGlass: Aktif',
      'ti.cgPartial': 'CoinGlass: Kısıtlı',
      'ti.cgOff': 'CoinGlass: Yok',
      'ti.liveWS': 'Canlı WS',
      'ti.volObs': 'VOLATİLİTE GÖZLEMİ',
      'ti.pressure': 'PİYASA BASKISI',
      'ti.activity': 'AKTİVİTE AKIŞI',
      'ti.engineStart': 'İstihbarat motoru başlatılıyor',
      'ti.engineStartSub': 'İlk tarama döngüsünün tamamlanması bekleniyor...',
      'ti.catSystem': 'SİS',
      'ti.catRegime': 'REJ',
      'ti.catVolatility': 'VOL',
      'ti.catSetup': 'STP',
      'ti.catPressure': 'BSK',
      'ti.catMarket': 'PYS',
      'ti.regimeLabel': 'PİYASA REJİMİ',
      'ti.mmLabel': 'MARKET MAKER YÖNELİMİ',
      'ti.waitingScan': 'Tarama verisi bekleniyor...',
      'ti.regimeUnknown': 'Bilinmiyor',
      'ti.mmEmpty': 'Henüz net konumlanma yok.',
      'regime.label.CHOPPY': 'Yatay / Belirsiz Piyasa',
      'regime.label.RISK_ON': 'Risk-On Ortamı',
      'regime.label.RISK_OFF': 'Risk-Off Ortamı',
      'regime.label.LIQUIDITY_TRAP': 'Likidite Tuzağı',
      'regime.label.RISK_ON_FRAGILE': 'Temkinli Risk-On',
      'regime.label.RISK_OFF_FRAGILE': 'Temkinli Risk-Off',
      'regime.sum.choppy1': 'Net bir yön yok. Kırılım kovalamak yerine sabırlı ol.',
      'regime.sum.choppy2': 'Karışık teknik görünüm. Konfluans için gözlem önerilir.',
      'regime.sum.riskon': 'Trend devamı destekleniyor. Geri çekilmeler yukarı yönlü görünüm sunabilir.',
      'regime.sum.riskoff': 'Aşağı yönlü baskı sürüyor. Trende karşı long yüksek riskli.',
      'regime.sum.liqtrap': 'Net trend yok ama volatilite yüksek. Fakeout riski yüksek.',
      'regime.sum.riskonfragile': 'Trend var ama genişlik dar. Sadece seçici longlar.',
      'regime.sum.riskofffragile': 'Aşağı yön korunuyor ama tükenme işaretleri var. Geç aşağı yönlü görünüm riski artabilir.',
      'mm.h.overLong': 'Funding aşırı ısınmış — long kalabalığı risk altında.',
      'mm.h.overShort': 'Funding aşırı negatif — short squeeze koşulları oluşuyor.',
      'mm.h.squeezeRally': 'Yükseliş short kapatmalarıyla sürüyor, yeni longlarla değil.',
      'mm.h.shortBuildup': 'Zayıflıkta shortlar birikiyor — squeeze yakıtı toplanıyor.',
      'mm.h.liqAboveTarget': 'Likidite fiyatın üzerinde — devamlılık için doğal hedef.',
      'mm.h.liqAboveTrap': 'Likidite fiyatın üzerinde birikiyor — long tuzakları mümkün.',
      'mm.h.liqBelow': 'Likidite fiyatın altında — aşağı yön hedefleri vurulmadı.',
      'mm.h.belowStops': 'Altta stoplar bekliyor — dönüş öncesi sweep riski var.',
      'mm.h.trendLong': 'Trend gerçek long pozisyonlarıyla destekleniyor.',
      'mm.h.trendShort': 'Trend gerçek short pozisyonlarıyla destekleniyor.',
      'mm.h.noConv': 'Yön konvansiyonu yok — yapının oluşmasını bekle.',
      'mm.h.aligned': 'Piyasa davranışı mevcut trendle uyumlu.',
      'mm.d.overLong': 'Geç longlar likidasyon zincirine açık.',
      'mm.d.overShort': 'Short tarafı aşırı uzamış; ralliler shortları kapatmaya zorlayabilir.',
      'mm.d.squeezeRally': 'OI desteği olmadan ralli kalitesi şüpheli.',
      'mm.d.liqAboveTarget': 'Üst taraftaki likidite hedefleri henüz vurulmadı.',
      'mm.d.liqAboveTrap': 'Piyasa dönüş öncesi agresif longları avlayabilir.',
      'mm.d.belowStops': 'Geç shortlar avlanabilir.',
      'mm.d.elevLong': 'Funding long tarafında yüksek seviyede.',
      'mm.d.elevShort': 'Funding short tarafında yüksek seviyede.',
      'ti.majorEmpty': 'Veri yok.',
      'ti.bestSetupLabel': 'EN OLGUN SETUP',
      'ti.bestEmptyTitle': 'Bu döngüde kaliteli teknik görünüm bulunmadı',
      'ti.bestEmptyDesc': 'Hiçbir coin kalite eşiğini geçmedi. Piyasa izleniyor.',
      'ti.whyStrong': 'Neden Güçlü',
      'ti.whatNeeds': 'Sıradaki Gerekenler',
      'ti.outlookEval': 'Görünüm Değerlendirmesi',
      'ti.riskLevel': 'Risk Seviyesi',
      'ti.maturityLabel': 'Teknik Görünüm Olgunluğu',
      'ti.lvlReference': 'Referans',
      'ti.lvlRiskLimit': 'Risk Limiti',
      'ti.lvlTarget1': 'Hedef Bölge 1',
      'ti.lvlTarget2': 'Hedef Bölge 2',
      'ti.scanPrefix': 'Tarama: {n} coin değerlendirildi',
      'ti.scanStrong': 'Güçlü',
      'ti.scanValid': 'Geçerli',
      'ti.scanWeak': 'Zayıf',
      'ti.scanAvoid': 'Kaçın',
      'ti.watchlistLabel': 'İZLEME LİSTESİ',
      'ti.maturityShort': 'Olgunluk',
      'ti.warningsLabel': 'UYARILAR',
      'tier.ELITE': 'ELİT',
      'tier.STRONG': 'GÜÇLÜ',
      'tier.VALID': 'GEÇERLİ',
      'tier.WEAK': 'ZAYIF',
      'tier.AVOID': 'KAÇIN',
      'rr.biasTitle': 'AI PİYASA BIAS',
      'rr.longTrend': 'Yükseliş Eğilimi',
      'rr.shortTrend': 'Düşüş Eğilimi',
      'rr.confScore': 'AI Güven Skoru:',
      'rr.biasOpen': 'Bias Analizini Aç →',
      'rr.biasMicro': 'Yön dağılımı gözlemi (LONG/SHORT setup sayımı) · yatırım tavsiyesi değildir.',
      'rr.oppTitle': 'EN İYİ 3 FIRSAT',
      'rr.radarOpen': 'Tüm Radarı Aç →',
      'rr.empty': 'Bu taramada uygun yapı yok — sonraki taramada güncellenecek.',
      'rr.moreOpp': '+ {n} fırsat daha mevcut →',
      'rr.lockedTitle': 'AI PİYASA BIAS · FIRSATLAR',
      'rr.lockedText': 'Yön dağılımı ve en olgun fırsatlar <b>Premium ve Elite</b> üyelere açıktır.',
      'rr.getAccess': 'Erişim Al →',
      'rr.ariaLabel': 'Piyasa bias ve fırsatlar',
      'rr.yonUp': 'Yükseliş',
      'rr.yonDown': 'Düşüş',
      'rr.yonNeutral': 'Nötr',
      'rr.watch': 'İZLE',
      'rr.stageConfirmed': 'Teyitli',
      'rr.stageArmed': 'Hazır',
      'rr.stageWatch': 'İzleme',
      'rr.oppWord': 'Fırsat',
      'rr.dirLabel': 'Yön: ',
      'rr.skor': 'Skor',
      'md.trendUp': 'Yükseliş',
      'md.trendDown': 'Düşüş',
      'md.trendFlat': 'Yatay',
      'md.momStrong': 'Güçlü ↑',
      'md.momWeak': 'Zayıf ↓',
      'md.momNeutral': 'Nötr',
      'md.riskHigh': 'Yüksek',
      'md.riskLow': 'Düşük',
      'md.riskMid': 'Orta',
      'md.live': '● canlı',
      'md.waiting': '⏳ veri bekleniyor',
      'md.noExt': 'harici veri yok',
      'md.ctx': 'trend · momentum · risk — AI bağlamı (sinyal değil)',
      'md.newsOff': '○ haber/makro kaynağı bağlı değil',
      'md.liveBadge': 'CANLI',
      'prm.selectPlan': 'Planı Seç',
      'prm.previewEnded': 'Ücretsiz önizleme süreniz sona erdi.',
      'prm.previewEndedDesc': 'İncelediğiniz analizin tamamına ve tüm premium araçlara erişmek için premium üyelik gereklidir.',
      'prm.secModules': 'Premium Modüller',
      'prm.secBenefits': 'Premium ile Neler Kazanırsın',
      'prm.secPlans': 'Erişim Planları',
      'prm.ctaTelegram': "Premium Erişim İçin Telegram'dan Yaz",
      'prm.enterPremiumCode': 'Premium Kodunu Gir',
      'prm.statReviewed': 'İncelenen Analiz',
      'prm.statAvgRate': 'Ort. Doğrulama Oranı',
      'prm.statValidated': 'Doğrulanan Analiz',
      'prm.statLearnedSetup': 'Öğrenilen Setup',
      'prm.previewExpired': 'Önizleme süresi doldu',
      'prm.previewExpiredMsg': 'Ücretsiz önizleme süreniz doldu. Analizin tamamına ve tüm platform verilerine erişmek için Premium erişim kodu gereklidir.',
      'prm.backHome': 'Ana sayfaya dön',
      'prm.preview': 'Önizleme',
      'prm.tgDailyDesc': 'Her gün ücretsiz analizler, market özeti ve örnek setup paylaşımları.',
      'prm.tgSimilarFree': '📢 Benzer analizler Telegram kanalında ücretsiz paylaşılıyor.',
      'prm.tgFollowExamples': '📢 Güncel piyasa örneklerini Telegram kanalında takip et',
      'prm.tgDailyShort': "Günlük analiz, market özeti ve örnek setup'lar.",
      'prm.join': 'Katıl',
      'prm.close': 'Kapat',
      'prm.aiMultiLayer': 'Bu analiz AI tarafından çok katmanlı olarak üretilmiştir',
      'prm.claudeLockLabel': '🔒 Premium — Claude.ai Analizi',
      'prm.copyToClaude': '📋 Kopyala → Claude.ai',
      'prm.priceMapPremium': 'Detaylı fiyat haritası premium kullanıcılar içindir',
      'prm.promoLabel': 'Premium tanıtım',
      'prm.unlockAllCoins': 'Tüm coinleri aç + AI analizinin tamamını gör',
      'prm.limitedData': 'Şu anda sadece sınırlı veriyi görüyorsunuz',
      'prm.featuresUnlocked': 'Premium üyelikle açılan özellikler:',
      'prm.accessAllCoins': 'Tüm coinlere erişim',
      'prm.advDataLayers': 'Gelişmiş veri katmanları',
      'prm.partialDataRisk': 'Eksik veri ile değerlendirme yapmak risklidir',
      'prm.alreadyHaveCode': '🔑 Zaten kodum var → Premium Kod Gir',
      'prm.manualActivate': 'Premium erişim manuel olarak aktive edilir. Kodun varsa buradan giriş yapabilirsin.',
      'prm.premiumLocked': 'Premium kilitli',
      'prm.welcomeTg': "Telegram'dan hoş geldiniz",
      'prm.analysisLoadedReview': 'analizi yüklendi · İncelemeye başlayın',
      'prm.contactPerPlan': 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst {plan} erişim almak istiyorum.\n\nBilgi verebilir misiniz?',
      'prm.contactGeneral': 'Merhaba Volkan Bey.\n\nVD SecuriAnalyst Premium erişimi hakkında bilgi almak istiyorum.',
      'prm.claudeCopyNote': '🔒 Detaylı Claude.ai analiz prompt\'u <b>Premium</b> üyeler içindir. <span class="vd-claude-cta">Premium\'a geç →</span>',
      'prm.cardLockText': '🔒 Bu analizin detayları Premium üyeler için açıktır.',
      'prm.cardLockTap': 'Görmek için dokun →',
      'prm.codesManual': 'Premium erişim kodları manuel olarak oluşturulur. İletişim sonrası ödeme ve aktivasyon süreci tamamlanır. Şirket / ödeme altyapısı tamamlandığında otomatik ödeme sistemi eklenecektir.',
      'prm.heroDesc': 'Yapay zeka destekli analiz motoru, Outcome Tracking, AI Learning, Performance Dashboard ve gelişmiş market intelligence araçlarına premium erişim.',
      'prm.featLearn': 'Geçmişten öğrenilen setup istatistikleri ve doğrulama oranları.',
      'prm.featReport': 'Sistemin karnesi: doğrulama oranı, en iyi coin/timeframe/setup.',
      'prm.featChart': 'S/R, Entry/TP/SL, yapı ve formasyon katmanlı premium grafik.',
      'prm.featTransparent': 'Hangi analiz doğrulandı, kısmen ya da doğrulanmadı — şeffaf.',
      'prm.featAdvanced': 'Gelişmiş analiz ekranı, tüm coinlerde derin teknik görünüm.',
      'prm.featTgOutcome': 'Telegram analizlerinin gerçek sonuç takibi ve doğrulaması.',
      'prm.featInsights': 'Karmaşık piyasa verisini sade, okunur içgörülere çevirir.',
      'prm.featTimeline': 'Tüm piyasa olaylarının kronolojik, kategorili akışı.',
      'prm.featChartShort': 'Premium grafik katmanları (S/R, Entry/TP/SL, yapı)',
      'prm.featLiquidity': 'Likidite, order block ve kurumsal akış sinyalleri.',
      'prm.featArchive': 'Geçmiş analizlerin tam arşivi ve detay kayıtları.',
      'prm.featConfidence': 'Kurulum güven skoru ve teyit/eksik onay analizi.',
      'prm.featRisk': 'ATR/volatilite tabanlı risk ve momentum takibi.',
      'prm.noLimit': 'Tek coin sınırı yok — tüm coinlerde tam erişim.',
      'prm.haveCode': 'Premium kodun varsa buradan giriş yapabilirsin.',
      'prm.bulletLearn': 'AI Learning ile öğrenilen setup istatistikleri',
      'prm.bulletTg': 'Telegram’dan gelen analizlerin sonuç takibi',
      'prm.bulletArchive': 'Geçmiş doğrulama kayıtlarına tam erişim',
      'prm.bulletTimeline': 'Market Timeline ile piyasa olay akışı',
      'prm.bulletAdvanced': 'Tüm coinlerde gelişmiş analiz ekranı',
      'prm.pastResults': 'Geçmiş Doğrulama Sonuçları',
      'prm.mostPreferred': 'En Çok Tercih Edilen',
      'prm.allCoinAnalyses': 'Tüm Coin Analizleri',
      'prm.weekAccess': '1 Haftalık Erişim',
      'prm.monthPremium': '1 Aylık Premium',
      'prm.dayAccess': '1 Günlük Erişim',
      'prm.quickStart': 'Hızlı Başlangıç',
      'prm.bestValue': 'En Avantajlı',
      'prm.per30': '/ 30 gün',
      'prm.per1': '/ 1 gün',
      'prm.per7': '/ 7 gün',
      'prm.backToPlans': '← Premium planlara dön',
      'prm.avgValidation': 'Ort. Doğrulama Oranı',
      'prm.validatedAnalysis': 'Doğrulanan Analiz',
      'prm.reviewedAnalysis': 'İncelenen Analiz',
      'prm.learnedSetup': 'Öğrenilen Setup',
      'prm.active': 'Aktif',
      'prm.modalActivate': 'Premium erişim manuel olarak aktive edilir. Kodun varsa buradan giriş yapabilirsin.',
      'prm.partialRisky': 'Eksik veri ile değerlendirme yapmak risklidir',
      'prm.featuresOpened': 'Premium üyelikle açılan özellikler:',
      'prm.entryTargetRisk': 'Giriş / hedef / risk seviyeleri',
      'prm.advancedLayers': 'Gelişmiş veri katmanları',
      'prm.allAiAnalyses': 'AI analizlerinin tamamı',
      'prm.allCoinsAccess': 'Tüm coinlere erişim',
      'prm.goPremium': 'Premium\'a Geç',
      'prm.ctaUnlock': 'Tüm coinleri aç + AI analizinin tamamını gör',
      'prm.ctaLimited': 'Şu anda sadece sınırlı veriyi görüyorsunuz',
      'prm.ctaPromo': 'Premium tanıtım',
      'prm.aiMultilayer': ' Bu analiz AI tarafından çok katmanlı olarak üretilmiştir',
      'prm.fullForPremium': ' Tam analiz premium kullanıcılar içindir',
      'prm.detailMapForPremium': 'Detaylı fiyat haritası premium kullanıcılar içindir',
      'prm.goPremiumRocket': '🚀 Premium\'a Geç',
      'prm.premiumCanAccess': 'Premium kullanıcılar erişebilir',
      'prm.coinForPremium': 'Bu coin analizi premium kullanıcılar için erişilebilir',
      'prm.loadedReview': 'analizi yüklendi · İncelemeye başlayın',
      'prm.platformLoaded': 'Analiz platformu yüklendi',
      'prm.welcome': 'Hoş geldiniz',
      'prm.welcomeLc': 'hoş geldiniz',
      'prm.tgDaily': 'Her gün ücretsiz analizler, market özeti ve örnek setup paylaşımları.',
      'prm.tgSimilar': '📢 Benzer analizler Telegram kanalında ücretsiz paylaşılıyor.',
      'prm.tgFollow': '📢 Güncel piyasa örneklerini Telegram kanalında takip et',
      'prm.tgJoinFree': '📢 Ücretsiz Telegram Kanalına Katıl',
      'prm.tgCheckFirst': '📢 Önce Ücretsiz Kanalı İncele',
      'prm.tgJoinChannel': 'Telegram Kanalına Katıl',
      'prm.tgFreeChannel': 'Ücretsiz Telegram Kanalı',
      'prm.tgHidden': 'Bu analizin detayları gizlenmiştir.',
      'prm.tgDaily2': 'Günlük analiz, market özeti ve örnek setup\'lar.',
      'prm.tgJoin': 'Katıl',
      'prm.tgClose': 'Kapat',
      'arc.neutralShort': 'Nötr',
      'arc.retroStat': '⚠ Retrospektif istatistiktir; geçmiş analizlerin tutarlılığını gösterir, gelecek getiri/başarı garantisi değildir.',
      'arc.dataRetry': 'Arşiv verisi şu an alınamadı. Bağlantı düzelince otomatik denenecek; sayfayı yenileyebilirsiniz.',
      'arc.learnModFail': 'Öğrenme modülü yüklenemedi. Sayfayı yenileyin; sorun sürerse dağıtımı kontrol edin.',
      'arc.reviewedRate': 'incelenmiş analiz · doğrulama oranı = (doğrulandı + ½·kısmi) ÷ toplam',
      'arc.notEnoughCombo': 'Henüz yeterli örnekli kombinasyon yok (her örüntü için en az ',
      'arc.samplesNeeded': ' örnek gerekir). Daha fazla sonuç hesaplandıkça görünecek.',
      'arc.engineNotFound': 'Öğrenme motoru (VDInsights) bulunamadı — kart devre dışı.',
      'arc.insightErr': 'İçgörüler hesaplanırken sorun oluştu (konsola bakın).',
      'arc.srcNotLoaded': 'Veri kaynağı yüklenmedi. Sayfayı yenileyin.',
      'arc.learnBegin': '). Sonuç hesapladıkça öğrenme başlayacak.',
      'arc.insightFail': 'İçgörüler gösterilemedi (konsola bakın).',
      'arc.recordsReq': 'incelenmiş kayıt gerekli (şu an',
      'arc.shownRate': 'doğrulama oranı göstermiştir.',
      'arc.dataFail': 'Arşiv verisi alınamadı:',
      'arc.forLearnMin': 'Öğrenme için en az',
      'arc.strongestSetups': "En güçlü setup'lar",
      'arc.reviewedAnalyses': 'incelenmiş analiz',
      'arc.validatedTilde': 'doğrulandı · ~',
      'arc.notValidatedLc': 'doğrulanmadı',
      'arc.samplesCheck': 'örnek · ✓',
      'arc.partialCross': 'kısmi · ✗',
      'arc.retroPerf': '⚠ Retrospektif performans özeti; geçmiş analizlerin tutarlılığını gösterir, gelecek getiri/başarı garantisi değildir. Doğrulama oranı = (doğrulandı + ½·kısmi) ÷ toplam.',
      'arc.dataRetry2': 'Arşiv verisi şu an alınamadı. Sayfayı yenileyebilirsiniz.',
      'arc.perfFail': 'Performans özeti gösterilemedi (konsola bakın).',
      'arc.notEnoughData': 'Yeterli veri yok. Performans özeti için en az',
      'arc.reviewedReq': 'incelenmiş analiz gerekli (şu an',
      'arc.notEnoughCombo2': 'yeterli örnekli kombinasyon yok',
      'arc.comboSkip': 'combo hesabı atlandı:',
      'arc.bestTf': 'En başarılı timeframe',
      'arc.overallRate': 'Genel doğrulama oranı',
      'arc.perfSummary': '📈 Performans Özeti',
      'arc.bestSetup': 'En başarılı setup',
      'arc.bestCoin': 'En başarılı coin',
      'arc.totalReviewed': 'Toplam İncelenen',
      'arc.loadErr': 'yükleme hatası:',
      'arc.renderErr': 'render hatası:',
      'arc.weakestCoin': 'En zayıf coin',
      'arc.samples': 'örnek',
      'arc.partial': 'Kısmi',
      'arc.cardPartial': 'Analiz kısmen doğru çıktı ancak bazı koşullar beklenen performansı göstermedi.',
      'arc.cardLegacy': 'Bu kayıt öğrenme ve istatistik dışıdır (eski outcome)',
      'arc.cardPending': 'Bu analiz henüz sonuç açısından değerlendirilmedi.',
      'arc.cardValidated': 'Analiz yönü ve sonuçları büyük ölçüde doğrulandı.',
      'arc.cardNotValidated': 'Analiz beklenen yönde doğrulanmadı.',
      'arc.viewDetail': 'Detayı Gör →',
      'arc.actualMove': 'Gerçekleşen hareket:',
      'arc.analysisDetail': 'analiz detayı',
      'arc.partlyValidated': 'Kısmen Doğrulandı',
      'arc.bullish': 'Yükseliş (Bullish)',
      'arc.bearish': 'Düşüş (Bearish)',
      'arc.neutral': 'Nötr (Neutral)',
      'arc.notValidated': 'Doğrulanmadı',
      'arc.validated': 'Doğrulandı',
      'arc.disc1': 'Bu içerik yatırım tavsiyesi değildir. Geçmiş analizlerin retrospektif',
      'arc.disc2': 'değerlendirmesidir; gelecekteki sonuçların göstergesi sayılamaz.',
      'arc.premOnly': 'Bu analiz yalnızca Premium üyeler için kullanılabilir.',
      'arc.notFound': 'Kayıt bulunamadı veya görüntülenemiyor.',
      'arc.sharedTg': "✔ Telegram'da paylaşıldı",
      'arc.tgDate': 'Telegram Paylaşım Tarihi',
      'arc.enterCode': 'Premium Erişim Kodu Gir',
      'arc.biasLabel': 'Yön Eğilimi (Bias)',
      'arc.priceAt': 'Analiz Anı Fiyatı',
      'arc.statusDesc': 'Durum açıklaması',
      'arc.consistScore': 'Tutarlılık Skoru',
      'arc.reviewDate': 'İnceleme Tarihi',
      'arc.reviewPrice': 'İnceleme Fiyatı',
      'arc.actualDir': 'Gerçekleşen Yön',
      'arc.loading': 'Yükleniyor…',
      'arc.recentValidated': 'Son Doğrulanan',
      'arc.mostAnalyzed': 'En Çok Analiz',
      'arc.partlyValidShort': 'Kısmen Doğr.',
      'arc.allRecords': 'Tüm kayıtlar',
      'arc.loadFail': 'Yüklenemedi',
      'arc.validatedWord': 'Doğrulanan',
      'arc.statistics': 'İstatistik',
      'arc.underReview': 'İncelemede',
      'arc.allCoins': 'Tüm Coinler',
      'arc.timeRange': 'Zaman aralığı',
      'arc.allStatuses': 'Tüm Durumlar',
      'arc.all': 'Tümü',
      'arc.previewOnly': "Önizleme yalnızca bu coin içindir. Tüm arşiv, Outcome ve AI içgörüleri Premium'da.",
      'arc.viewWithPremium': 'Premium erişim ile diğer coin analizlerini görüntüleyin',
      'arc.noMatch': 'Bu filtrelerle eşleşen analiz bulunamadı.',
      'arc.showing': 'analiz gösteriliyor',
      'arc.loadMore': 'Daha Fazla Yükle',
      'ds.banner': '📦 Önbellekten gösteriliyor · canlı tarama yenileniyor…',
      'ds.oneMinAgo': '1 dk önce',
      'er.backDash': '← Dashboard’a Dön',
      'er.lockedDesc': '<div style="color:#cdd6e4;font-size:13.5px;line-height:1.6;margin:0 0 14px">AI Piyasa Radarı, hacim henüz girmeden yapı olgunlaşırken coinleri <b style="color:#9fdfff">İzleme → Hazır → Teyitli</b> güç katmanlarında gösterir. Bu katman <b style="color:#9fdfff">Premium ve Elite</b> üyelere açıktır.</div>',
      'er.ranking': 'Sıralama: yapı olgunluğu + güven skoru + arşiv tutarlılığı + tazelik (yön değil). İzleme → Hazır → Teyitli — işlem/yön önerisi değildir; yatırım tavsiyesi değildir.',
      'er.dashSummary': 'Dashboard özeti — en güçlü yapılar. Tam 9 kart için workspace. İşlem/yön önerisi değildir; yatırım tavsiyesi değildir.',
      'er.biasMicro2': 'Yön dağılımı gözlemi — olgunluk katmanından (Altın/Turuncu/Gri) ayrı bilgidir. Yatırım tavsiyesi değildir.',
      'er.matObs2': 'Yapı olgunluğu gözlemi — işlem/yön önerisi değildir, yatırım tavsiyesi değildir.',
      'er.noSuitable': 'Bu taramada uygun yapı bulunmadı — sonraki taramada güncellenecek.',
      'er.matObs': 'Yapı olgunluğu gözlemi — işlem/yön önerisi değildir.',
      'er.biasHeader': '⚡ AI Market Bias — bugün sistem ne tarafta?',
      'er.archNone': 'Bu coin için arşiv kaydı henüz yok.',
      'er.noStageSetup': 'Bu taramada bu aşamada setup yok.',
      'er.noSuitable2': 'Bu taramada uygun yapı bulunmadı.',
      'er.radarFullView': '⚡ AI Piyasa Radarı — Tüm Görünüm',
      'er.prevScan': '· önceki tarama · yenileniyor…',
      'er.moreOpps': ' fırsat daha · Tümünü Aç →',
      'er.featReadiness': 'Yapı Olgunluğu (Readiness)',
      'er.volAwakeStart': 'Volume Awakening başladı',
      'er.openRadar9': 'Tüm Radarı Aç · 9 kart →',
      'er.featCards': '9 kart · 3 güç katmanı',
      'er.structNotAligned': 'Yapı tam hizalı değil',
      'er.volNotAwake': 'Hacim henüz uyanmadı',
      'er.smallSample': 'Henüz az örneklem · ',
      'er.archTitle': '⬡ ARŞİV TUTARLILIĞI',
      'er.tierGold': '🥇 ALTIN · Confirmed',
      'er.radarTitle': '⚡ AI Piyasa Radarı',
      'er.featStage': 'Aşama Geçiş Takibi',
      'er.viewChart': 'Grafikte İncele →',
      'er.mostMature': '🥇 En Olgun Fırsat',
      'er.tierOrange': '🟠 TURUNCU · Armed',
      'er.confStrong': 'Confidence güçlü',
      'er.confLow': 'Confidence düşük',
      'er.roseArmed': "ARMED'a yükseldi",
      'er.momRising': 'Momentum artıyor',
      'er.whyStood': 'Neden öne çıktı?',
      'er.rangeTight': 'Range daralıyor',
      'er.addedWatch': 'İzlemeye alındı',
      'er.emaAligned': 'EMA/yapı hizalı',
      'er.eliteArch': '🔒 ELİTE · ARŞİV',
      'er.squeezeHigh': 'Sıkışma yüksek',
      'er.volWaking': 'Hacim uyanıyor',
      'er.becameConf': 'CONFIRMED oldu',
      'er.shortDom': '🔴 SHORT BASKIN',
      'er.liveScan': '· canlı tarama',
      'er.rsiOut': 'RSI band dışı',
      'er.longDom': '🟢 LONG BASKIN',
      'er.upBias': 'Yukarı eğilim',
      'er.dirBias': 'Yön eğilimi: ',
      'er.goChart': 'Grafiğe Git →',
      'er.coinsScanned': ' coin tarandı',
      'er.tierGray': '⚪ GRİ · Watch',
      'er.downBias': 'Aşağı eğilim',
      'er.staleData': '· bayat veri',
      'er.lastScan': 'Son tarama: ',
      'er.structAligned': 'Yapı hizalı',
      'er.riskHigh2': 'Risk yüksek',
      'er.consistency': ' tutarlılık',
      'er.confScoreLbl': 'Güven Skoru',
      'er.riskLow2': 'Risk düşük',
      'er.misleading': ' yanıltıcı',
      'er.confirmedCnt': '🥇 Teyitli ',
      'er.ctxPositive': 'Pozitif ▲',
      'er.ctxNegative': 'Negatif ▼',
      'er.correct': ' doğru · ',
      'er.partialB': ' kısmi · ',
      'er.balanced': '⚪ DENGEDE',
      'er.watchCnt': '⚪ İzleme ',
      'er.getAccess2': 'Erişim Al',
      'er.secAgo': ' sn önce',
      'er.minAgo': ' dk önce',
      'er.hourAgo': ' sa önce',
      'er.pipPending': 'bekliyor',
      'er.readyCnt': '🟠 Hazır ',
      'er.justNow': 'az önce',
      'er.ctxStrong': 'Güçlü ▲',
      'er.ctxWeak': 'Zayıf ▼',
      'er.observations': ' gözlem',
      'er.pipOk': 'tamam',
      'er.pipConfirm': 'Teyit',
      'er.pipAlign': 'Hiza',
      'er.pipScore': 'Skor',
      'er.ctxNeutral': 'Nötr',
      'dir.up': '▲ Yükseliş trendi',
      'dir.down': '▼ Düşüş trendi',
      'dir.flat': '◇ Yatay',
      'mom.Strong': 'Güçlü',
      'mom.Healthy': 'Sağlıklı',
      'mom.Weakening': 'Zayıflıyor',
      'mom.Exhausted': 'Tükenmiş',
      'mom.Building': 'Gelişiyor',
      'mom.Weak': 'Zayıf',
      'risk.Low': 'Düşük',
      'risk.Moderate': 'Orta',
      'risk.High': 'Yüksek',
      'nstruct.upStrong': 'Yükseliş yapısı güçlü devam ediyor',
      'nstruct.upHealthy': 'Yükseliş yapısı sağlam',
      'nstruct.upWeak': 'Yükseliş yapısı yorgunluk gösteriyor',
      'nstruct.upExh': 'Yükseliş yapısı aşırı uzamış',
      'nstruct.upForm': 'Yükseliş yapısı oluşuyor',
      'nstruct.downStrong': 'Düşüş yapısı güçlü devam ediyor',
      'nstruct.downHealthy': 'Düşüş yapısı sağlam',
      'nstruct.downWeak': 'Düşüş yapısı momentum kaybediyor',
      'nstruct.downExh': 'Düşüş yapısı aşırı uzamış',
      'nstruct.downForm': 'Düşüş yapısı oluşuyor',
      'nstruct.flat': 'Net yönlü yapı yok',
      'nsum.upExh': 'Uzama riski yüksek — yukarı yönlü görünümde temkin.',
      'nsum.upWeak': 'Geri çekilme riski artıyor — kârı koru.',
      'nsum.upStrong': 'Trend devamı destekleniyor.',
      'nsum.upHealthy': 'Devamlılık için yapıcı koşullar.',
      'nsum.upEarly': 'Erken aşama hareket — onay bekle.',
      'nsum.downExh': 'Ortalama dönüş riski — geç aşağı yönlü görünüm zayıf.',
      'nsum.downWeak': 'Aşağı yön momentum kaybediyor — sıçrama mümkün.',
      'nsum.downStrong': 'Aşağı yön devamı destekleniyor.',
      'nsum.downHealthy': 'Düşüş yönlü bias korunuyor.',
      'nsum.downEarly': 'Erken aşama düşüş — onay bekle.',
      'nsum.rangeHigh': 'Yüksek volatiliteyle range — fakeout meyilli.',
      'nsum.noConv': 'Yön konvansiyonu yok — sabır gerekli.',
      'nvs.ethStronger': 'ETH momentum BTC\'den daha sağlam.',
      'nvs.btcAhead': 'BTC önde — ETH yönsel olarak geride.',
      'nvs.aligned': 'BTC ve ETH uyumlu.',
      'nvs.ethWeakDiv': 'ETH, BTC gücüne karşı zayıf ayrışıyor.',
      'nvs.ethRelStrength': 'ETH, BTC\'ye göre göreceli güç gösteriyor.',
      'nvs.ethAhead': 'ETH önde, BTC sıkışıyor.',
      'nvs.ethBehind': 'ETH, BTC yönüne göre geride.',
      'footerc.disclaimer': '⚠ Bu platform yatırım tavsiyesi vermez. Tüm içerikler bilgilendirme amaçlıdır. Kripto para işlemleri yüksek risk içerir.',
      'footerc.archive': 'Analiz Arşivi',
      'footerc.about': 'Hakkımızda',
      'footerc.disclaimerLink': 'Yatırım Tavsiyesi Değildir',
      'footerc.terms': 'Kullanım Koşulları',
      'footerc.risk': 'Risk Bildirimi',
      'footerc.privacy': 'Gizlilik',
      'footerc.kvkk': 'KVKK',
      'footerc.cookies': 'Çerez',
      'footerc.contact': 'İletişim',
      'footerc.cookieSettings': 'Çerez Ayarları',
      'footerc.copyrightTag': 'AI Kripto Analiz Platformu',
      'cookie.aria': 'Çerez tercihi',
      'cookie.text': '🍪 <strong>Çerez kullanımı:</strong> Platform analytics ve oturum yönetimi için çerez kullanır. Tercihinizi değiştirmek için "Detaylar"a bakın.',
      'cookie.necessary': 'Sadece Gerekli',
      'cookie.acceptAll': 'Tümünü Kabul Et',
      'cookie.details': 'Detaylar →'
    },
    en: {
      'nav.performans': 'Performance',
      'footer.disclaimer': '⚠ This platform does not provide financial advice. Crypto assets involve high risk. Always do your own research.',
      'toast.welcome': 'Welcome',
      'toast.welcomeSource': 'Welcome — {src}',
      'toast.analysisLoaded': '{sym} analysis loaded · Start reviewing',
      'toast.platformLoaded': 'Analysis platform loaded',
      'login.premiumActivation': 'PREMIUM ACTIVATION',
      'login.premiumDesc': 'Enter your premium code. All coins and detailed analysis will unlock.',
      'login.premiumCode': 'Premium Code',
      'login.codePlaceholder': 'Enter your premium code...',
      'login.activate': 'Activate Premium',
      'login.signIn': 'Sign in',
      'login.verifying': 'Verifying...',
      'login.enterCode': '⚠ Please enter your access code.',
      'login.invalidCode': 'Invalid access code',
      'login.tooManyTry': 'Too many attempts. Try again in {n} minutes.',
      'login.tooManyFail': 'Too many failed attempts. Wait 15 minutes.',
      'login.lockedWait': '🔒 Account locked for {n} minutes. Please wait.',
      'login.locked': '🔒 Account locked for {n} minutes.',
      'login.lockedAfter': '🔒 {msg}. Account locked for {n} minutes.',
      'login.tryAgainSuffix': '. Please try again.',
      'login.deviceLimit': '🔒 This premium code has reached its device limit. Contact support@vd-securianalyst.com',
      'login.lockedBtn': 'Locked...',
      'login.connError': '⚠ Connection error: {msg}',
      'login.noCodeFooter': "If you don't have a premium code, you can keep using the site for free.",
      'login.contactForCode': 'Contact us to get a code.',
      'timer.remaining': 'Remaining:',
      'timer.unitDay': 'd',
      'timer.unitHour': 'h',
      'timer.unitMin': 'm',
      'timer.unitSec': 's',
      'timer.adminAccess': 'Admin access',
      'timer.unlimited': 'Unlimited',
      'access.unlimited': 'Unlimited access',
      'access.day1': '1 day',
      'access.days': '{n} days',
      'welcome.close': 'Close',
      'welcome.title': 'Welcome to VD SecuriAnalyst',
      'welcome.subtitle': 'AI-powered crypto technical analysis platform. Algorithmic analysis and technical patterns are for informational purposes only.',
      'welcome.warn1': 'This platform <strong>does not provide investment advice</strong>.',
      'welcome.warn2': 'Content is for educational and informational purposes.',
      'welcome.warn3': "Investment decisions are the user's responsibility.",
      'welcome.linkTerms': 'Terms of Use',
      'welcome.linkRisk': 'Risk Disclosure',
      'welcome.linkKvkk': 'Privacy Notice (KVKK)',
      'welcome.termsHtml': 'By continuing, you confirm that you have read and accept the {t}, {r} and {k}.',
      'welcome.btnTerms': 'Read Terms of Use',
      'welcome.btnAccept': 'I Understand, Continue',
      'ti.headerTitle': '◈ Market Intelligence Terminal',
      'ti.waitingData': 'waiting for data',
      'ti.relNow': 'now',
      'ti.relSec': '{n}s ago',
      'ti.relMin': '{n}m ago',
      'ti.relHour': '{n}h ago',
      'ti.cgActive': 'CoinGlass: Active',
      'ti.cgPartial': 'CoinGlass: Limited',
      'ti.cgOff': 'CoinGlass: Off',
      'ti.liveWS': 'Live WS',
      'ti.volObs': 'VOLATILITY OBSERVATION',
      'ti.pressure': 'MARKET PRESSURE',
      'ti.activity': 'ACTIVITY FEED',
      'ti.engineStart': 'Intelligence engine starting',
      'ti.engineStartSub': 'Waiting for the first scan cycle to complete...',
      'ti.catSystem': 'SYS',
      'ti.catRegime': 'REG',
      'ti.catVolatility': 'VOL',
      'ti.catSetup': 'STP',
      'ti.catPressure': 'PRS',
      'ti.catMarket': 'MKT',
      'ti.regimeLabel': 'MARKET REGIME',
      'ti.mmLabel': 'MARKET MAKER BIAS',
      'ti.waitingScan': 'Waiting for scan data...',
      'ti.regimeUnknown': 'Unknown',
      'ti.mmEmpty': 'No clear positioning yet.',
      'regime.label.CHOPPY': 'Choppy / Uncertain Market',
      'regime.label.RISK_ON': 'Risk-On Environment',
      'regime.label.RISK_OFF': 'Risk-Off Environment',
      'regime.label.LIQUIDITY_TRAP': 'Liquidity Trap',
      'regime.label.RISK_ON_FRAGILE': 'Fragile Risk-On',
      'regime.label.RISK_OFF_FRAGILE': 'Fragile Risk-Off',
      'regime.sum.choppy1': 'No clear direction. Be patient rather than chasing breakouts.',
      'regime.sum.choppy2': 'Mixed technical picture. Observation recommended for confluence.',
      'regime.sum.riskon': 'Trend continuation supported. Pullbacks may offer upside opportunities.',
      'regime.sum.riskoff': 'Downward pressure persists. Longing against the trend is high-risk.',
      'regime.sum.liqtrap': 'No clear trend but high volatility. Fakeout risk is high.',
      'regime.sum.riskonfragile': 'Trend exists but breadth is narrow. Selective longs only.',
      'regime.sum.riskofffragile': 'Downtrend holding but exhaustion signs present. Late-downside risk may rise.',
      'mm.h.overLong': 'Funding overheated — the long crowd is at risk.',
      'mm.h.overShort': 'Funding extremely negative — short-squeeze conditions are building.',
      'mm.h.squeezeRally': 'The rally is driven by short covering, not new longs.',
      'mm.h.shortBuildup': 'Shorts are building into weakness — squeeze fuel is accumulating.',
      'mm.h.liqAboveTarget': 'Liquidity sits above price — a natural target for continuation.',
      'mm.h.liqAboveTrap': 'Liquidity is building above price — long traps are possible.',
      'mm.h.liqBelow': 'Liquidity sits below price — downside targets are unhit.',
      'mm.h.belowStops': 'Stops rest below — a sweep risk exists before any reversal.',
      'mm.h.trendLong': 'The trend is supported by genuine long positions.',
      'mm.h.trendShort': 'The trend is supported by genuine short positions.',
      'mm.h.noConv': 'No directional convention — wait for structure to form.',
      'mm.h.aligned': 'Market behavior is aligned with the current trend.',
      'mm.d.overLong': 'Late longs are exposed to a liquidation cascade.',
      'mm.d.overShort': 'The short side is overextended; rallies may force shorts to cover.',
      'mm.d.squeezeRally': 'Without OI support, the rally quality is questionable.',
      'mm.d.liqAboveTarget': 'Upside liquidity targets have not been hit yet.',
      'mm.d.liqAboveTrap': 'The market may hunt aggressive longs before reversing.',
      'mm.d.belowStops': 'Late shorts may be hunted.',
      'mm.d.elevLong': 'Funding is elevated on the long side.',
      'mm.d.elevShort': 'Funding is elevated on the short side.',
      'ti.majorEmpty': 'No data.',
      'ti.bestSetupLabel': 'MOST MATURE SETUP',
      'ti.bestEmptyTitle': 'No high-quality technical setup this cycle',
      'ti.bestEmptyDesc': 'No coin passed the quality threshold. Market is being monitored.',
      'ti.whyStrong': 'What Makes It Strong',
      'ti.whatNeeds': 'What Needs to Happen Next',
      'ti.outlookEval': 'Outlook Assessment',
      'ti.riskLevel': 'Risk Level',
      'ti.maturityLabel': 'Technical Setup Maturity',
      'ti.lvlReference': 'Reference',
      'ti.lvlRiskLimit': 'Risk Limit',
      'ti.lvlTarget1': 'Target Zone 1',
      'ti.lvlTarget2': 'Target Zone 2',
      'ti.scanPrefix': 'Scan: {n} coins evaluated',
      'ti.scanStrong': 'Strong',
      'ti.scanValid': 'Valid',
      'ti.scanWeak': 'Weak',
      'ti.scanAvoid': 'Avoid',
      'ti.watchlistLabel': 'WATCHLIST',
      'ti.maturityShort': 'Maturity',
      'ti.warningsLabel': 'WARNINGS',
      'tier.ELITE': 'ELITE',
      'tier.STRONG': 'STRONG',
      'tier.VALID': 'VALID',
      'tier.WEAK': 'WEAK',
      'tier.AVOID': 'AVOID',
      'rr.biasTitle': 'AI MARKET BIAS',
      'rr.longTrend': 'Upward Bias',
      'rr.shortTrend': 'Downward Bias',
      'rr.confScore': 'AI Confidence Score:',
      'rr.biasOpen': 'Open Bias Analysis →',
      'rr.biasMicro': 'Directional distribution observation (LONG/SHORT setup count) · not investment advice.',
      'rr.oppTitle': 'TOP 3 OPPORTUNITIES',
      'rr.radarOpen': 'Open Full Radar →',
      'rr.empty': 'No suitable setup in this scan — will update on the next scan.',
      'rr.moreOpp': '+ {n} more opportunities available →',
      'rr.lockedTitle': 'AI MARKET BIAS · OPPORTUNITIES',
      'rr.lockedText': 'Directional distribution and the most mature opportunities are available to <b>Premium and Elite</b> members.',
      'rr.getAccess': 'Get Access →',
      'rr.ariaLabel': 'Market bias and opportunities',
      'rr.yonUp': 'Uptrend',
      'rr.yonDown': 'Downtrend',
      'rr.yonNeutral': 'Neutral',
      'rr.watch': 'WATCH',
      'rr.stageConfirmed': 'Confirmed',
      'rr.stageArmed': 'Ready',
      'rr.stageWatch': 'Watch',
      'rr.oppWord': 'Opportunity',
      'rr.dirLabel': 'Direction: ',
      'rr.skor': 'Score',
      'md.trendUp': 'Uptrend',
      'md.trendDown': 'Downtrend',
      'md.trendFlat': 'Flat',
      'md.momStrong': 'Strong ↑',
      'md.momWeak': 'Weak ↓',
      'md.momNeutral': 'Neutral',
      'md.riskHigh': 'High',
      'md.riskLow': 'Low',
      'md.riskMid': 'Moderate',
      'md.live': '● live',
      'md.waiting': '⏳ awaiting data',
      'md.noExt': 'no external data',
      'md.ctx': 'trend · momentum · risk — AI context (not a signal)',
      'md.newsOff': '○ news/macro source not connected',
      'md.liveBadge': 'LIVE',
      'prm.selectPlan': 'Select Plan',
      'prm.previewEnded': 'Your free preview period has ended.',
      'prm.previewEndedDesc': 'Premium membership is required to access the full analysis you were viewing and all premium tools.',
      'prm.secModules': 'Premium Modules',
      'prm.secBenefits': 'What You Gain with Premium',
      'prm.secPlans': 'Access Plans',
      'prm.ctaTelegram': 'Message on Telegram for Premium Access',
      'prm.enterPremiumCode': 'Enter Premium Code',
      'prm.statReviewed': 'Reviewed Analyses',
      'prm.statAvgRate': 'Avg. Validation Rate',
      'prm.statValidated': 'Validated Analyses',
      'prm.statLearnedSetup': 'Learned Setups',
      'prm.previewExpired': 'Preview period has ended',
      'prm.previewExpiredMsg': 'Your free preview period has ended. A Premium access code is required to access the full analysis and all platform data.',
      'prm.backHome': 'Back to home',
      'prm.preview': 'Preview',
      'prm.tgDailyDesc': 'Daily free analyses, market summaries and sample setup shares.',
      'prm.tgSimilarFree': '📢 Similar analyses are shared for free on the Telegram channel.',
      'prm.tgFollowExamples': '📢 Follow current market examples on the Telegram channel',
      'prm.tgDailyShort': 'Daily analysis, market summary and sample setups.',
      'prm.join': 'Join',
      'prm.close': 'Close',
      'prm.aiMultiLayer': 'This analysis was produced by AI in multiple layers',
      'prm.claudeLockLabel': '🔒 Premium — Claude.ai Analysis',
      'prm.copyToClaude': '📋 Copy → Claude.ai',
      'prm.priceMapPremium': 'The detailed price map is for premium users',
      'prm.promoLabel': 'Premium promo',
      'prm.unlockAllCoins': 'Unlock all coins + see the full AI analysis',
      'prm.limitedData': 'You are currently seeing only limited data',
      'prm.featuresUnlocked': 'Features unlocked with Premium membership:',
      'prm.accessAllCoins': 'Access to all coins',
      'prm.advDataLayers': 'Advanced data layers',
      'prm.partialDataRisk': 'Evaluating with incomplete data is risky',
      'prm.alreadyHaveCode': '🔑 I already have a code → Enter Premium Code',
      'prm.manualActivate': 'Premium access is activated manually. If you have a code, you can enter it here.',
      'prm.premiumLocked': 'Premium locked',
      'prm.welcomeTg': 'Welcome from Telegram',
      'prm.analysisLoadedReview': 'analysis loaded · Start your review',
      'prm.contactPerPlan': 'Hello.\n\nI would like to obtain VD SecuriAnalyst {plan} access.\n\nCould you share the details?',
      'prm.contactGeneral': 'Hello.\n\nI would like information about VD SecuriAnalyst Premium access.',
      'prm.claudeCopyNote': '🔒 The detailed Claude.ai analysis prompt is for <b>Premium</b> members. <span class="vd-claude-cta">Go Premium →</span>',
      'prm.cardLockText': '🔒 The details of this analysis are open to Premium members.',
      'prm.cardLockTap': 'Tap to view →',
      'prm.codesManual': 'Premium access codes are created manually. The payment and activation process is completed after contact. An automatic payment system will be added once the company / payment infrastructure is ready.',
      'prm.heroDesc': 'Premium access to the AI-powered analysis engine, Outcome Tracking, AI Learning, Performance Dashboard and advanced market intelligence tools.',
      'prm.featLearn': 'Setup statistics and validation rates learned from the past.',
      'prm.featReport': 'The system report card: validation rate, best coin/timeframe/setup.',
      'prm.featChart': 'Premium chart with S/R, Entry/TP/SL, structure and pattern layers.',
      'prm.featTransparent': 'Which analysis was validated, partial or not validated — transparent.',
      'prm.featAdvanced': 'Advanced analysis screen, deep technical view across all coins.',
      'prm.featTgOutcome': 'Real outcome tracking and validation of Telegram analyses.',
      'prm.featInsights': 'Turns complex market data into clear, readable insights.',
      'prm.featTimeline': 'A chronological, categorized feed of all market events.',
      'prm.featChartShort': 'Premium chart layers (S/R, Entry/TP/SL, structure)',
      'prm.featLiquidity': 'Liquidity, order block and institutional flow indicators.',
      'prm.featArchive': 'Full archive of past analyses and detailed records.',
      'prm.featConfidence': 'Setup confidence score and confirmation/missing-validation analysis.',
      'prm.featRisk': 'ATR/volatility-based risk and momentum tracking.',
      'prm.noLimit': 'No single-coin limit — full access across all coins.',
      'prm.haveCode': 'If you have a Premium code, you can sign in here.',
      'prm.bulletLearn': 'Setup statistics learned with AI Learning',
      'prm.bulletTg': 'Outcome tracking of analyses from Telegram',
      'prm.bulletArchive': 'Full access to past validation records',
      'prm.bulletTimeline': 'Market event feed with Market Timeline',
      'prm.bulletAdvanced': 'Advanced analysis screen across all coins',
      'prm.pastResults': 'Past Validation Results',
      'prm.mostPreferred': 'Most Preferred',
      'prm.allCoinAnalyses': 'All Coin Analyses',
      'prm.weekAccess': '1-Week Access',
      'prm.monthPremium': '1-Month Premium',
      'prm.dayAccess': '1-Day Access',
      'prm.quickStart': 'Quick Start',
      'prm.bestValue': 'Best Value',
      'prm.per30': '/ 30 days',
      'prm.per1': '/ 1 day',
      'prm.per7': '/ 7 days',
      'prm.backToPlans': '← Back to Premium plans',
      'prm.avgValidation': 'Avg. Validation Rate',
      'prm.validatedAnalysis': 'Validated Analyses',
      'prm.reviewedAnalysis': 'Reviewed Analyses',
      'prm.learnedSetup': 'Learned Setups',
      'prm.active': 'Active',
      'prm.modalActivate': 'Premium access is activated manually. If you have a code, you can sign in here.',
      'prm.partialRisky': 'Making an assessment with incomplete data is risky',
      'prm.featuresOpened': 'Features unlocked with Premium membership:',
      'prm.entryTargetRisk': 'Entry / target / risk levels',
      'prm.advancedLayers': 'Advanced data layers',
      'prm.allAiAnalyses': 'All AI analyses',
      'prm.allCoinsAccess': 'Access to all coins',
      'prm.goPremium': 'Go Premium',
      'prm.ctaUnlock': 'Unlock all coins + see the full AI analysis',
      'prm.ctaLimited': 'You are currently seeing only limited data',
      'prm.ctaPromo': 'Premium promo',
      'prm.aiMultilayer': ' This analysis is generated by AI in multiple layers',
      'prm.fullForPremium': ' The full analysis is for premium users',
      'prm.detailMapForPremium': 'The detailed price map is for premium users',
      'prm.goPremiumRocket': '🚀 Go Premium',
      'prm.premiumCanAccess': 'Premium users can access',
      'prm.coinForPremium': 'This coin analysis is accessible to premium users',
      'prm.loadedReview': 'analysis loaded · start reviewing',
      'prm.platformLoaded': 'Analysis platform loaded',
      'prm.welcome': 'Welcome',
      'prm.welcomeLc': 'welcome',
      'prm.tgDaily': 'Daily free analyses, market summaries and sample setup shares.',
      'prm.tgSimilar': '📢 Similar analyses are shared free on the Telegram channel.',
      'prm.tgFollow': '📢 Follow current market examples on the Telegram channel',
      'prm.tgJoinFree': '📢 Join the Free Telegram Channel',
      'prm.tgCheckFirst': '📢 Check the Free Channel First',
      'prm.tgJoinChannel': 'Join the Telegram Channel',
      'prm.tgFreeChannel': 'Free Telegram Channel',
      'prm.tgHidden': 'The details of this analysis are hidden.',
      'prm.tgDaily2': 'Daily analysis, market summary and sample setups.',
      'prm.tgJoin': 'Join',
      'prm.tgClose': 'Close',
      'arc.neutralShort': 'Neutral',
      'arc.retroStat': '⚠ This is a retrospective statistic; it shows the consistency of past analyses, not a guarantee of future returns/success.',
      'arc.dataRetry': 'Archive data could not be retrieved right now. It will retry automatically once the connection recovers; you can refresh the page.',
      'arc.learnModFail': 'The learning module could not load. Refresh the page; if the issue persists, check the deployment.',
      'arc.reviewedRate': 'reviewed analyses · validation rate = (validated + ½·partial) ÷ total',
      'arc.notEnoughCombo': 'Not enough sampled combinations yet (at least ',
      'arc.samplesNeeded': ' samples needed per pattern). It will appear as more results are computed.',
      'arc.engineNotFound': 'Learning engine (VDInsights) not found — card disabled.',
      'arc.insightErr': 'A problem occurred while computing insights (see console).',
      'arc.srcNotLoaded': 'Data source not loaded. Refresh the page.',
      'arc.learnBegin': '). Learning will begin as results are computed.',
      'arc.insightFail': 'Insights could not be shown (see console).',
      'arc.recordsReq': 'reviewed records required (currently',
      'arc.shownRate': 'has shown a validation rate.',
      'arc.dataFail': 'Archive data could not be retrieved:',
      'arc.forLearnMin': 'For learning, at least',
      'arc.strongestSetups': 'Strongest setups',
      'arc.reviewedAnalyses': 'reviewed analyses',
      'arc.validatedTilde': 'validated · ~',
      'arc.notValidatedLc': 'not validated',
      'arc.samplesCheck': 'samples · ✓',
      'arc.partialCross': 'partial · ✗',
      'arc.retroPerf': '⚠ Retrospective performance summary; it shows the consistency of past analyses, not a guarantee of future returns/success. Validation rate = (validated + ½·partial) ÷ total.',
      'arc.dataRetry2': 'Archive data could not be retrieved right now. You can refresh the page.',
      'arc.perfFail': 'Performance summary could not be shown (see console).',
      'arc.notEnoughData': 'Not enough data. For a performance summary, at least',
      'arc.reviewedReq': 'reviewed analyses required (currently',
      'arc.notEnoughCombo2': 'not enough sampled combinations',
      'arc.comboSkip': 'combo calculation skipped:',
      'arc.bestTf': 'Most successful timeframe',
      'arc.overallRate': 'Overall validation rate',
      'arc.perfSummary': '📈 Performance Summary',
      'arc.bestSetup': 'Most successful setup',
      'arc.bestCoin': 'Most successful coin',
      'arc.totalReviewed': 'Total Reviewed',
      'arc.loadErr': 'load error:',
      'arc.renderErr': 'render error:',
      'arc.weakestCoin': 'Weakest coin',
      'arc.samples': 'samples',
      'arc.partial': 'Partial',
      'arc.cardPartial': 'The analysis was partially correct, but some conditions did not show the expected performance.',
      'arc.cardLegacy': 'This record is excluded from learning and statistics (legacy outcome)',
      'arc.cardPending': 'This analysis has not been evaluated for outcome yet.',
      'arc.cardValidated': 'The analysis direction and results were largely validated.',
      'arc.cardNotValidated': 'The analysis was not validated in the expected direction.',
      'arc.viewDetail': 'View Detail →',
      'arc.actualMove': 'Actual move:',
      'arc.analysisDetail': 'analysis detail',
      'arc.partlyValidated': 'Partially Validated',
      'arc.bullish': 'Bullish',
      'arc.bearish': 'Bearish',
      'arc.neutral': 'Neutral',
      'arc.notValidated': 'Not Validated',
      'arc.validated': 'Validated',
      'arc.disc1': 'This content is not investment advice. It is a retrospective',
      'arc.disc2': 'evaluation of past analyses; it cannot be considered an indicator of future results.',
      'arc.premOnly': 'This analysis is available to Premium members only.',
      'arc.notFound': 'Record not found or cannot be displayed.',
      'arc.sharedTg': '✔ Shared on Telegram',
      'arc.tgDate': 'Telegram Share Date',
      'arc.enterCode': 'Enter Premium Access Code',
      'arc.biasLabel': 'Directional Bias',
      'arc.priceAt': 'Price at Analysis',
      'arc.statusDesc': 'Status description',
      'arc.consistScore': 'Consistency Score',
      'arc.reviewDate': 'Review Date',
      'arc.reviewPrice': 'Review Price',
      'arc.actualDir': 'Actual Direction',
      'arc.loading': 'Loading…',
      'arc.recentValidated': 'Recently Validated',
      'arc.mostAnalyzed': 'Most Analyzed',
      'arc.partlyValidShort': 'Partly Valid.',
      'arc.allRecords': 'All records',
      'arc.loadFail': 'Could not load',
      'arc.validatedWord': 'Validated',
      'arc.statistics': 'Statistics',
      'arc.underReview': 'Under review',
      'arc.allCoins': 'All Coins',
      'arc.timeRange': 'Time range',
      'arc.allStatuses': 'All Statuses',
      'arc.all': 'All',
      'arc.previewOnly': 'Preview is for this coin only. The full archive, Outcome and AI insights are in Premium.',
      'arc.viewWithPremium': 'View other coin analyses with Premium access',
      'arc.noMatch': 'No analysis matches these filters.',
      'arc.showing': 'analyses shown',
      'arc.loadMore': 'Load More',
      'ds.banner': '📦 Showing from cache · live scan refreshing…',
      'ds.oneMinAgo': '1 min ago',
      'er.backDash': '← Back to Dashboard',
      'er.lockedDesc': '<div style="color:#cdd6e4;font-size:13.5px;line-height:1.6;margin:0 0 14px">AI Market Radar shows coins in the <b style="color:#9fdfff">Watch → Ready → Confirmed</b> power tiers as structure matures before volume even enters. This layer is available to <b style="color:#9fdfff">Premium and Elite</b> members.</div>',
      'er.ranking': 'Ranking: structure maturity + confidence score + archive consistency + freshness (not direction). Watch → Ready → Confirmed — not a trade/direction recommendation; not investment advice.',
      'er.dashSummary': 'Dashboard summary — strongest setups. Workspace for all 9 cards. Not a trade/direction recommendation; not investment advice.',
      'er.biasMicro2': 'Directional distribution observation — separate from the maturity layer (Gold/Orange/Gray). Not investment advice.',
      'er.matObs2': 'Structure maturity observation — not a trade/direction recommendation, not investment advice.',
      'er.noSuitable': 'No suitable setup found in this scan — will update on the next scan.',
      'er.matObs': 'Structure maturity observation — not a trade/direction recommendation.',
      'er.biasHeader': '⚡ AI Market Bias — which side is the system today?',
      'er.archNone': 'No archive record for this coin yet.',
      'er.noStageSetup': 'No setup at this stage in this scan.',
      'er.noSuitable2': 'No suitable setup found in this scan.',
      'er.radarFullView': '⚡ AI Market Radar — Full View',
      'er.prevScan': '· previous scan · refreshing…',
      'er.moreOpps': ' more opportunities · Open All →',
      'er.featReadiness': 'Structure Maturity (Readiness)',
      'er.volAwakeStart': 'Volume Awakening started',
      'er.openRadar9': 'Open Full Radar · 9 cards →',
      'er.featCards': '9 cards · 3 power tiers',
      'er.structNotAligned': 'Structure not fully aligned',
      'er.volNotAwake': 'Volume not awake yet',
      'er.smallSample': 'Small sample yet · ',
      'er.archTitle': '⬡ ARCHIVE CONSISTENCY',
      'er.tierGold': '🥇 GOLD · Confirmed',
      'er.radarTitle': '⚡ AI Market Radar',
      'er.featStage': 'Stage Transition Tracking',
      'er.viewChart': 'View on Chart →',
      'er.mostMature': '🥇 Most Mature Opportunity',
      'er.tierOrange': '🟠 ORANGE · Armed',
      'er.confStrong': 'Confidence strong',
      'er.confLow': 'Confidence low',
      'er.roseArmed': 'Upgraded to ARMED',
      'er.momRising': 'Momentum rising',
      'er.whyStood': 'Why did it stand out?',
      'er.rangeTight': 'Range tightening',
      'er.addedWatch': 'Added to watch',
      'er.emaAligned': 'EMA/structure aligned',
      'er.eliteArch': '🔒 ELITE · ARCHIVE',
      'er.squeezeHigh': 'High compression',
      'er.volWaking': 'Volume awakening',
      'er.becameConf': 'Became CONFIRMED',
      'er.shortDom': '🔴 SHORT DOMINANT',
      'er.liveScan': '· live scan',
      'er.rsiOut': 'RSI out of band',
      'er.longDom': '🟢 LONG DOMINANT',
      'er.upBias': 'Upward bias',
      'er.dirBias': 'Directional bias: ',
      'er.goChart': 'Go to Chart →',
      'er.coinsScanned': ' coins scanned',
      'er.tierGray': '⚪ GRAY · Watch',
      'er.downBias': 'Downward bias',
      'er.staleData': '· stale data',
      'er.lastScan': 'Last scan: ',
      'er.structAligned': 'Structure aligned',
      'er.riskHigh2': 'Risk high',
      'er.consistency': ' consistency',
      'er.confScoreLbl': 'Confidence Score',
      'er.riskLow2': 'Risk low',
      'er.misleading': ' misleading',
      'er.confirmedCnt': '🥇 Confirmed ',
      'er.ctxPositive': 'Positive ▲',
      'er.ctxNegative': 'Negative ▼',
      'er.correct': ' correct · ',
      'er.partialB': ' partial · ',
      'er.balanced': '⚪ BALANCED',
      'er.watchCnt': '⚪ Watch ',
      'er.getAccess2': 'Get Access',
      'er.secAgo': 's ago',
      'er.minAgo': ' min ago',
      'er.hourAgo': 'h ago',
      'er.pipPending': 'pending',
      'er.readyCnt': '🟠 Ready ',
      'er.justNow': 'just now',
      'er.ctxStrong': 'Strong ▲',
      'er.ctxWeak': 'Weak ▼',
      'er.observations': ' observations',
      'er.pipOk': 'done',
      'er.pipConfirm': 'Confirm',
      'er.pipAlign': 'Align',
      'er.pipScore': 'Score',
      'er.ctxNeutral': 'Neutral',
      'dir.up': '▲ Uptrend',
      'dir.down': '▼ Downtrend',
      'dir.flat': '◇ Sideways',
      'mom.Strong': 'Strong',
      'mom.Healthy': 'Healthy',
      'mom.Weakening': 'Weakening',
      'mom.Exhausted': 'Exhausted',
      'mom.Building': 'Building',
      'mom.Weak': 'Weak',
      'risk.Low': 'Low',
      'risk.Moderate': 'Moderate',
      'risk.High': 'High',
      'nstruct.upStrong': 'Uptrend structure continuing strongly',
      'nstruct.upHealthy': 'Uptrend structure is solid',
      'nstruct.upWeak': 'Uptrend structure showing fatigue',
      'nstruct.upExh': 'Uptrend structure overextended',
      'nstruct.upForm': 'Uptrend structure forming',
      'nstruct.downStrong': 'Downtrend structure continuing strongly',
      'nstruct.downHealthy': 'Downtrend structure is solid',
      'nstruct.downWeak': 'Downtrend structure losing momentum',
      'nstruct.downExh': 'Downtrend structure overextended',
      'nstruct.downForm': 'Downtrend structure forming',
      'nstruct.flat': 'No clear directional structure',
      'nsum.upExh': 'Overextension risk is high — caution on the upside view.',
      'nsum.upWeak': 'Pullback risk rising — protect gains.',
      'nsum.upStrong': 'Trend continuation is supported.',
      'nsum.upHealthy': 'Constructive conditions for continuation.',
      'nsum.upEarly': 'Early-stage move — await confirmation.',
      'nsum.downExh': 'Mean-reversion risk — late downside view is weak.',
      'nsum.downWeak': 'Downside losing momentum — a bounce is possible.',
      'nsum.downStrong': 'Downside continuation is supported.',
      'nsum.downHealthy': 'Bearish bias is maintained.',
      'nsum.downEarly': 'Early-stage decline — await confirmation.',
      'nsum.rangeHigh': 'Range with high volatility — fakeout-prone.',
      'nsum.noConv': 'No directional convention — patience required.',
      'nvs.ethStronger': 'ETH momentum is firmer than BTC.',
      'nvs.btcAhead': 'BTC is ahead — ETH lags directionally.',
      'nvs.aligned': 'BTC and ETH are aligned.',
      'nvs.ethWeakDiv': 'ETH is diverging weakly against BTC strength.',
      'nvs.ethRelStrength': 'ETH shows relative strength versus BTC.',
      'nvs.ethAhead': 'ETH is ahead while BTC consolidates.',
      'nvs.ethBehind': 'ETH lags relative to BTC direction.',
      'footerc.disclaimer': '⚠ This platform does not provide investment advice. All content is for informational purposes. Crypto transactions involve high risk.',
      'footerc.archive': 'Analysis Archive',
      'footerc.about': 'About',
      'footerc.disclaimerLink': 'Not Investment Advice',
      'footerc.terms': 'Terms of Use',
      'footerc.risk': 'Risk Disclosure',
      'footerc.privacy': 'Privacy',
      'footerc.kvkk': 'KVKK',
      'footerc.cookies': 'Cookies',
      'footerc.contact': 'Contact',
      'footerc.cookieSettings': 'Cookie Settings',
      'footerc.copyrightTag': 'AI Crypto Analysis Platform',
      'cookie.aria': 'Cookie preference',
      'cookie.text': '🍪 <strong>Cookie usage:</strong> The platform uses cookies for analytics and session management. See "Details" to change your preference.',
      'cookie.necessary': 'Necessary Only',
      'cookie.acceptAll': 'Accept All',
      'cookie.details': 'Details →'
    }
  };

  function _norm(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    return LANGS.indexOf(l) >= 0 ? l : DEFAULT;
  }
  function _stored() { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } }

  // ── 170 EN View Layer: dil ROUTE'tan belirlenir ──────────────────────
  // /en, /en/, /en/*.html → 'en';  diğer tüm yollar → 'tr'.
  function _routeLang() {
    try {
      return /^\/en(\/|$)/i.test(location.pathname || '') ? 'en' : 'tr';
    } catch (e) { return null; }
  }

  // TR/EN butonu için hedef route'u hesapla (route switch gibi çalışır)
  function _routeFor(lang) {
    var p = location.pathname || '/';
    var inEn = /^\/en(\/|$)/i.test(p);
    if (lang === 'en') {
      if (inEn) return null;
      return (p === '/' || p === '') ? '/en/' : '/en' + p;
    }
    if (!inEn) return null;
    return p.replace(/^\/en(\/|$)/i, '/') || '/';
  }

  var _lang = _norm(_routeLang() || _stored() || DEFAULT);

  function getLang() { return _lang; }

  function _applyHtmlLang() {
    try { document.documentElement.setAttribute('lang', _lang); } catch (e) {}
  }

  function setLang(l) {
    var nl = _norm(l);
    if (nl === _lang) { _applyHtmlLang(); _syncSwitches(); return _lang; }
    _lang = nl;
    try { localStorage.setItem(LS_KEY, _lang); } catch (e) {}
    _applyHtmlLang();
    _syncSwitches();
    applyStatic(document);     // statik [data-i18n] düğümlerini yeni dile çevir
    _translateNav(document);   // nav "Performans" etiketini yeni dile çevir
    try { window.dispatchEvent(new CustomEvent('vd:lang:change', { detail: { lang: _lang } })); } catch (e) {}
    return _lang;
  }
  function toggle() { return setLang(_lang === 'tr' ? 'en' : 'tr'); }

  function _interp(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] != null) ? vars[k] : m;
    });
  }
  function _lookup(key, fallback) {
    var d = DICT[_lang] || {};
    if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    if (fallback != null) return fallback;
    var dtr = DICT.tr || {};
    if (Object.prototype.hasOwnProperty.call(dtr, key)) return dtr[key];
    return key;
  }
  // t(anahtar)                → çeviri
  // t(anahtar, "yedek")       → sözlükte yoksa yedek metin (applyStatic kullanır)
  // t(anahtar, { n: 5 })      → {n} gibi yer tutucuları doldurur
  function t(key, opt) {
    var isVars = (opt && typeof opt === 'object');
    var str = _lookup(key, isVars ? null : opt);
    return isVars ? _interp(str, opt) : str;
  }

  // Statik HTML çevirisi: [data-i18n="anahtar"] → textContent; [data-i18n-attr="placeholder:anahtar;title:anahtar2"] → öznitelik.
  // 170.B-1'de sayfalarda böyle düğüm YOK → güvenli no-op. B-2+ kullanılacak.
  function applyStatic(root) {
    try {
      root = root || document;
      if (!root.querySelectorAll) return;
      var nodes = root.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i], key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key, el.textContent);
      }
      var attrNodes = root.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < attrNodes.length; j++) {
        var el2 = attrNodes[j];
        var spec = el2.getAttribute('data-i18n-attr') || '';
        var pairs = spec.split(';');
        for (var k = 0; k < pairs.length; k++) {
          var kv = pairs[k].split(':');
          if (kv.length === 2) {
            var attr = kv[0].trim(), kk = kv[1].trim();
            if (attr && kk) el2.setAttribute(attr, t(kk, el2.getAttribute(attr) || ''));
          }
        }
      }
    } catch (e) {}
  }

  // ── Dil değiştirici (nav'a enjekte edilir) ──────────────────────────
  function _makeSwitch() {
    var wrap = document.createElement('div');
    wrap.className = 'vdn-i18n-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Dil / Language');
    for (var i = 0; i < LANGS.length; i++) {
      (function (l) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'vdn-i18n-btn' + (l === _lang ? ' active' : '');
        b.setAttribute('data-lang', l);
        b.setAttribute('aria-label', l === 'tr' ? 'Türkçe' : 'English');
        b.textContent = l.toUpperCase();
        b.addEventListener('click', function () {
          var url = _routeFor(l);
          if (url) location.href = url + (location.search || '') + (location.hash || '');
        });
        wrap.appendChild(b);
      })(LANGS[i]);
    }
    return wrap;
  }

  function _syncSwitches() {
    try {
      var btns = document.querySelectorAll('.vdn-i18n-switch .vdn-i18n-btn');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-lang') === _lang) btns[i].classList.add('active');
        else btns[i].classList.remove('active');
      }
    } catch (e) {}
  }

  function _injectStyle() {
    if (document.getElementById('vdn-i18n-style')) return;
    var css =
      '.vdn-i18n-switch{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto;' +
        'border:1px solid var(--v4-border,rgba(255,255,255,0.10));border-radius:8px;padding:2px}' +
      '.vdn-i18n-switch--push{margin-left:auto}' +
      '.vdn-i18n-btn{font:inherit;cursor:pointer;background:transparent;border:none;' +
        'color:var(--v4-text-2,#7FA9C9);font-size:12px;font-weight:700;letter-spacing:.02em;' +
        'padding:4px 9px;border-radius:6px;line-height:1;transition:color .15s,background .15s}' +
      '.vdn-i18n-btn:hover{color:var(--v4-text,#EAF6FF)}' +
      '.vdn-i18n-btn.active{color:var(--v4-cyan,#00D1FF);background:rgba(0,209,255,0.10)}' +
      '.vdn-i18n-switch--drawer{margin:0 20px 14px;width:calc(100% - 40px);justify-content:center}';
    var tag = document.createElement('style');
    tag.id = 'vdn-i18n-style';
    tag.textContent = css;
    (document.head || document.documentElement).appendChild(tag);
  }

  var _topDone = false, _drawerDone = false;
  // Switcher'ın yerleşeceği "yuva": önce sağ küme (snug), yoksa sayfa header'ı (sağa it).
  //   index.html → .topbar-right · aic-header sayfaları → .aic-nav · diğerleri → .vd-page-header
  function _findSlot() {
    var cluster = document.querySelector('.topbar-right')
               || document.querySelector('.aic-header .aic-nav');
    if (cluster) return { el: cluster, push: false };
    var header = document.querySelector('.vd-page-header')
              || document.querySelector('.aic-header')
              || document.querySelector('.topbar');
    if (header) return { el: header, push: true };
    return null;
  }

  function _injectSwitches() {
    // 1) Üst-sağ (masaüstü; index'te mobilde de görünür)
    if (!_topDone) {
      var slot = _findSlot();
      if (slot && slot.el && !slot.el.querySelector('.vdn-i18n-switch')) {
        var sw = _makeSwitch();
        if (slot.push) sw.classList.add('vdn-i18n-switch--push');
        slot.el.appendChild(sw);
        _topDone = true;
      }
    }
    // 2) Mobil drawer (header sağ kümesi mobilde gizlenirse erişim buradan)
    if (!_drawerDone) {
      var dr = document.querySelector('.vdn-drawer');
      if (dr && !dr.querySelector('.vdn-i18n-switch')) {
        var sw2 = _makeSwitch();
        sw2.classList.add('vdn-i18n-switch--drawer');
        var hdr = dr.querySelector('.vdn-drawer-hdr');
        if (hdr) hdr.insertAdjacentElement('afterend', sw2); else dr.appendChild(sw2);
        _drawerDone = true;
      }
    }
    return _topDone && _drawerDone;
  }

  // Nav'da YALNIZ çevrilen etiketi (Performans) günceller — nav.js'e dokunmadan, data-key ile.
  function _translateNav(root) {
    try {
      root = root || document;
      if (!root.querySelectorAll) return;
      var anchors = root.querySelectorAll('[data-key="performans"]');
      var label = t('nav.performans');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var lbl = a.querySelector('.vdn-lbl');
        if (lbl) { lbl.textContent = label; continue; }
        for (var n = 0; n < a.childNodes.length; n++) {
          var node = a.childNodes[n];
          if (node.nodeType === 3 && node.textContent && node.textContent.trim()) { node.textContent = label; break; }
        }
      }
    } catch (e) {}
  }

  function _boot() {
    _applyHtmlLang();
    _injectStyle();
    applyStatic(document);     // statik [data-i18n] (footer vb.) — açılışta aktif dile çevir
    // nav.js DOMContentLoaded'da mount oluyor; yükleme sırası garanti değil → kısa retry ile bekle.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      _translateNav(document);
      if (_injectSwitches() || tries > 30) { _syncSwitches(); clearInterval(iv); }
    }, 120);
    _injectSwitches();
    _translateNav(document);
    _syncSwitches();
  }

  // <html lang>'i mümkün olan en erken anda ayarla (script çalışır çalışmaz)
  _applyHtmlLang();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  // Dışa açık API (B-2+ bileşenleri kullanacak)
  window.VDI18n = {
    getLang: getLang,
    setLang: setLang,
    toggle: toggle,
    t: t,
    applyStatic: applyStatic,
    LANGS: LANGS.slice()
  };

  // ── Global çeviri yardımcısı (B-3+ JS bileşenleri için) ──────────────
  // Kullanım:
  //   VDt('key')                       → çeviri (yoksa anahtarın kendisi)
  //   VDt('key', { n: 5 })             → {n} gibi yer tutucuları doldurur
  //   VDt('key', null, 'Türkçe yedek') → sözlükte yoksa yedek metin
  // Çağıran dosyalar i18n.js yüklenmeden önce çalışabileceğinden,
  // her zaman (window.VDt ? VDt(...) : yedek) kalıbıyla çağrılmalıdır.
  window.VDt = function (key, vars, fallback) {
    try {
      var opt = (vars && typeof vars === 'object') ? vars : fallback;
      return t(key, opt);
    } catch (e) {
      return (fallback != null) ? fallback : key;
    }
  };
})();
