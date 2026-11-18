const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const fs = require("fs");
const config = require("../config");
const db = require("../database/db");
const formatter = require("./formatter");
const { toCyrillic } = require("./transliterate");

class UserbotService {
  constructor() {
    this.client = null;
    this.sessionString = this.loadSession();
    this.isConnected = false;
    this.me = null;
  }

  loadSession() {
    if (fs.existsSync(config.SESSION_FILE)) {
      return fs.readFileSync(config.SESSION_FILE, "utf8").trim();
    }
    return config.SESSION_STRING || "";
  }

  saveSession(session) {
    if (!fs.existsSync(config.DATA_DIR)) {
      fs.mkdirSync(config.DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(config.SESSION_FILE, session, "utf8");
  }

  async init() {
    if (!config.API_ID || !config.API_HASH) {
      console.warn(
        "⚠️ API_ID yoki API_HASH topilmadi. Userbot faqat .env sozlangach ishlaydi.",
      );
      return false;
    }

    const stringSession = new StringSession(this.sessionString);

    this.client = new TelegramClient(
      stringSession,
      config.API_ID,
      config.API_HASH,
      {
        connectionRetries: 5,
      },
    );

    try {
      await this.client.start({
        phoneNumber: async () =>
          config.PHONE_NUMBER ||
          (await input.text(
            "📱 Telegram telefon raqamingizni kiriting (+998...): ",
          )),
        password: async () =>
          await input.text("🔑 2FA Parolingiz (agar bo'lsa): "),
        phoneCode: async () =>
          await input.text(
            "📩 Telegram apparatiga kelgan tasdiqlash kodini kiriting: ",
          ),
        onError: (err) => console.error("Userbot Login Error:", err),
      });

      const savedSession = this.client.session.save();
      this.saveSession(savedSession);
      this.isConnected = true;
      this.me = await this.client.getMe();
      console.log("✅ Telegram Userbot muvaffaqiyatli ulandi!");

      // Send startup message to Saved Messages so user immediately sees it in Telegram
      try {
        await this.client.sendMessage("me", {
          message:
            `🚚 **Telegram Cargo Bot muvaffaqiyatli ishga tushdi!**\n\n` +
            `Siz botni to'g'ridan-to'g'ri shu chatdan (Избранное) boshqarishingiz mumkin:\n\n` +
            `▶️ \`.run\` — Guruhlarga tarqatishni boshlash\n` +
            `⏹ \`.stop\` — Tarqatishni to'xtatish\n` +
            `📋 \`.list\` — E'lonlar ro'yxatini ko'rish\n` +
            `📊 \`.stats\` — Statistika (bajarilgan sikllar)\n` +
            `👥 \`.groups\` — Ulangan logistika guruhlari\n\n` +
            `➕ **Yangi e'lon qo'shish uchun quyidagi matnni nusxalab, o'zgartirib yuboring:**\n` +
            `\`.add Shymkent | Sirdaryo | 198 km | shkura | 22t/86m3 | 2 tenta | Gruz gotov | Avans bor | Nal | +998940046475 (@username)\``,
        });
        console.log(
          '📨 "Saqlangan xabarlar" (Избранное) chatiga boshqaruv xabari yuborildi!',
        );
      } catch (notifyErr) {
        console.warn(
          "⚠️ Saved Messages ga xabar yuborishda ogohlantirish:",
          notifyErr.message,
        );
      }

      // Register Saved Messages Command Handlers (Works 100% without VPN/Bot API!)
      this.registerSavedMessagesCommands();

      return true;
    } catch (err) {
      console.error("❌ Userbotga ulanishda xatolik:", err);
      this.isConnected = false;
      return false;
    }
  }

  registerSavedMessagesCommands() {
    if (!this.client) return;

    const scheduler = require("./scheduler");

    this.client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        if (!message || !message.text) return;

        const myIdStr = this.me?.id?.toString();
        const chatIdStr = message.chatId?.toString();
        const peerUserIdStr = message.peerId?.userId?.toString();

        // Check if message is in Saved Messages (chat with oneself) or sent by me
        const isSavedChat =
          myIdStr && (chatIdStr === myIdStr || peerUserIdStr === myIdStr);
        const isFromMe = message.out === true;

        if (!isSavedChat && !isFromMe) return;

        const rawText = message.text.trim();
        const lowerText = rawText.toLowerCase();

        console.log(`[Userbot] Buyruq keldi: "${rawText}"`);

        if (
          lowerText === ".help" ||
          lowerText === "/help" ||
          lowerText === "help" ||
          lowerText === ".start" ||
          lowerText === "/start" ||
          lowerText === "start" ||
          lowerText === "menyu"
        ) {
          const helpText =
            `🚚 **CARGO USERBOT BOSHQARUV PANELI**\n\n` +
            `🔹 \`.run\` — Guruhlarga e'lonlarni tarqatishni boshlash\n` +
            `🔹 \`.stop\` — Tarqatishni to'xtatish\n` +
            `🔹 \`.list\` — Faol e'lonlar ro'yxati\n` +
            `🔹 \`.batches\` — To'plamlar va ularga biriktirilgan guruhlar\n` +
            `🔹 \`.groups\` — Profilingizdagi guruhlar ro'yxati\n` +
            `🔹 \`.stats\` — Statistika va sikllar soni\n\n` +
            `🔹 **To'plamga guruhlarni biriktirish:**\n` +
            `• Barchasini: \`.setgroups <batch_id> all\`\n` +
            `• Tanlanganlarini: \`.setgroups <batch_id> 1,2,5\`\n` +
            `• Tozalash: \`.setgroups <batch_id> clear\`\n\n` +
            `🔹 **Yangi e'lon qo'shish formati:**\n` +
            `\`.add Shymkent | Sirdaryo | 198 km | shkura | 22t/86m3 | 2 tenta | Gruz gotov | Avans bor | Nal | @username\`\n\n` +
            `🔹 **E'lonni tahrirlash:**\n` +
            `• Bitta maydonni: \`.edit <cargo_id> 10 @yangi_username\`\n` +
            `  *(1-Qayerdan, 2-Qayerga, 3-Masofa, 4-Yuk, 5-Hajm, 6-Transport, 7-Holat, 8-Avans, 9-To'lov, 10-Kontakt)*\n` +
            `• To'liq 10 ta maydonni: \`.edit <cargo_id> Shymkent | Sirdaryo | ... | @username\``;
          await this.client.sendMessage("me", { message: helpText });
        } else if (
          lowerText === ".run" ||
          lowerText === "/run" ||
          lowerText === "run" ||
          lowerText === "boshlash"
        ) {
          const activeCount = db.getAllCargoes("faol").length;
          if (activeCount === 0) {
            await this.client.sendMessage("me", {
              message: `⚠️ Hozirda birorta ham FAOL e'lon yo'q. Avval \`.add ...\` orqali e'lon qo'shing.`,
            });
          } else {
            scheduler.start();
            await this.client.sendMessage("me", {
              message: `🚀 Tarqatish jarayoni boshlandi! Har bir to'liq sikl belgilangan barcha guruhlarga yuborilgach 1 sikl hisoblanadi (Max ${config.MAX_SENT_COUNT} sikl).`,
            });
          }
        } else if (
          lowerText === ".stop" ||
          lowerText === "/stop" ||
          lowerText === "stop" ||
          lowerText === "toxtatish"
        ) {
          scheduler.stop();
          await this.client.sendMessage("me", {
            message: `⏹ Tarqatish dvigateli to'xtatildi.`,
          });
        } else if (
          lowerText === ".batches" ||
          lowerText === "/batches" ||
          lowerText === "batches" ||
          lowerText === "toplamlar"
        ) {
          const batches = db.getAllBatches();
          if (batches.length === 0) {
            await this.client.sendMessage("me", {
              message: `📦 Hozircha to'plamlar yaratilmagan.`,
            });
          } else {
            let bText = `📦 **E'LONLAR TO'PLAMLARI RO'YXATI:**\n\n`;
            batches.forEach((b, i) => {
              const grpCount = (b.target_group_ids || []).length;
              bText += `━━━━━━━━━━━━━━━━━━━━\n`;
              bText += `📦 **${i + 1}. ${b.title}**\n`;
              bText += `🆔 \`${b.id}\`\n`;
              bText += `📌 Holati: ${b.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
              bText += `🔄 Sikllar: ${b.completed_cycles || 0}/${config.MAX_SENT_COUNT} ta\n`;
              bText += `👥 Tanlangan guruhlar: **${grpCount}/${config.MAX_BATCH_GROUPS}** ta\n`;
              bText += `📋 E'lonlar soni: ${(b.cargo_ids || []).length} ta\n`;
            });
            bText += `\n💡 Guruhlarni biriktirish uchun: \`.setgroups <batch_id> all\` yoki \`.setgroups <batch_id> 1,2,3\``;
            await this.client.sendMessage("me", { message: bText });
          }
        } else if (
          lowerText.startsWith(".setgroups") ||
          lowerText.startsWith("/setgroups") ||
          lowerText.startsWith("setgroups")
        ) {
          const prefixMatch = rawText.match(/^\.?\/?setgroups\s*/i);
          const prefixLen = prefixMatch ? prefixMatch[0].length : 10;
          const rawArg = rawText.substring(prefixLen).trim();

          let batchId = null;
          let actionOrIndices = null;

          const parts = rawArg ? rawArg.split(/\s+/) : [];
          if (parts[0] && parts[0].startsWith("batch_")) {
            batchId = parts[0];
            actionOrIndices = parts.slice(1).join(" ").trim();
          } else {
            const activeBatches = db.getAllBatches("faol");
            const targetBatch = activeBatches[0] || db.getAllBatches()[0];
            if (targetBatch) {
              batchId = targetBatch.id;
              actionOrIndices = rawArg;
            }
          }

          const batch = batchId ? db.getBatchById(batchId) : null;
          if (!batch) {
            await this.client.sendMessage("me", {
              message: `⚠️ Faol to'plam topilmadi. Avval \`.batches\` orqali to'plamlarni tekshiring.`,
            });
          } else {
            let groups = db.getTargetGroups();
            if ((!groups || groups.length === 0) && this.isConnected && this.client) {
              try {
                groups = await this.getJoinedGroups();
                if (groups && groups.length > 0) db.setTargetGroups(groups);
              } catch (e) {}
            }

            if (!actionOrIndices || actionOrIndices.toLowerCase() === "all" || actionOrIndices.toLowerCase() === "hammasi") {
              db.selectAllGroupsForBatch(batchId, groups.map((g) => g.id));
              await this.client.sendMessage("me", {
                message: `✅ "${batch.title}" to'plamiga dastlabki ${config.MAX_BATCH_GROUPS} ta tanlangan guruh biriktirildi!`,
              });
            } else if (actionOrIndices.toLowerCase() === "clear" || actionOrIndices.toLowerCase() === "tozala") {
              db.clearBatchTargetGroups(batchId);
              await this.client.sendMessage("me", {
                message: `◻️ "${batch.title}" to'plamidan barcha guruhlar olib tashlandi (Tozalandi).`,
              });
            } else {
              // 1,2,5 formatida tartib raqamlar
              const rawIndices = actionOrIndices.split(/[,+\s]+/).map((n) => parseInt(n.trim(), 10) - 1).filter((n) => !isNaN(n) && n >= 0 && n < groups.length);
              const selectedGroupIds = rawIndices.slice(0, config.MAX_BATCH_GROUPS).map((idx) => groups[idx].id);
              db.setBatchTargetGroups(batchId, selectedGroupIds);
              await this.client.sendMessage("me", {
                message: `✅ "${batch.title}" to'plamiga ${selectedGroupIds.length} ta tanlangan guruh biriktirildi (Maksimal ${config.MAX_BATCH_GROUPS} ta)!`,
              });
            }
          }
        } else if (
          lowerText === ".groups" ||
          lowerText === "/groups" ||
          lowerText === "groups" ||
          lowerText === "guruhlar" ||
          lowerText === ".groups refresh" ||
          lowerText === ".refresh"
        ) {
          try {
            const groups = await this.getJoinedGroups();
            if (groups && groups.length > 0) {
              db.setTargetGroups(
                groups.map((g) => ({
                  id: g.id,
                  title: g.title,
                  username: g.username || null,
                })),
              );
            }
            let textRes = `👥 **LOGISTIKA GURUHLARINGIZ RO'YXATI (${groups.length} ta):**\n\n`;
            groups.slice(0, 50).forEach((g, i) => {
              textRes += `${i + 1}. ${g.title}\n`;
            });
            if (groups.length > 50) {
              textRes += `\n...va yana ${groups.length - 50} ta guruh.`;
            }
            await this.client.sendMessage("me", { message: textRes });
          } catch (e) {
            await this.client.sendMessage("me", {
              message: `❌ Guruhlarni olishda xatolik: ${e.message}`,
            });
          }
        } else if (
          lowerText === ".stats" ||
          lowerText === "/stats" ||
          lowerText === "stats" ||
          lowerText === "statistika"
        ) {
          const allBatches = db.getAllBatches();
          let statsText =
            `📊 **BOT STATISTIKASI (E'LONLAR TO'PLAMLARI BO'YICHA)**\n\n` +
            `⚡️ Dvigatel holati: ${scheduler.isRunning ? "🟢 Ishlamoqda" : "🔴 To'xtatilgan"}\n` +
            `📦 Jami to'plamlar: ${allBatches.length} ta\n\n`;

          if (allBatches.length === 0) {
            statsText += `_Hozircha to'plamlar yaratilmagan._`;
          } else {
            allBatches.forEach((b, idx) => {
              const groupStats = b.group_stats || {};
              const groupIds = Object.keys(groupStats);
              statsText += `━━━━━━━━━━━━━━━━━━━━\n`;
              statsText += `📦 **${idx + 1}. To'plam: "${b.title}"**\n`;
              statsText += `📌 Holati: ${b.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
              statsText += `🔄 Sikllar: ${b.completed_cycles || 0}/${config.MAX_SENT_COUNT} ta\n`;
              statsText += `👥 Tanlangan guruhlar: ${(b.target_group_ids || []).length}/${config.MAX_BATCH_GROUPS} ta\n`;
              statsText += `📊 Yuborilgan guruhlar: ${groupIds.length} ta\n`;

              if (groupIds.length > 0) {
                statsText += `📋 Qaysi guruhga necha marta yuborilgani:\n`;
                groupIds.slice(0, 30).forEach((gId, gIdx) => {
                  const item = groupStats[gId];
                  let linkPart = "";
                  if (item.last_message_link) {
                    linkPart = ` | 👉 ${item.last_message_link}`;
                  }
                  statsText += `  ${gIdx + 1}) **${item.title}** — **${item.count}/${config.MAX_SENT_COUNT} marta**${linkPart}\n`;
                });
                if (groupIds.length > 30) {
                  statsText += `  ...va yana ${groupIds.length - 30} ta guruh\n`;
                }
              }
            });
          }
          await this.client.sendMessage("me", { message: statsText });
        } else if (
          lowerText === ".list" ||
          lowerText === "/list" ||
          lowerText === "list" ||
          lowerText === "elonlar"
        ) {
          const faol = db.getAllCargoes("faol");
          if (faol.length === 0) {
            await this.client.sendMessage("me", {
              message: `📋 Hozircha faol e'lonlar yo'q. Yangi e'lon qo'shish uchun \`.add ...\` dan foydalaning.`,
            });
          } else {
            for (const c of faol) {
              const preview = formatter.formatSingleCargo(c, 1);
              await this.client.sendMessage("me", {
                message: `🆔 \`${c.id}\`\n🔄 Bajarilgan Sikllar: **${c.sent_cycles || 0}/${config.MAX_SENT_COUNT}**\n\n${preview}`,
              });
            }
          }
        } else if (
          lowerText.startsWith(".add ") ||
          lowerText.startsWith("/add ") ||
          lowerText.startsWith("add ")
        ) {
          const prefixLen =
            lowerText.startsWith(".add ") || lowerText.startsWith("/add ")
              ? 5
              : 4;
          const rawParts = rawText
              .substring(prefixLen)
              .split("|")
              .map((p) => p.trim());
          if (rawParts.length < 10) {
            await this.client.sendMessage("me", {
              message:
                `❌ Noto'g'ri format. E'lon ma'lumotlarini to'liq 10 ta maydon qilib, | (tayoqcha) belgisi bilan ajrating.\n\n` +
                `📌 **Namuna (nusxalab o'zgartiring):**\n` +
                `\`.add Shymkent | Sirdaryo | 198 km | shkura, navalom | 22t / 86m3 | 2 tenta (zad) | Gruz gotov | Avans bor | Nal | @username\``,
            });
          } else {
            let contactVal = rawParts[9].trim();
            if (
              contactVal &&
              !contactVal.startsWith("@") &&
              !contactVal.startsWith("+") &&
              !/^\d/.test(contactVal) &&
              !contactVal.includes("t.me")
            ) {
              contactVal = "@" + contactVal;
            }

            const cargoData = {
              from: toCyrillic(rawParts[0]),
              to: toCyrillic(rawParts[1]),
              distance: toCyrillic(rawParts[2]),
              cargo: toCyrillic(rawParts[3]),
              weight_volume: toCyrillic(rawParts[4]),
              transport: toCyrillic(rawParts[5]),
              cargo_status: toCyrillic(rawParts[6]),
              advance: toCyrillic(rawParts[7]),
              payment: toCyrillic(rawParts[8]),
              contact: contactVal,
              status: "faol",
            };
            const created = db.createCargo(cargoData);
            const preview = formatter.formatSingleCargo(created, 1);
            await this.client.sendMessage("me", {
              message: `🎉 E'lon yaratildi va FAOL holatda saqlandi!\nID: \`${created.id}\`\n\n${preview}`,
            });
          }
        } else if (
          lowerText.startsWith(".edit ") ||
          lowerText.startsWith("/edit ") ||
          lowerText.startsWith("edit ")
        ) {
          const prefixLen =
            lowerText.startsWith(".edit ") || lowerText.startsWith("/edit ")
              ? 6
              : 5;
          const editPayload = rawText.substring(prefixLen).trim();
          const firstSpace = editPayload.indexOf(" ");

          if (firstSpace === -1) {
            await this.client.sendMessage("me", {
              message:
                `❌ Noto'g'ri format.\n\n` +
                `📌 **Bitta maydonni tahrirlash:**\n` +
                `\`.edit <cargo_id> 10 @yangi_username\`\n` +
                `Maydon raqamlari: 1-Qayerdan, 2-Qayerga, 3-Masofa, 4-Yuk, 5-Hajm, 6-Transport, 7-Holat, 8-Avans, 9-To'lov, 10-Kontakt\n\n` +
                `📌 **To'liq e'lonni tahrirlash:**\n` +
                `\`.edit <cargo_id> Qayerdan | Qayerga | Masofa | Yuk | Hajm | Transport | Holat | Avans | To'lov | Kontakt\``,
            });
          } else {
            const cargoId = editPayload.substring(0, firstSpace).trim();
            const rest = editPayload.substring(firstSpace + 1).trim();
            const cargo = db.getCargoById(cargoId);

            if (!cargo) {
              await this.client.sendMessage("me", {
                message: `⚠️ ID: \`${cargoId}\` bo'yicha e'lon topilmadi. E'lonlar ro'yxatini ko'rish uchun \`.list\` buyrug'idan foydalaning.`,
              });
            } else if (rest.includes("|")) {
              // To'liq 10 ta maydon
              const parts = rest.split("|").map((p) => p.trim());
              if (parts.length < 10) {
                await this.client.sendMessage("me", {
                  message: `❌ To'liq tahrirlash uchun barcha 10 ta maydonni | belgisi bilan ajratib yuboring.`,
                });
              } else {
                let contactVal = parts[9].trim();
                if (
                  contactVal &&
                  !contactVal.startsWith("@") &&
                  !contactVal.startsWith("+") &&
                  !/^\d/.test(contactVal) &&
                  !contactVal.includes("t.me")
                ) {
                  contactVal = "@" + contactVal;
                }
                const updated = db.updateCargo(cargoId, {
                  from: toCyrillic(parts[0]),
                  to: toCyrillic(parts[1]),
                  distance: toCyrillic(parts[2]),
                  cargo: toCyrillic(parts[3]),
                  weight_volume: toCyrillic(parts[4]),
                  transport: toCyrillic(parts[5]),
                  cargo_status: toCyrillic(parts[6]),
                  advance: toCyrillic(parts[7]),
                  payment: toCyrillic(parts[8]),
                  contact: contactVal,
                });
                const preview = formatter.formatSingleCargo(updated, 1);
                await this.client.sendMessage("me", {
                  message: `🎉 E'lon muvaffaqiyatli tahrirlandi!\nID: \`${cargoId}\`\n\n${preview}`,
                });
              }
            } else {
              // Bitta maydonni tahrirlash: masalan "10 @username" yoki "contact @username"
              const fieldSpace = rest.indexOf(" ");
              if (fieldSpace === -1) {
                await this.client.sendMessage("me", {
                  message: `❌ Yangi qiymatni ham kiriting: masalan \`.edit ${cargoId} 10 @username\``,
                });
              } else {
                const fieldKey = rest.substring(0, fieldSpace).trim().toLowerCase();
                let newVal = rest.substring(fieldSpace + 1).trim();

                const fieldMap = {
                  "1": "from",
                  from: "from",
                  qayerdan: "from",
                  "2": "to",
                  to: "to",
                  qayerga: "to",
                  "3": "distance",
                  distance: "distance",
                  masofa: "distance",
                  "4": "cargo",
                  cargo: "cargo",
                  yuk: "cargo",
                  "5": "weight_volume",
                  weight: "weight_volume",
                  hajm: "weight_volume",
                  "6": "transport",
                  transport: "transport",
                  mashina: "transport",
                  "7": "cargo_status",
                  status: "cargo_status",
                  holat: "cargo_status",
                  "8": "advance",
                  advance: "advance",
                  avans: "advance",
                  "9": "payment",
                  payment: "payment",
                  tolov: "payment",
                  "10": "contact",
                  contact: "contact",
                  kontakt: "contact",
                  tel: "contact",
                  username: "contact",
                };

                const targetField = fieldMap[fieldKey];
                if (!targetField) {
                  await this.client.sendMessage("me", {
                    message: `❌ Noto'g'ri maydon: "${fieldKey}". 1 dan 10 gacha raqam yoki maydon nomini kiriting (masalan 10 yoki contact).`,
                  });
                } else {
                  if (targetField === "contact") {
                    if (
                      newVal &&
                      !newVal.startsWith("@") &&
                      !newVal.startsWith("+") &&
                      !/^\d/.test(newVal) &&
                      !newVal.includes("t.me")
                    ) {
                      newVal = "@" + newVal;
                    }
                  } else {
                    newVal = toCyrillic(newVal);
                  }

                  const updated = db.updateCargo(cargoId, {
                    [targetField]: newVal,
                  });
                  const preview = formatter.formatSingleCargo(updated, 1);
                  await this.client.sendMessage("me", {
                    message: `✅ E'lon maydoni muvaffaqiyatli o'zgartirildi!\nID: \`${cargoId}\`\n\n${preview}`,
                  });
                }
              }
            }
          }
        }
      } catch (handleErr) {
        console.error("⚠️ Saved Messages handler error:", handleErr);
      }
    }, new NewMessage({}));
  }

  async getJoinedGroups() {
    if (!this.isConnected || !this.client) {
      throw new Error("Userbot hali ulanmagan.");
    }

    const dialogs = await this.client.getDialogs({});
    const groups = [];

    for (const dialog of dialogs) {
      // 1. Shaxsiy chatlar (direct user chats) aslo kiritilmaydi
      if (dialog.isUser) continue;

      const entity = dialog.entity;
      if (!entity) continue;

      // 2. Telegram kanallarini (broadcast channels) QAT'IY chiqarib tashlash!
      // Agar broadcast === true yoki className === 'Channel' va megagroup bo'lmasa - bu KANAL!
      if (entity.broadcast || (entity.className === "Channel" && !entity.megagroup)) {
        continue;
      }

      // 3. Faqat haqiqiy guruhlar (Chat) yoki superguruhlar (Channel megagroup === true)
      const isNormalChat = entity.className === "Chat";
      const isSuperGroup = entity.className === "Channel" && entity.megagroup === true;
      if (!isNormalChat && !isSuperGroup) {
        continue;
      }

      // 4. Foydalanuvchi guruhdan chiqqan yoki bloklangan bo'lsa
      if (entity.left || entity.kicked) {
        continue;
      }

      groups.push({
        id: dialog.id.toString(),
        title: dialog.title,
        username: entity.username || null,
      });
    }

    return groups;
  }

  async sendMessageToGroup(peerId, message) {
    if (!this.isConnected || !this.client) {
      throw new Error("Userbot ulanmagan.");
    }

    return await this.client.sendMessage(peerId, { message });
  }
}

module.exports = new UserbotService();
