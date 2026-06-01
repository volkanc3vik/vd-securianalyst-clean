// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — TELEGRAM WEBHOOK (Phase 3 — referral altyapısı)
// Inbound update'leri işler: /start, /davet, /liderlik, chat_member.
// ÖDÜL YOK (Phase 4/5). Sadece kayıt + "kim kimi getirdi".
//
// DOKUNMAZ: api/telegram-send.js, analiz gönderimi, archive bridge,
//           premium kod, reward, site UI. Bu AYRI bir endpoint.
//
// Güvenlik: Telegram secret token (header X-Telegram-Bot-Api-Secret-Token)
//   process.env.TELEGRAM_WEBHOOK_SECRET ile doğrulanır. ADMIN_KEY ile KARIŞTIRILMAZ.
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_FREE_CHANNEL_ID, TELEGRAM_WEBHOOK_SECRET,
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID;
const SECRET     = process.env.TELEGRAM_WEBHOOK_SECRET;
const SB_URL     = process.env.SUPABASE_URL;
const SB_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VALID_HOURS = 48;

// ── Telegram API ──
async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) console.warn('[TG_WEBHOOK] tg', method, 'fail:', data.description || r.status);
  return data;
}
const sendMsg = (chatId, text, extra) => tg('sendMessage', Object.assign({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }, extra || {}));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ── Supabase REST (service_role; archive deseniyle aynı) ──
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`supabase_${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
const sbSelect = (table, q) => sb(`${table}?${q}`);
const sbInsert = (table, row, prefer = 'return=representation') => sb(table, { method: 'POST', body: row, prefer });
const sbPatch  = (table, q, patch) => sb(`${table}?${q}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });

// ════════════ ÖDÜL MOTORU (Phase 5) ════════════
// Premium kod sistemi (access_codes) ile mevcut formatı KORUYARAK bağlanır.
// admin-codes.js'e DOKUNULMAZ; access_codes'a service_role ile doğrudan yazılır.
const PLANS = {
  weekly:  { name: 'Weekly Access',  days: 7,  price: 100, prefix: 'WEEK'  },
  monthly: { name: 'Monthly Access', days: 30, price: 300, prefix: 'MONTH' },
};
// kademe → ödül (admin-codes formatıyla birebir)
const REWARD_TIERS = [
  { tier: 3,  plan: 'weekly',  label: '7 Gün Premium'  },
  { tier: 10, plan: 'monthly', label: '30 Gün Premium' },
  { tier: 25, plan: null,      label: 'Elite Adayı'    }, // kod yok, sadece etiket
];

function genCodeChunk() {
  const ab = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(4); let o = '';
  for (let i = 0; i < 4; i++) o += ab[b[i] % ab.length];
  return o;
}
const genCode    = (planId) => `VD-${PLANS[planId].prefix}-${genCodeChunk()}-${genCodeChunk()}`;
const sha256      = (s) => crypto.createHash('sha256').update(s).digest('hex');
const makePreview = (c) => { const p = c.split('-'); return p.length === 4 ? `${p[0]}-${p[1]}-****-${p[3]}` : c; };

// access_codes'a ödül kodu yaz (admin-codes 'create' ile aynı şema), düz kodu döndür
async function grantPremiumCode(planId) {
  const plan = PLANS[planId];
  const code = genCode(planId);
  const row = {
    code_hash: sha256(code), code_preview: makePreview(code),
    plan_id: planId, plan_name: plan.name, duration_days: plan.days, price_usd: plan.price,
    status: 'unused', source: 'referral_reward', created_by: 'tg_referral',
    max_devices: 2, active_devices: 0, device_ids: [],
  };
  const inserted = await sbInsert('access_codes', row); // service_role yetkili (admin-codes da böyle yazıyor)
  const id = inserted && inserted[0] && inserted[0].id;
  return { code, id, preview: row.code_preview };
}

