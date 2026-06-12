// ════════════════════════════════════════════════════════════════════
// HYBRID INSIGHTS — Faz 5 · Learning Engine bulgu üreticisi (SAF fonksiyon)
//
// Girdi: hybrid_matrix yanıtı (sides + factors + matrix).
// Çıktı: kanıta dayalı, istatistiksel korumalı bulgu cümleleri.
//
// İlkeler:
//   • UYDURMA YOK: her bulgu için iki tarafta da en az MIN_N çözülmüş kayıt
//     ve anlamlı fark (GAP_MIN puan) şartı — yoksa bulgu üretilmez.
//   • DÜRÜSTLÜK ÇİFT YÖNLÜ: faktör işe yaramıyorsa / Price tek başına
//     Hybrid'den iyiyse bunu da AYNEN söyler (ağırlık revizyonu sinyali).
//   • Her bulgunun yanında kanıt: oranlar + örnek sayıları.
//   • "Deriv daha erken sinyal veriyor" analizi mevcut şemayla yapılamaz
//     (verdict geçiş zamanı kaydedilmiyor) — bu motor onu İDDİA ETMEZ.
//
// API: window.VDHybridInsights.derive(data) →
//   { ready, totalResolved, insights: [{ code, tone, key, vars, fallback, evidence }] }
//   tone: 'strong' (yeşil) | 'negative' (kırmızı) | 'info' (gri)
// ════════════════════════════════════════════════════════════════════
window.VDHybridInsights = (function () {
  'use strict';

  const CFG = {
    MIN_N: 10,        // her karşılaştırma tarafında en az bu kadar ÇÖZÜLMÜŞ kayıt
    GAP_MIN: 8,       // "etkili" demek için en az bu kadar puan fark
    GAP_STRONG: 15,   // "güçlü" demek için
    READY_MIN: 30,    // toplam çözülmüş kayıt bundan azsa motor "erken" der
  };

  const _ok = (c) => c && c.resolved >= CFG.MIN_N && c.confirmRate != null;
  const _ev = (a, b, aL, bL) =>
    '%' + a.confirmRate + ' (' + aL + ', n=' + a.resolved + ') vs %' + b.confirmRate + ' (' + bL + ', n=' + b.resolved + ')';

  // ── Faktör karşılaştırması → bulgu (pozitif/negatif/etkisiz) ───────
  function _factorInsight(code, withC, withoutC, posKey, posF, negKey, negF, withL, withoutL) {
    if (!_ok(withC) || !_ok(withoutC)) return null;
    const gap = withC.confirmRate - withoutC.confirmRate;
    const evidence = _ev(withC, withoutC, withL, withoutL);
    if (gap >= CFG.GAP_MIN) {
      return { code, tone: gap >= CFG.GAP_STRONG ? 'strong' : 'info',
        key: posKey, vars: { g: gap }, fallback: posF.replace('{g}', String(gap)),
        evidence, gap };
    }
    if (gap <= -CFG.GAP_MIN) {
      return { code, tone: 'negative',
        key: negKey, vars: { g: Math.abs(gap) }, fallback: negF.replace('{g}', String(Math.abs(gap))),
        evidence, gap };
    }
    return { code, tone: 'info',
      key: 'li.noEffect', vars: { f: code },
      fallback: code + ' tek başına belirgin fark yaratmıyor (şimdilik).',
      evidence, gap };
  }

  function derive(data) {
    const out = { ready: false, totalResolved: 0, insights: [] };
    if (!data || !data.sides || !data.factors) return out;
    const S = data.sides, F = data.factors, M = data.matrix || {};

    // Toplam çözülmüş (hybrid tarafı üstünden)
    let total = 0;
    ['CONFIRMED', 'ARMED', 'WATCH'].forEach(v => {
      const c = S.hybrid && S.hybrid[v]; if (c) total += (c.resolved || 0);
    });
    out.totalResolved = total;
    if (total < CFG.READY_MIN) {
      out.insights.push({ code: 'EARLY', tone: 'info', key: 'li.early',
        vars: { n: total, min: CFG.READY_MIN },
        fallback: 'Bulgular için henüz erken — ' + total + '/' + CFG.READY_MIN + ' çözülmüş kayıt. Veri biriktikçe bu bölüm kendiliğinden dolacak.',
        evidence: null });
      return out;
    }
    out.ready = true;

    // 1) HYBRID vs taraflar (direktifin ana sorusu)
    const hp = S.hybrid && S.hybrid.CONFIRMED, pp = S.price && S.price.CONFIRMED, dp = S.deriv && S.deriv.CONFIRMED;
    if (_ok(hp) && _ok(pp) && _ok(dp)) {
      const ev = '%' + hp.confirmRate + ' hybrid (n=' + hp.resolved + ') · %' + pp.confirmRate + ' price (n=' + pp.resolved + ') · %' + dp.confirmRate + ' deriv (n=' + dp.resolved + ')';
      if (hp.confirmRate >= pp.confirmRate + 5 && hp.confirmRate >= dp.confirmRate + 5) {
        out.insights.push({ code: 'HYBRID_BEST', tone: 'strong', key: 'li.hybridBest', vars: {},
          fallback: 'Hybrid model her iki taraftan da daha başarılı — birleşim değer üretiyor.', evidence: ev });
      } else if (pp.confirmRate >= hp.confirmRate + 5) {
        out.insights.push({ code: 'PRICE_BEST', tone: 'negative', key: 'li.priceBest', vars: {},
          fallback: 'Price tek başına Hybrid\'den daha isabetli — ağırlık (0.6/0.4) revizyonu düşünülmeli.', evidence: ev });
      } else if (dp.confirmRate >= hp.confirmRate + 5) {
        out.insights.push({ code: 'DERIV_BEST', tone: 'negative', key: 'li.derivBest', vars: {},
          fallback: 'Derivative tek başına Hybrid\'den daha isabetli — deriv ağırlığı artırılabilir.', evidence: ev });
      } else {
        out.insights.push({ code: 'SIDES_CLOSE', tone: 'info', key: 'li.sidesClose', vars: {},
          fallback: 'Taraflar arasında henüz belirleyici fark yok — dönem sonunu bekle.', evidence: ev });
      }
    }

    // 2) Uyum bonusu: iki taraf birden Confirmed vs price-Confirmed + deriv yok
    const agree = M.CONFIRMED && M.CONFIRMED.CONFIRMED, alone = M.CONFIRMED && M.CONFIRMED.NA;
    if (_ok(agree) && _ok(alone) && agree.confirmRate - alone.confirmRate >= CFG.GAP_MIN) {
      out.insights.push({ code: 'AGREEMENT_BONUS', tone: 'strong', key: 'li.agreementBonus',
        vars: { a: agree.confirmRate, b: alone.confirmRate },
        fallback: 'İki taraf aynı anda Confirmed olduğunda doğrulanma %' + agree.confirmRate + '\'e çıkıyor (deriv\'siz price-Confirmed: %' + alone.confirmRate + ').',
        evidence: _ev(agree, alone, 'uyum', 'yalnız price') });
    }

    // 3-6) Faktörler
    const fIns = [];
    let r = _factorInsight('FUNDING', F.funding && F.funding.with, F.funding && F.funding.without,
      'li.fundingPos', 'Funding Alignment doğrulamayı +{g} puan artırıyor.',
      'li.fundingNeg', 'Funding Alignment beklenenin tersine çalışıyor (-{g} puan) — faktör gözden geçirilmeli.',
      'uyumlu', 'uyumsuz');
    if (r) fIns.push(r);
    r = _factorInsight('OI', F.oi && F.oi.with, F.oi && F.oi.without,
      'li.oiPos', 'OI Expansion doğrulamayı +{g} puan artırıyor.',
      'li.oiNeg', 'OI Expansion beklenenin tersine çalışıyor (-{g} puan).',
      'genişlerken', 'genişlemezken');
    if (r) fIns.push(r);
    r = _factorInsight('SMART', F.positioning && F.positioning.with, F.positioning && F.positioning.against,
      'li.smartPos', 'Smart money hizalanması doğrulamayı +{g} puan artırıyor.',
      'li.smartNeg', 'Smart money hizalanması beklenenin tersine çalışıyor (-{g} puan).',
      'bizimle', 'karşımızda');
    if (r) fIns.push(r);
    r = _factorInsight('LIQ', F.liq && F.liq.clean, F.liq && F.liq.storm,
      'li.liqPos', 'Temiz likidasyon bağlamı (CLEAN) doğrulamayı +{g} puan artırıyor.',
      'li.liqNeg', 'Likidasyon bağlamı beklenenin tersine çalışıyor (-{g} puan).',
      'CLEAN', 'STORM');
    if (r) fIns.push(r);

    // En güçlü pozitif faktörü işaretle ("en güçlü teyitlerden biri")
    const positives = fIns.filter(i => i.gap != null && i.gap >= CFG.GAP_MIN);
    if (positives.length >= 2) {
      const best = positives.slice().sort((a, b) => b.gap - a.gap)[0];
      best.key2 = 'li.strongest';
      best.fallback2 = 'Bu, ölçülen en güçlü teyit faktörü.';
    }
    out.insights = out.insights.concat(fIns);

    // 6b) ÖNCÜLÜK — "Deriv daha erken mi?" (10. iş; direktifin son açık sorusu)
    if (data.lead && data.lead.armed && data.lead.armed.n >= CFG.MIN_N) {
      const L = data.lead.armed;
      const ev = 'ort. ' + (L.avgMin >= 0 ? '+' : '') + L.avgMin + ' dk · deriv önde %' + L.derivFirstPct + ' · n=' + L.n;
      if (L.avgMin >= 5) {
        out.insights.push({ code: 'LEAD_DERIV', tone: L.avgMin >= 15 ? 'strong' : 'info', key: 'li.leadDeriv',
          vars: { m: L.avgMin, p: L.derivFirstPct },
          fallback: 'Derivative, ARMED seviyesine ortalama ' + L.avgMin + ' dk ÖNCE ulaşıyor (önde olma oranı %' + L.derivFirstPct + ') — erken sinyal hipotezi destekleniyor.',
          evidence: ev });
      } else if (L.avgMin <= -5) {
        out.insights.push({ code: 'LEAD_PRICE', tone: 'info', key: 'li.leadPrice',
          vars: { m: Math.abs(L.avgMin), p: 100 - L.derivFirstPct },
          fallback: 'Price Structure, ARMED seviyesine ortalama ' + Math.abs(L.avgMin) + ' dk önce ulaşıyor — bu dönemde fiyat tarafı öncü.',
          evidence: ev });
      } else {
        out.insights.push({ code: 'LEAD_NONE', tone: 'info', key: 'li.leadNone', vars: {},
          fallback: 'İki taraf ARMED seviyesine yaklaşık aynı anda ulaşıyor — belirgin öncülük yok (şimdilik).',
          evidence: ev });
      }
    }

    // 7) Kurtulan fırsatlar (Outcome Quality — direktifin "görünmez kalmasın" maddesi)
    let inv = 0, rec = 0;
    ['CONFIRMED', 'ARMED', 'WATCH'].forEach(p => ['CONFIRMED', 'ARMED', 'WATCH', 'NA'].forEach(d => {
      const c = M[p] && M[p][d]; if (!c) return;
      inv += (c.invalidated || 0); rec += (c.recovered || 0);
    }));
    if (inv >= CFG.MIN_N && rec > 0) {
      const pct = Math.round((rec / inv) * 100);
      out.insights.push({ code: 'RECOVERED', tone: pct >= 25 ? 'strong' : 'info', key: 'li.recovered',
        vars: { p: pct, r: rec, i: inv },
        fallback: 'Invalidated kayıtların %' + pct + '\'i (' + rec + '/' + inv + ') aslında ciddi lehte hareket üretti — first-hit eşiği araştırma konusu.',
        evidence: rec + '/' + inv + ' invalidated_then_recovered' });
    }

    return out;
  }

  return { derive, CFG };
})();
