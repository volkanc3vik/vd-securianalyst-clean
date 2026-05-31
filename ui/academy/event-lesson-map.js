// ════════════════════════════════════════════════════════════════════
// ui/academy/event-lesson-map.js  — Timeline event → Academy ders eşlemesi
//
// Timeline event'leri ayrı bir "kategori" alanı taşımaz; tür bilgisi
// event.msg metninde ve event.dir alanındadır. Bu modül SALT OKUMA yapar:
// bir event nesnesi alır, ilgili ders id'lerini döndürür. Timeline UI'ına,
// feeder'a veya event store'a HİÇBİR yazma/müdahale yoktur.
//
// window.VDEventLessonMap.mapEvent(event) -> [lessonId, ...]
// window.VDEventLessonMap.RULES          -> kural tablosu (şeffaflık)
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Anahtar kelime/regex → ders id'leri. Sıra önemli değil; eşleşen hepsi döner.
  const RULES = [
    { re: /likidite süpürme|liquidity sweep|sweep/i,             lessons: ['liquidity-sweep'] },
    { re: /stop avı|sahte kırılım|aşırı uzama|fake ?break/i,     lessons: ['fake-breakout', 'stop-hunt'] },
    { re: /breakout|kırıl(dı|ım)|direnç kırıl|destek kırıl/i,    lessons: ['breakout'] },
    { re: /retest|geri test/i,                                    lessons: ['retest'] },
    { re: /funding/i,                                             lessons: ['funding'] },
    { re: /open interest|(?:^|\W)oi(?:\W|$)|açık ilgi/i,          lessons: ['open-interest'] },
    { re: /likidasyon|liquidation|tasfiye/i,                      lessons: ['liquidation'] },
    { re: /smart money|emilim|order ?block/i,                     lessons: ['order-block', 'liquidity-sweep'] },
    { re: /fair value|fvg/i,                                      lessons: ['fvg'] },
    { re: /equal high|eşit tepe/i,                                lessons: ['equal-high'] },
    { re: /equal low|eşit dip/i,                                  lessons: ['equal-low'] },
    { re: /bos|yapı kırıl/i,                                      lessons: ['bos'] },
    { re: /choch|karakter değiş/i,                                lessons: ['choch'] },
    { re: /squeeze|sıkışma|bollinger/i,                           lessons: ['bollinger'] },
    { re: /momentum|ivme/i,                                       lessons: ['momentum'] },
    { re: /rsi|aşırı al|aşırı sat/i,                              lessons: ['rsi'] },
  ];

  // dir alanına göre ek/yedek eşleme (msg eşleşmezse)
  const DIR_FALLBACK = {
    fake:  ['fake-breakout', 'stop-hunt'],
    long:  ['breakout', 'momentum'],
    short: ['breakout', 'momentum'],
    warn:  ['funding', 'risk-reward'],
    info:  ['open-interest'],
  };

  function mapEvent(event) {
    if (!event) return [];
    const text = String(event.msg || event.text || event.title || '');
    const out = new Set();
    RULES.forEach(r => { if (r.re.test(text)) r.lessons.forEach(id => out.add(id)); });
    if (out.size === 0) {
      const fb = DIR_FALLBACK[event.dir];
      if (fb) fb.forEach(id => out.add(id));
    }
    return Array.from(out);
  }

  // Bir ders, hangi event türü etiketleriyle ilişkili? (kart rozetleri için)
  function lessonEventTags(lesson) {
    return Array.isArray(lesson && lesson.events) ? lesson.events : [];
  }

  window.VDEventLessonMap = { mapEvent, lessonEventTags, RULES };
})();