// LAZY doğrulama + ödül kontrolü — /start, /davet, /liderlik'te çağrılır
async function validateAndReward(tgId, chatId) {
  try {
    // 1) 48s dolan + hâlâ üye + henüz geçersiz kayıtları geçerli yap
    const nowIso = new Date().toISOString();
    const matured = await sbSelect('tg_referrals',
      `referrer_tg_id=eq.${tgId}&still_member=eq.true&is_valid=eq.false&valid_after=lt.${nowIso}&select=id`);
    if (matured && matured.length) {
      const ids = matured.map(r => r.id);
      await sbPatch('tg_referrals', `id=in.(${ids.join(',')})`, { is_valid: true });
    }
    // 2) geçerli davet sayısını yeniden say (still_member & is_valid)
    const validRows = await sbSelect('tg_referrals',
      `referrer_tg_id=eq.${tgId}&still_member=eq.true&is_valid=eq.true&select=id`);
    const validCount = (validRows || []).length;
    await sbPatch('tg_users', `tg_id=eq.${tgId}`, { valid_invite_count: validCount });

    // 3) hak edilen ama henüz verilmemiş ödülleri ver
    const given = await sbSelect('tg_rewards', `referrer_tg_id=eq.${tgId}&select=tier`);
    const givenTiers = new Set((given || []).map(r => r.tier));
    for (const rt of REWARD_TIERS) {
      if (validCount < rt.tier || givenTiers.has(rt.tier)) continue;
      let codeInfo = null;
      if (rt.plan) { try { codeInfo = await grantPremiumCode(rt.plan); } catch (e) { console.warn('[TG_REWARD] kod üretilemedi:', e.message); continue; } }
      // önce geçmişe yaz (idempotency — unique index çift veriyi engeller), sonra DM
      try {
        await sbInsert('tg_rewards', {
          referrer_tg_id: tgId, tier: rt.tier, reward_label: rt.label,
          plan_id: rt.plan, access_code_id: (codeInfo && codeInfo.id) || null,
          code_preview: (codeInfo && codeInfo.preview) || null,
        }, 'return=minimal');
        await sbPatch('tg_users', `tg_id=eq.${tgId}`, { last_reward_tier: rt.tier });
      } catch (e) {
        // unique çakışması = zaten verilmiş → DM atma, geç
        console.warn('[TG_REWARD] zaten verilmiş veya yazılamadı:', rt.tier, e.message); continue;
      }
      // DM (kullanıcı botu açtığı için DM atılabilir)
      if (chatId) {
        if (rt.plan && codeInfo) {
          await sendMsg(chatId,
            `🎉 <b>Tebrikler!</b>\n${rt.tier} geçerli davete ulaştın.\n<b>${rt.label}</b> ödülün hazır.\n\n` +
            `Premium kodun:\n<code>${codeInfo.code}</code>\n\nBu kodu sitede girerek aktive et. 🚀`);
        } else {
          await sendMsg(chatId,
            `🎉 <b>Tebrikler!</b>\n${rt.tier} geçerli davete ulaştın.\n<b>${rt.label}</b> oldun! Elite sistemi yakında aktifleşince haber vereceğiz. 👑`);
        }
      }
      console.log('[TG_REWARD] verildi:', tgId, 'tier', rt.tier);
    }
    return validCount;
  } catch (e) { console.warn('[TG_REWARD] validateAndReward err:', e.message); return null; }
}

// ════════════ MESAJ FORMATLARI (merkezi — Phase 4) ════════════
const REWARD = { target: 3, label: '7 gün Premium' }; // ilk kademe (Phase 5'te aktifleşir)

