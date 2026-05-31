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
const sendMsg = (chatId, text) => tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });

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

// ── /start: kullanıcıyı kaydet + kişisel davet linki üret ──
async function onStart(msg) {
  const u = msg.from; const tgId = String(u.id);
  let rows = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=*`);
  let user = rows && rows[0];

  if (!user) {
    user = (await sbInsert('tg_users', {
      tg_id: tgId, username: u.username || null, first_name: u.first_name || null,
    }))[0];
  }

  // davet linki yoksa üret
  if (!user.invite_link) {
    const name = `ref_${tgId}`;
    const link = await tg('createChatInviteLink', { chat_id: CHANNEL_ID, name, creates_join_request: false });
    if (link.ok && link.result && link.result.invite_link) {
      const upd = await sbPatch('tg_users', `tg_id=eq.${tgId}`, {
        invite_link: link.result.invite_link, invite_link_name: name,
      });
      user = (upd && upd[0]) || user; user.invite_link = link.result.invite_link;
    } else {
      await sendMsg(msg.chat.id,
        '👋 Hoş geldin! Davet linkin oluşturulamadı — bot kanalda <b>"Davet linki oluştur"</b> yetkisine sahip değil. Yönetici düzeltince tekrar /start yaz.');
      return;
    }
  }

  await sendMsg(msg.chat.id,
    `Merhaba 👋\n<b>VD SecuriAnalyst</b> davet sistemine hoş geldin.\n\n` +
    `Kişisel davet linkin:\n${user.invite_link}\n\n` +
    `Bu linkle kanala katılan kullanıcılar <b>senin davetin</b> olarak sayılır.\n\n` +
    `Komutlar:\n/davet — davet sayını gör\n/liderlik — ilk 10 davetçi`);
}

// ── /davet: davet bilgisi (ödül YOK, sadece bilgi) ──
async function onDavet(msg) {
  const tgId = String(msg.from.id);
  const rows = await sbSelect('tg_users', `tg_id=eq.${tgId}&select=invite_count,valid_invite_count,invite_link`);
  const user = rows && rows[0];
  if (!user) { await sendMsg(msg.chat.id, 'Önce /start yazarak davet linki al.'); return; }

  // ödül eşikleri (Phase 5'te aktif olacak) — şimdilik sadece "kaç kişi kaldı" bilgisi
  const NEXT = [3, 10, 25];
  const cnt = user.invite_count || 0;
  const next = NEXT.find(n => n > cnt);
  const remain = next ? (next - cnt) : 0;

  await sendMsg(msg.chat.id,
    `📊 <b>Davet Durumun</b>\n\n` +
    `Toplam davet: <b>${cnt}</b>\n` +
    `Geçerli (48s+): <b>${user.valid_invite_count || 0}</b>\n` +
    (next ? `Bir sonraki kademeye: <b>${remain}</b> kişi kaldı.\n` : `Tüm kademeleri geçtin! 🎉\n`) +
    `\nLinkin:\n${user.invite_link || '(yok — /start yaz)'}`);
}

// ── /liderlik: basit top 10 ──
async function onLiderlik(msg) {
  const rows = await sbSelect('tg_users',
    `select=username,first_name,invite_count,valid_invite_count&order=valid_invite_count.desc,invite_count.desc&limit=10`);
  if (!rows || !rows.length) { await sendMsg(msg.chat.id, 'Henüz davet kaydı yok.'); return; }
  let txt = '🏆 <b>Davet Liderlik Tablosu</b>\n\n';
  rows.forEach((r, i) => {
    const name = r.username ? '@' + r.username : (r.first_name || 'kullanıcı');
    txt += `${i + 1}. ${name} — <b>${r.invite_count || 0}</b> davet\n`;
  });
  await sendMsg(msg.chat.id, txt);
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
    }
  } catch (e) {
    console.warn('[TG_WEBHOOK] handler err:', e.message);
  }
  // Telegram'a daima 200 dön (retry fırtınası olmasın)
  return res.status(200).json({ ok: true });
}
