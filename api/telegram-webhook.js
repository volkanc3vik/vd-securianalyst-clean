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

// ════════════ MESAJ FORMATLARI (merkezi — Phase 4) ════════════
const REWARD = { target: 3, label: '7 gün Premium' }; // ilk kademe (Phase 5'te aktifleşir)

// Paylaş butonu URL'i (URL-ENCODE'lu)
function shareUrl(inviteLink) {
  const txt = "VD SecuriAnalyst — ücretsiz AI kripto analizleri, market özeti ve örnek setup'lar 👇";
  return `https://t.me/share/url?url=${encodeURIComponent(inviteLink || '')}&text=${encodeURIComponent(txt)}`;
}
// inline klavye: Paylaş = URL buton (callback gerekmez), diğerleri callback
function mainKb(inviteLink) {
  const rows = [];
  if (inviteLink) rows.push([{ text: '📢 Davet Linkimi Paylaş', url: shareUrl(inviteLink) }]);
  rows.push([{ text: '📊 Davet Durumum', callback_data: 'davet' }, { text: '🏆 Liderlik', callback_data: 'liderlik' }]);
  rows.push([{ text: '🚀 Premium Bilgi', callback_data: 'premium' }]);
  return { inline_keyboard: rows };
}

function fmtStart(user) {
  return `Merhaba 👋\n<b>VD SecuriAnalyst</b> davet sistemine hoş geldin.\n\n` +
    `Kişisel davet linkin:\n${user.invite_link}\n\n` +
    `Bu linki paylaş. Kanala katılan kullanıcılar <b>senin davetin</b> olarak sayılır.\n\n` +
    `🎁 Ödül sistemi yakında aktif olacak.\n\n` +
    `Komutlar:\n/davet — Davet durumun\n/liderlik — Liderlik tablosu`;
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
  let txt = '🏆 <b>Haftalık Davet Liderleri</b>\n\n';
  rows.forEach((r, i) => {
    const name  = r.username ? '@' + esc(r.username) : esc(r.first_name || 'kullanıcı'); // HTML escape
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    txt += `${medal} ${name} — <b>${r.invite_count || 0}</b> davet\n`;
  });
  return txt;
}
function fmtPremium() {
  return `🚀 <b>Premium Bilgi</b>\n\n` +
    `Premium ödül sistemi yakında aktif olacak.\n\n` +
    `Davet ettiğin ve <b>48 saat kanalda kalan</b> kullanıcılar "geçerli davet" sayılır.\n` +
    `Hedef: <b>${REWARD.target} geçerli davet → ${REWARD.label}</b>\n\n` +
    `Şimdiden davet biriktir — sistem açıldığında ödülün hazır olur. 💪`;
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
  const user = await ensureUser(msg.from, msg.chat.id);
  if (!user) return;
  await sendMsg(msg.chat.id, fmtStart(user), { reply_markup: mainKb(user.invite_link) });
}

// ── /davet ──
async function onDavet(msg) {
  const tgId = String(msg.from.id);
  const rows = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=invite_count,valid_invite_count,invite_link`);
  const user = rows && rows[0];
  if (!user) { await sendMsg(msg.chat.id, 'Önce /start yazarak davet linki al.'); return; }
  await sendMsg(msg.chat.id, fmtDavet(user), { reply_markup: mainKb(user.invite_link) });
}

// ── /liderlik ──
async function onLiderlik(msg) {
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
    const rows = await sbSelect('tg_users', `tg_id=eq.${String(from.id)}&select=invite_count,valid_invite_count,invite_link`);
    const user = rows && rows[0];
    if (!user) { await sendMsg(chatId, 'Önce /start yazarak davet linki al.'); return; }
    await sendMsg(chatId, fmtDavet(user), { reply_markup: mainKb(user.invite_link) });
  } else if (data === 'liderlik') {
    const rows = await sbSelect('tg_users', `select=username,first_name,invite_count,valid_invite_count&order=valid_invite_count.desc,invite_count.desc&limit=10`);
    await sendMsg(chatId, fmtLiderlik(rows));
  } else if (data === 'premium') {
    await sendMsg(chatId, fmtPremium()); // SADECE bilgi — kod üretmez
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