// Paylaş butonu URL'i (URL-ENCODE'lu)
function shareUrl(inviteLink) {
  const txt = "Merhaba 👋\nBen VD SecuriAnalyst kullanıyorum.\nÜcretsiz analizler ve piyasa içgörüleri için katılabilirsin:";
  return `https://t.me/share/url?url=${encodeURIComponent(inviteLink || '')}&text=${encodeURIComponent(txt)}`;
}
// inline klavye: Paylaş = URL buton (callback gerekmez), diğerleri callback
function mainKb(inviteLink) {
  const rows = [];
  if (inviteLink) rows.push([{ text: '📢 Davet Linkimi Paylaş', url: shareUrl(inviteLink) }]);
  rows.push([{ text: '📊 Davet Durumum', callback_data: 'davet' }, { text: '🏆 Liderlik', callback_data: 'liderlik' }]);
  rows.push([{ text: '🎁 Ödüller', callback_data: 'odul' }]);
  return { inline_keyboard: rows };
}

function fmtStart(user, leader) {
  const total = user.invite_count || 0, valid = user.valid_invite_count || 0;
  const pending = Math.max(0, total - valid);
  let s = `Merhaba 👋\n<b>VD SecuriAnalyst</b> davet sistemine hoş geldin.\n\n`;
  s += `📊 <b>Durumun</b>\nToplam Davet: <b>${total}</b>\nGeçerli Davet: <b>${valid}</b>\nBekleyen Davet: <b>${pending}</b>\n\n`;
  s += `🔗 <b>Davet Linkin</b>\n${user.invite_link}\nBu linki paylaşarak ödül kazanabilirsin.\n\n`;
  if (leader && ((leader.valid_invite_count || 0) > 0 || (leader.invite_count || 0) > 0)) {
    const ln = leader.username ? '@' + esc(leader.username) : esc(leader.first_name || 'kullanıcı');
    const lc = leader.valid_invite_count || leader.invite_count || 0;
    s += `🏆 <b>Bu Haftanın Lideri</b>\n${ln} — ${lc} geçerli davet\n\n`;
  }
  s += `Ödülleri görmek için 🎁 <b>Ödüller</b> butonuna bas.\n\n`;
  s += `Komutlar:\n/davet — Davet durumun\n/liderlik — Liderlik tablosu`;
  return s;
}
function fmtDavet(user) {
  const total   = user.invite_count || 0;
  const valid   = user.valid_invite_count || 0;
  const pending = Math.max(0, total - valid);
  const remain  = Math.max(0, REWARD.target - valid);
  return `📊 <b>Davet Panelin</b>\n\n` +
    `Toplam davet: <b>${total}</b>\n` +
    `Geçerli davet: <b>${valid}</b>\n` +
    `Bekleyen davet: <b>${pending}</b>\n\n` +
    `⏳ Geçerli davetler 48 saat sonra aktifleşir. Geçerli sayılması için üyelerin <b>48 saat</b> kanalda kalması gerekir — bu, sahte giriş/çıkışları engellemek içindir.\n\n` +
    `🎁 Bir sonraki ödül: <b>${REWARD.target} geçerli davet → ${REWARD.label}</b>\n` +
    (remain > 0 ? `Kalan: <b>${remain}</b> kişi\n` : `Hedefe ulaştın! 🎉\n`) +
    `\nDavet linkin:\n${user.invite_link || '(yok — /start yaz)'}`;
}
function fmtLiderlik(rows) {
  if (!rows || !rows.length) return 'Henüz liderlik verisi oluşmadı. İlk davet edenlerden biri ol. 🚀';
  let txt = '🏆 <b>Haftalık Liderler</b>\n\n';
  rows.forEach((r, i) => {
    const name  = r.username ? '@' + esc(r.username) : esc(r.first_name || 'kullanıcı'); // HTML escape
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    txt += `${medal} ${name} — <b>${r.invite_count || 0}</b> davet\n`;
  });
  return txt;
}
function fmtRewards() {
  return `🎁 <b>Davet Ödülleri</b>\n\n` +
    `3 Davet → <b>7 Gün Premium</b>\n` +
    `10 Davet → <b>30 Gün Premium</b>\n` +
    `25 Davet → <b>Elite Adayı</b>\n\n` +
    `⏳ Geçerli davetler 48 saat sonra aktifleşir.`;
}

// kullanıcı kaydını getir/oluştur + davet linkini garanti et
async function ensureUser(from, chatId) {
  const tgId = String(from.id);
  let rows = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=*`);
  let user = rows && rows[0];
  if (!user) {
    user = (await sbInsert('tg_users', { tg_id: tgId, username: from.username || null, first_name: from.first_name || null }))[0];
  }
  if (!user.invite_link) {
    const name = `ref_${tgId}`;
    const link = await tg('createChatInviteLink', { chat_id: CHANNEL_ID, name, creates_join_request: false });
    if (link.ok && link.result && link.result.invite_link) {
      const upd = await sbPatch('tg_users', `tg_id=eq.${tgId}`, { invite_link: link.result.invite_link, invite_link_name: name });
      user = (upd && upd[0]) || user; user.invite_link = link.result.invite_link;
    } else {
      if (chatId) await sendMsg(chatId, '👋 Hoş geldin! Davet linkin oluşturulamadı — bot kanalda <b>"Davet linki oluştur"</b> yetkisine sahip değil. Yönetici düzeltince tekrar /start yaz.');
      return null;
    }
  }
  return user;
}

// ── /start ──
async function onStart(msg) {
  let user = await ensureUser(msg.from, msg.chat.id);
  if (!user) return;
  const tgId = String(msg.from.id);
  await validateAndReward(tgId, msg.chat.id);
  const fresh = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=invite_count,valid_invite_count,invite_link`);
  user = (fresh && fresh[0]) || user;
  const leaders = await sbSelect('tg_users', `select=username,first_name,invite_count,valid_invite_count&order=valid_invite_count.desc,invite_count.desc&limit=1`);
  await sendMsg(msg.chat.id, fmtStart(user, leaders && leaders[0]), { reply_markup: mainKb(user.invite_link) });
}

// ── /davet ──
async function onDavet(msg) {
  const tgId = String(msg.from.id);
  await validateAndReward(tgId, msg.chat.id);
  const rows = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=invite_count,valid_invite_count,invite_link`);
  const user = rows && rows[0];
  if (!user) { await sendMsg(msg.chat.id, 'Önce /start yazarak davet linki al.'); return; }
  await sendMsg(msg.chat.id, fmtDavet(user), { reply_markup: mainKb(user.invite_link) });
}

// ── /liderlik ──
async function onLiderlik(msg) {
  await validateAndReward(String(msg.from.id), msg.chat.id);
  const rows = await sbSelect('tg_users',
    `select=username,first_name,invite_count,valid_invite_count&order=valid_invite_count.desc,invite_count.desc&limit=10`);
  await sendMsg(msg.chat.id, fmtLiderlik(rows));
}

// ── inline buton tıklamaları (callback_query) ──
async function onCallback(cq) {
  const data   = cq.data || '';
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  const from   = cq.from;
  try { await tg('answerCallbackQuery', { callback_query_id: cq.id }); } catch (e) {}
  if (!chatId || !from) return;

  if (data === 'davet') {
    await validateAndReward(String(from.id), chatId);
    const rows = await sbSelect('tg_users', `tg_id=eq.${String(from.id)}&select=invite_count,valid_invite_count,invite_link`);
    const user = rows && rows[0];
    if (!user) { await sendMsg(chatId, 'Önce /start yazarak davet linki al.'); return; }
    await sendMsg(chatId, fmtDavet(user), { reply_markup: mainKb(user.invite_link) });
  } else if (data === 'liderlik') {
    const rows = await sbSelect('tg_users', `select=username,first_name,invite_count,valid_invite_count&order=valid_invite_count.desc,invite_count.desc&limit=10`);
    await sendMsg(chatId, fmtLiderlik(rows));
  } else if (data === 'odul') {
    await sendMsg(chatId, fmtRewards());
  }
}

// ── chat_member: kanala giriş/çıkış → referral kaydı ──
async function onChatMember(cm) {
  try {
    if (!cm.invite_link || !cm.invite_link.invite_link) return; // linkle girilmemişse referrer bilinemez
    const usedLink = cm.invite_link.invite_link;
    const oldS = cm.old_chat_member && cm.old_chat_member.status;
    const newS = cm.new_chat_member && cm.new_chat_member.status;
    const member = cm.new_chat_member && cm.new_chat_member.user;
    if (!member) return;
    const newMemberId = String(member.id);

    // referrer'ı linkten bul
    const owners = await sbSelect('tg_users', `invite_link=eq.${encodeURIComponent(usedLink)}&select=tg_id`);
    const referrer = owners && owners[0];
    if (!referrer) return;
    const referrerId = referrer.tg_id;
    if (referrerId === newMemberId) return; // kendini davet edemez

    const joined = ['member', 'administrator', 'creator'].includes(newS);
    const left   = ['left', 'kicked'].includes(newS);

    if (joined && !['member', 'administrator', 'creator'].includes(oldS)) {
      // YENİ GİRİŞ — dedup: aynı çift varsa tekrar sayma
      const exist = await sbSelect('tg_referrals',
        `referrer_tg_id=eq.${referrerId}&new_member_tg_id=eq.${newMemberId}&select=id,still_member`);
      const validAfter = new Date(Date.now() + VALID_HOURS * 3600 * 1000).toISOString();

      if (exist && exist[0]) {
        // daha önce girip çıkmışsa tekrar üye yap (sayacı bir daha ARTIRMA)
        if (!exist[0].still_member) {
          await sbPatch('tg_referrals', `id=eq.${exist[0].id}`, { still_member: true, left_at: null });
        }
        return;
      }

      await sbInsert('tg_referrals', {
        referrer_tg_id: referrerId, new_member_tg_id: newMemberId,
        new_member_username: member.username || null, invite_link: usedLink,
        still_member: true, is_valid: false, valid_after: validAfter,
      }, 'return=minimal');

      // referrer invite_count +1 (RPC yerine oku-artır-yaz; tek update)
      const cur = await sbSelect('tg_users', `tg_id=eq.${referrerId}&select=invite_count`);
      const newCount = ((cur && cur[0] && cur[0].invite_count) || 0) + 1;
      await sbPatch('tg_users', `tg_id=eq.${referrerId}`, { invite_count: newCount });
      console.log('[TG_WEBHOOK] referral +1', referrerId, '←', newMemberId);

    } else if (left) {
      // AYRILDI — still_member=false (sayaç düşürme Phase 4/5 doğrulamasında ele alınır)
      await sbPatch('tg_referrals',
        `referrer_tg_id=eq.${referrerId}&new_member_tg_id=eq.${newMemberId}`,
        { still_member: false, left_at: new Date().toISOString() });
      console.log('[TG_WEBHOOK] member left', referrerId, '←', newMemberId);
    }
  } catch (e) { console.warn('[TG_WEBHOOK] onChatMember err:', e.message); }
}

// ── ANA HANDLER ──
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  // 1) secret token doğrula (ADMIN_KEY ile KARIŞTIRMA)
  if (!SECRET || req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!TG_TOKEN || !SB_URL || !SB_KEY || !CHANNEL_ID) {
    console.error('[TG_WEBHOOK] env eksik'); return res.status(200).json({ ok: true }); // Telegram retry'ı durdur
  }

  const update = req.body || {};
  try {
    if (update.message && update.message.text) {
      const text = update.message.text.trim();
      if (/^\/start\b/.test(text))         await onStart(update.message);
      else if (/^\/davet\b/.test(text))    await onDavet(update.message);
      else if (/^\/liderlik\b/.test(text)) await onLiderlik(update.message);
    } else if (update.chat_member) {
      await onChatMember(update.chat_member);
    } else if (update.callback_query) {
      await onCallback(update.callback_query);
    }
  } catch (e) {
    console.warn('[TG_WEBHOOK] handler err:', e.message);
  }
  // Telegram'a daima 200 dön (retry fırtınası olmasın)
  return res.status(200).json({ ok: true });
}
