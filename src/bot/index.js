const { Telegraf, Scenes, session, Markup } = require("telegraf");
const config = require("../config");
const db = require("../database/db");
const scheduler = require("../services/scheduler");
const formatter = require("../services/formatter");
const { toCyrillic } = require("../services/transliterate");
const userbot = require("../services/userbot");

if (!config.BOT_TOKEN) {
  console.warn(
    "⚠️ BOT_TOKEN topilmadi. Admin Bot .env fayli o'rnatilgach ishlaydi.",
  );
}

// Build Telegraf options for Proxy & Custom API Root
const fs = require("fs");
const path = require("path");
const telegrafOptions = {};

function appendDebugLog(msg) {
  try {
    fs.appendFileSync(
      path.join(__dirname, "..", "data", "bot_debug.log"),
      `[${new Date().toISOString()}] ${msg}\n`,
      "utf8",
    );
  } catch (e) {}
}

if (config.HTTPS_PROXY) {
  try {
    const { HttpsProxyAgent } = require("https-proxy-agent");
    telegrafOptions.telegram = telegrafOptions.telegram || {};
    telegrafOptions.telegram.agent = new HttpsProxyAgent(config.HTTPS_PROXY);
    console.log(`🌐 Proxy ishlatilmoqda: ${config.HTTPS_PROXY}`);
  } catch (err) {
    console.warn("⚠️ Proxy agentini yuklashda xatolik:", err.message);
  }
}

if (config.TELEGRAM_API_ROOT) {
  telegrafOptions.telegram = telegrafOptions.telegram || {};
  telegrafOptions.telegram.apiRoot = config.TELEGRAM_API_ROOT;
  console.log(`🌐 Custom Telegram API Root: ${config.TELEGRAM_API_ROOT}`);
}

const bot = new Telegraf(config.BOT_TOKEN, telegrafOptions);

// Global Telegraf error handler to prevent crashes
bot.catch((err, ctx) => {
  if (
    err.description &&
    (err.description.includes("query is too old") ||
      err.description.includes("message is not modified"))
  ) {
    return;
  }
  console.error(
    `⚠️ Bot error in ${ctx?.updateType || "update"}:`,
    err.message || err,
  );
});

// Safe answerCbQuery wrapper middleware
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery) {
    const origAnswerCbQuery = ctx.answerCbQuery.bind(ctx);
    ctx.answerCbQuery = async (...args) => {
      try {
        return await origAnswerCbQuery(...args);
      } catch (err) {
        // Silently ignore expired callback query errors
        return false;
      }
    };
  }
  return next();
});

// Owner Middleware check
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const cbData = ctx.callbackQuery?.data;
  if (cbData) {
    console.log(`[Bot Callback] User: ${userId}, Data: ${cbData}`);
  }

  if (config.OWNER_ID && ctx.from && ctx.from.id !== config.OWNER_ID) {
    console.warn(`[Bot Access Denied] User ID: ${ctx.from.id} != OWNER_ID: ${config.OWNER_ID}`);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(`⛔️ Kechirasiz, siz bot egasi emassiz (Sizning ID: ${ctx.from.id}).`, { show_alert: true }).catch(() => {});
    }
    return ctx.reply(
      `⛔️ Kechirasiz, ushbu botdan faqat uning egasi foydalanishi mumkin.\nSizning Telegram ID: <code>${ctx.from.id}</code>`,
      { parse_mode: "HTML" },
    );
  }
  return next();
});

// --- Main Menu Keyboard ---
function getMainMenuKeyboard() {
  return Markup.keyboard([
    [`▶️ Tarqatishni boshlash`, `⏹ Tarqatishni to'xtatish`],
    [`📝 Yangi e'lon yaratish`, `📋 E'lonlar ro'yxati`],
    [`📦 To'plamlar (Batches)`, `📊 Statistika`],
  ]).resize();
}

// --- Wizard Scene for Creating New Cargo Announcement ---
const createCargoWizard = new Scenes.WizardScene(
  "create_cargo_wizard",
  async (ctx) => {
    ctx.wizard.state.cargoData = {};
    await ctx.reply(
      `📍 1-qadam: Yuk yuklanadigan joyni kiriting (Lotin yoki Kirill alifbosida):\nMasalan: Shymkent, Qozog'iston 🇰🇿`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.from = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `📍 2-qadam: Yuk yetkazib beriladigan joyni kiriting:\nMasalan: Sirdaryo, O'zbekiston 🇺🇿`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.to = toCyrillic(ctx.message.text.trim());
    await ctx.reply(`📏 3-qadam: Masofani kiriting (Masalan: 198 km):`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.distance = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `📦 4-qadam: Yuk nomi va turini kiriting (Masalan: shkura, navalom):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.cargo = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `⚖️ 5-qadam: Og'irligi va hajmini kiriting (Masalan: 22t / 86m3):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.weight_volume = toCyrillic(
      ctx.message.text.trim(),
    );
    await ctx.reply(
      `🚛 6-qadam: Kerakli transport turini kiriting (Masalan: 2 tenta (zad)):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.transport = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `✅ 7-qadam: Yuk holatini kiriting (Masalan: Gruz gotov / Mozhno gruzit):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.cargo_status = toCyrillic(
      ctx.message.text.trim(),
    );
    await ctx.reply(
      `💰 8-qadam: Avans shartini kiriting (Masalan: Avans yest):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.advance = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `💵 9-qadam: To'lov shaklini kiriting (Masalan: Oplata nalichnymi):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state.cargoData.payment = toCyrillic(ctx.message.text.trim());
    await ctx.reply(
      `☎️ 10-qadam: Aloqa uchun kontaktni kiriting (Telefon raqam, Telegram @username yoki ikkalasi birga):\nMasalan: +998940046475 yoki @username yoki +998940046475 (@username):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    let rawContact = ctx.message.text.trim();
    if (
      rawContact &&
      !rawContact.startsWith("@") &&
      !rawContact.startsWith("+") &&
      !/^\d/.test(rawContact) &&
      !rawContact.includes("t.me")
    ) {
      rawContact = "@" + rawContact;
    }
    ctx.wizard.state.cargoData.contact = rawContact;

    const preview = formatter.formatSingleCargo(ctx.wizard.state.cargoData, 1);
    await ctx.reply(
      `✨ E'lon tayyor bo'ldi! (Lotincha kiritilgan ma'lumotlar avtomatik Kirill alifbosiga o'girildi):\n\n${preview}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `✅ Saqlash va Faollashtirish`,
            "save_cargo_active",
          ),
          Markup.button.callback(`📝 Qoralama saqlash`, "save_cargo_draft"),
        ],
        [Markup.button.callback(`❌ Bekor qilish`, "cancel_cargo")],
      ]),
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;
    const data = ctx.wizard.state.cargoData;

    if (action === "save_cargo_active") {
      data.status = "faol";
      const created = db.createCargo(data);
      await ctx.answerCbQuery(`E'lon faol holatda saqlandi!`);
      await ctx.reply(
        `🎉 E'lon muvaffaqiyatli saqlandi va FAOL holatga o'tkazildi!\nID: ${created.id}`,
        getMainMenuKeyboard(),
      );
    } else if (action === "save_cargo_draft") {
      data.status = "qoralama";
      const created = db.createCargo(data);
      await ctx.answerCbQuery(`E'lon qoralama saqlandi!`);
      await ctx.reply(
        `📝 E'lon QORALAMA holatida saqlandi!\nID: ${created.id}`,
        getMainMenuKeyboard(),
      );
    } else {
      await ctx.answerCbQuery(`Bekor qilindi`);
      await ctx.reply(
        `❌ E'lon yaratish bekor qilindi.`,
        getMainMenuKeyboard(),
      );
    }
    return ctx.scene.leave();
  },
);

// --- Wizard Scene for Editing a Single Cargo Field ---
const editSingleFieldWizard = new Scenes.WizardScene(
  "edit_single_field_wizard",
  async (ctx) => {
    ctx.wizard.state = Object.assign(ctx.wizard.state || {}, ctx.scene.state || {});
    const { cargoId, field, fieldName, currentValue } = ctx.wizard.state;
    await ctx.reply(
      `✏️ **Maydonni tahrirlash** (ID: \`${cargoId}\`)\n\n` +
      `📌 Maydon: **${fieldName}**\n` +
      `Hozirgi qiymat: \`${currentValue || "mavjud emas"}\`\n\n` +
      `Iltimos, yangi qiymatni kiriting (yoki bekor qilish uchun /cancel deb yozing):`,
      Markup.inlineKeyboard([
        [Markup.button.callback("❌ Bekor qilish", `cancel_field_edit_${cargoId}`)],
      ]),
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    ctx.wizard.state = Object.assign(ctx.wizard.state || {}, ctx.scene.state || {});
    const cargoId = ctx.wizard.state.cargoId;
    const field = ctx.wizard.state.field;

    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith("cancel_field_edit")) {
      await ctx.answerCbQuery("Bekor qilindi");
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }

    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, matn ko'rinishida kiriting (yoki /cancel deb yozing):");
      return;
    }

    let text = ctx.message.text.trim();
    if (text === "/cancel" || text.toLowerCase() === "bekor qilish") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }

    if (field === "contact") {
      if (
        text &&
        !text.startsWith("@") &&
        !text.startsWith("+") &&
        !/^\d/.test(text) &&
        !text.includes("t.me")
      ) {
        text = "@" + text;
      }
    } else {
      text = toCyrillic(text);
    }

    const updated = db.updateCargo(cargoId, { [field]: text });
    if (!updated) {
      await ctx.reply("⚠️ E'lon topilmadi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }

    const preview = formatter.formatSingleCargo(updated, 1);
    await ctx.reply(
      `✅ **Maydon muvaffaqiyatli yangilandi!**\n\n${preview}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("✏️ Yana tahrirlash", `edit_cargo_${cargoId}`),
          Markup.button.callback("📋 E'lonlar ro'yxati", "show_cargoes_list"),
        ],
      ]),
    );
    return ctx.scene.leave();
  },
);

// --- Wizard Scene for Editing Full Cargo Announcement ---
const editFullCargoWizard = new Scenes.WizardScene(
  "edit_full_cargo_wizard",
  async (ctx) => {
    ctx.wizard.state = Object.assign(ctx.wizard.state || {}, ctx.scene.state || {});
    const cargoId = ctx.wizard.state.cargoId;
    const cargo = db.getCargoById(cargoId);
    if (!cargo) {
      await ctx.reply("⚠️ E'lon topilmadi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    ctx.wizard.state.cargo = cargo;
    ctx.wizard.state.updatedData = {};

    await ctx.reply(
      `📝 **E'lonni to'liq tahrirlash (1/10)**\n\n` +
      `📍 1-qadam: Yuk yuklanadigan joyni kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.from}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring, bekor qilish uchun /cancel)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.from = txt === "." || !txt ? cargo.from : toCyrillic(txt);

    await ctx.reply(
      `📍 2-qadam: Yuk yetkazib beriladigan joyni kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.to}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.to = txt === "." || !txt ? cargo.to : toCyrillic(txt);

    await ctx.reply(
      `📏 3-qadam: Masofani kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.distance}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.distance = txt === "." || !txt ? cargo.distance : toCyrillic(txt);

    await ctx.reply(
      `📦 4-qadam: Yuk nomi va turini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.cargo}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.cargo = txt === "." || !txt ? cargo.cargo : toCyrillic(txt);

    await ctx.reply(
      `⚖️ 5-qadam: Og'irligi va hajmini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.weight_volume}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.weight_volume = txt === "." || !txt ? cargo.weight_volume : toCyrillic(txt);

    await ctx.reply(
      `🚛 6-qadam: Kerakli transport turini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.transport}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.transport = txt === "." || !txt ? cargo.transport : toCyrillic(txt);

    await ctx.reply(
      `✅ 7-qadam: Yuk holatini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.cargo_status}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.cargo_status = txt === "." || !txt ? cargo.cargo_status : toCyrillic(txt);

    await ctx.reply(
      `💰 8-qadam: Avans shartini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.advance}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.advance = txt === "." || !txt ? cargo.advance : toCyrillic(txt);

    await ctx.reply(
      `💵 9-qadam: To'lov shaklini kiriting:\n` +
      `Hozirgi qiymat: \`${cargo.payment}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    const txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    ctx.wizard.state.updatedData.payment = txt === "." || !txt ? cargo.payment : toCyrillic(txt);

    await ctx.reply(
      `☎️ 10-qadam: Aloqa uchun kontaktni kiriting (Telefon yoki Telegram @username):\n` +
      `Hozirgi qiymat: \`${cargo.contact}\`\n\n` +
      `*(O'zgarishsiz qoldirish uchun \`.\` nuqta yuboring)*`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/cancel") {
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
      return ctx.scene.leave();
    }
    let txt = ctx.message?.text?.trim() || "";
    const cargo = ctx.wizard.state.cargo;
    if (txt === "." || !txt) {
      ctx.wizard.state.updatedData.contact = cargo.contact;
    } else {
      if (
        !txt.startsWith("@") &&
        !txt.startsWith("+") &&
        !/^\d/.test(txt) &&
        !txt.includes("t.me")
      ) {
        txt = "@" + txt;
      }
      ctx.wizard.state.updatedData.contact = txt;
    }

    const merged = { ...cargo, ...ctx.wizard.state.updatedData };
    const preview = formatter.formatSingleCargo(merged, 1);

    await ctx.reply(
      `✨ **E'lon yangilandi! Yangi ko'rinishi:**\n\n${preview}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`✅ O'zgarishlarni saqlash`, "confirm_full_edit")],
        [Markup.button.callback(`❌ Bekor qilish`, "cancel_full_edit")],
      ]),
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;
    const cargoId = ctx.wizard.state.cargoId;

    if (action === "confirm_full_edit") {
      db.updateCargo(cargoId, ctx.wizard.state.updatedData);
      await ctx.answerCbQuery("O'zgarishlar saqlandi!");
      await ctx.reply(
        `🎉 E'lon muvaffaqiyatli to'liq yangilandi!\nID: \`${cargoId}\``,
        getMainMenuKeyboard(),
      );
    } else {
      await ctx.answerCbQuery("Bekor qilindi");
      await ctx.reply("❌ Tahrirlash bekor qilindi.", getMainMenuKeyboard());
    }
    return ctx.scene.leave();
  },
);

// --- Wizard Scene for Creating a New Batch ---
const createBatchWizard = new Scenes.WizardScene(
  "create_batch_wizard",
  async (ctx) => {
    await ctx.reply(
      `📦 Yangi to'plam nomini kiriting (Masalan: Shymkent yo'nalishi to'plami):`,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const title = toCyrillic(ctx.message.text.trim());
    let defaultGroupIds = [];
    try {
      if (userbot.isConnected && userbot.client) {
        const groups = await userbot.getJoinedGroups();
        defaultGroupIds = groups.map((g) => g.id);
      }
    } catch (e) {}
    if (defaultGroupIds.length === 0) {
      defaultGroupIds = db.getTargetGroups().map((g) => g.id);
    }
    const safeGroups = defaultGroupIds.slice(0, config.MAX_BATCH_GROUPS);
    const newBatch = db.createBatch(title, [], safeGroups);
    await ctx.reply(
      `✅ To'plam muvaffaqiyatli yaratildi!\nNomi: ${newBatch.title}\nID: ${newBatch.id}\nTanlangan guruhlar: ${newBatch.target_group_ids.length} ta (Faqat 15 tanlangan guruh)\n\nEndi "📦 To'plamlar" menyusidan unga e'lonlarni qo'shishingiz va tanlangan 15 ta guruhni sozlashingiz mumkin.`,
      getMainMenuKeyboard(),
    );
    return ctx.scene.leave();
  },
);

const stage = new Scenes.Stage([
  createCargoWizard,
  createBatchWizard,
  editSingleFieldWizard,
  editFullCargoWizard,
]);
bot.use(session());
bot.use(stage.middleware());

// /start Command
bot.start(async (ctx) => {
  await ctx.reply(
    `👋 Salom! Yuk e'lonlarini logistika guruhlariga avtomatik tarqatuvchi botga xush kelibsiz.\n\nMenyu tugmalaridan foydalanishingiz mumkin:`,
    getMainMenuKeyboard(),
  );
});

// Menu Action Listeners
bot.hears(`📝 Yangi e'lon yaratish`, (ctx) =>
  ctx.scene.enter("create_cargo_wizard"),
);

bot.hears(`📋 E'lonlar ro'yxati`, async (ctx) => {
  await showCargoList(ctx, "faol");
});

bot.hears(`📦 To'plamlar (Batches)`, async (ctx) => {
  await showBatchesList(ctx);
});

bot.hears(`▶️ Tarqatishni boshlash`, async (ctx) => {
  const activeCount = db.getAllCargoes("faol").length;
  if (activeCount === 0) {
    return ctx.reply(
      `⚠️ Hozirda birorta ham FAOL e'lon yo'q. Avval e'lon yarating yoki statusini faolga o'tkazing.`,
      getMainMenuKeyboard(),
    );
  }

  const started = scheduler.start();
  if (started) {
    await ctx.reply(
      `🚀 E'lonlarni tarqatish boshlandi! Har bir to'liq sikl belgilangan barcha guruhlarga yuborilgach 1 sikl deb hisoblanadi (Max ${config.MAX_SENT_COUNT} sikl).`,
      getMainMenuKeyboard(),
    );
  } else {
    await ctx.reply(
      `ℹ️ Tarqatish jarayoni allaqachon davom etmoqda.`,
      getMainMenuKeyboard(),
    );
  }
});

bot.hears(`⏹ Tarqatishni to'xtatish`, async (ctx) => {
  const stopped = scheduler.stop();
  if (stopped) {
    await ctx.reply(`⏹ Tarqatish jarayoni to'xtatildi.`, getMainMenuKeyboard());
  } else {
    await ctx.reply(
      `ℹ️ Tarqatish allaqachon to'xtatilgan.`,
      getMainMenuKeyboard(),
    );
  }
});

bot.hears(`📊 Statistika`, async (ctx) => {
  const allBatches = db.getAllBatches();
  const settings = db.getBotSettings();

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let text = `📊 <b>BOT STATISTIKASI (E'LONLAR TO'PLAMLARI BO'YICHA)</b>\n\n`;
  text += `⚡️ <b>Dvigatel holati:</b> ${settings.is_running ? "🟢 Ishlamoqda" : "🔴 To'xtatilgan"}\n`;
  text += `📦 <b>Jami to'plamlar:</b> ${allBatches.length} ta\n\n`;

  if (allBatches.length === 0) {
    text += `<i>Hozircha to'plamlar yaratilmagan.</i>`;
    return ctx.replyWithHTML(text, getMainMenuKeyboard());
  }

  for (let i = 0; i < allBatches.length; i++) {
    const b = allBatches[i];
    const groupStats = b.group_stats || {};
    const groupIds = Object.keys(groupStats);
    const completedCycles = b.completed_cycles || 0;

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 <b>${i + 1}. To'plam: "${esc(b.title)}"</b>\n`;
    text += `📌 <b>Holati:</b> ${b.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
    text += `🔄 <b>Bajarilgan sikllar:</b> ${completedCycles}/${config.MAX_SENT_COUNT} ta\n`;
    text += `👥 <b>Tanlangan guruhlar:</b> ${(b.target_group_ids || []).length}/${config.MAX_BATCH_GROUPS} ta\n`;
    text += `📊 <b>Yuborilgan guruhlar:</b> ${groupIds.length} ta\n\n`;

    if (groupIds.length === 0) {
      text += `<i>Bu to'plam hali guruhlarga yuborilmadi</i>\n`;
    } else {
      text += `📋 <b>Guruhlar bo'yicha statistika (necha marta yuborilgani):</b>\n`;
      groupIds.forEach((gId, gIdx) => {
        const item = groupStats[gId];
        let linkPart = "";
        if (item.last_message_link) {
          linkPart = ` | <a href="${item.last_message_link}">👉 Oxirgi xabar</a>`;
        }
        text += `  ${gIdx + 1}) <b>${esc(item.title || "Guruh")}</b> — <b>${item.count}/${config.MAX_SENT_COUNT} marta</b>${linkPart}\n`;
      });
    }
  }

  // Telegram 4096 belgi limitidan himoyalash
  if (text.length > 4000) {
    const chunks = text.match(/[\s\S]{1,3800}/g) || [text];
    for (const chunk of chunks) {
      await ctx.replyWithHTML(chunk, { disable_web_page_preview: true });
    }
  } else {
    await ctx.replyWithHTML(text, { disable_web_page_preview: true });
  }
});

// Helper function to display cargo listings
async function showCargoList(ctx, filterStatus = "faol") {
  const cargoes = db.getAllCargoes(
    filterStatus === "all" ? null : filterStatus,
  );

  const filterButtons = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `🟢 Faol (${db.getAllCargoes("faol").length})`,
        "filter_faol",
      ),
      Markup.button.callback(
        `🔴 Nofaol (${db.getAllCargoes("nofaol").length})`,
        "filter_nofaol",
      ),
      Markup.button.callback(
        `📝 Qoralama (${db.getAllCargoes("qoralama").length})`,
        "filter_qoralama",
      ),
    ],
  ]);

  if (cargoes.length === 0) {
    const text = `📋 Holat: **${filterStatus.toUpperCase()}** bo'yicha e'lonlar topilmadi.`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, filterButtons);
    } else {
      await ctx.reply(text, filterButtons);
    }
    return;
  }

  for (const cargo of cargoes) {
    const preview = formatter.formatSingleCargo(cargo, 1);
    const text = `🆔 **ID:** \`${cargo.id}\`\n📌 **Status:** ${cargo.status.toUpperCase()}\n🔄 **Bajarilgan Sikllar:** ${cargo.sent_cycles || 0}/${config.MAX_SENT_COUNT} sikl\n\n${preview}`;

    const controlButtons = Markup.inlineKeyboard([
      [
        Markup.button.callback(`✏️ Tahrirlash`, `edit_cargo_${cargo.id}`),
        Markup.button.callback(
          cargo.status === "faol" ? `🔴 Nofaol qilish` : `🟢 Faol qilish`,
          `toggle_status_${cargo.id}`,
        ),
      ],
      [
        Markup.button.callback(`📊 Stats`, `history_${cargo.id}`),
        Markup.button.callback(`🗑 O'chirish`, `delete_${cargo.id}`),
      ],
    ]);

    await ctx.replyWithMarkdown(text, controlButtons);
  }
}

// Helper function to display batches
async function showBatchesList(ctx) {
  const batches = db.getAllBatches();

  let text = `📦 **E'LONLAR TO'PLAMLARI (BATCHES)**\n\n`;
  text += `Har bir to'plam o'ziga biriktirilgan logistika guruhlariga navbat bilan tarqatiladi.\n\n`;

  if (batches.length === 0) {
    text += `Hozircha birorta ham to'plam yaratilmagan.`;
    return ctx.reply(
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `➕ Yangi to'plam yaratish`,
            "action_create_batch",
          ),
        ],
      ]),
    );
  }

  for (const b of batches) {
    const batchInfo = db.getBatchWithCargoes(b.id);
    const cargoCount =
      batchInfo && batchInfo.cargoes ? batchInfo.cargoes.length : 0;
    const completed = b.completed_cycles || 0;
    const statusText = b.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL";
    const groupCount = (b.target_group_ids || []).length;

    const batchText = `📦 **${b.title}**\n🆔 \`${b.id}\`\n📌 **Holati:** ${statusText}\n🔄 **Sikllar:** ${completed}/${config.MAX_SENT_COUNT} ta\n👥 **Tanlangan guruhlar:** **${groupCount}/${config.MAX_BATCH_GROUPS}** ta\n📋 Tarkibidagi e'lonlar: **${cargoCount}/${config.MAX_BATCH_CARGOES}** ta`;

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          b.status === "faol" ? `🔴 Nofaol qilish` : `🟢 Faol qilish`,
          `toggle_batch_status_${b.id}`,
        ),
        Markup.button.callback(`📊 Guruhlar statistikasi`, `batch_stats_${b.id}`),
      ],
      [
        Markup.button.callback(`➕ E'lon qo'shish`, `batch_add_${b.id}`),
        Markup.button.callback(`➖ E'lon olib tashlash`, `batch_rem_${b.id}`),
      ],
      [
        Markup.button.callback(
          `👥 Guruhlarni tanlash (${groupCount}/${config.MAX_BATCH_GROUPS})`,
          `bgroups_${b.id}_0`,
        ),
        Markup.button.callback(`👁 Ko'rish (Preview)`, `batch_view_${b.id}`),
      ],
      [
        Markup.button.callback(`🗑 To'plamni o'chirish`, `batch_del_${b.id}`),
      ],
    ]);

    await ctx.replyWithMarkdown(batchText, buttons);
  }

  await ctx.reply(
    `Yangi to'plam qo'shish uchun:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `➕ Yangi to'plam yaratish`,
          "action_create_batch",
        ),
      ],
    ]),
  );
}

// Helper function to render group selection interface for batch
async function renderBatchGroupsSelector(ctx, batchId, page = 0, forceRefresh = false) {
  const batch = db.getBatchById(batchId);
  if (!batch) {
    if (ctx.callbackQuery) await ctx.answerCbQuery("To'plam topilmadi.");
    return;
  }

  // 1. Mavjud logistika guruhlarini olish (agar forceRefresh bo'lsa yoki bo'sh bo'lsa Telegramdan qayta olinadi)
  let groups = db.getTargetGroups();
  if ((forceRefresh || !groups || groups.length === 0) && userbot.isConnected && userbot.client) {
    try {
      const fetched = await userbot.getJoinedGroups();
      if (fetched && fetched.length > 0) {
        db.setTargetGroups(
          fetched.map((g) => ({
            id: g.id,
            title: g.title,
            username: g.username || null,
          })),
        );
        groups = db.getTargetGroups();
      }
    } catch (e) {
      console.warn("Guruhlarni Telegramdan yangilashda ogohlantirish:", e.message);
    }
  }

  if (!groups || groups.length === 0) {
    const emptyMsg =
      `⚠️ Profilingizda hali logistika guruhlari topilmadi.\n` +
      `Userbot logistika guruhlariga a'zo bo'lgach, ular bu yerda paydo bo'ladi.`;
    const backBtn = Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Qayta tekshirish", `ref_bgrp_${batch.id}_0`)],
      [Markup.button.callback("⬅️ To'plamlarga qaytish", "back_to_batches")],
    ]);
    if (ctx.callbackQuery) {
      await ctx.editMessageText(emptyMsg, backBtn);
    } else {
      await ctx.reply(emptyMsg, backBtn);
    }
    return;
  }

  const selectedIds = (batch.target_group_ids || []).map(String);
  const pageSize = 10;
  const totalPages = Math.ceil(groups.length / pageSize) || 1;
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const startIdx = currentPage * pageSize;
  const pageGroups = groups.slice(startIdx, startIdx + pageSize);

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 1 dan boshlab guruhlar ro'yxatini matn ko'rinishida shakllantirish
  let groupsListText = "";
  pageGroups.forEach((g, idx) => {
    const itemNum = startIdx + idx + 1;
    const isSelected = selectedIds.includes(String(g.id));
    const icon = isSelected ? "✅" : "◻️";
    const statusLabel = isSelected ? "<b>[Tanlangan]</b>" : "<i>[Tanlanmagan]</i>";
    const title = esc(g.title || "Guruh");
    groupsListText += `${itemNum}. ${icon} <b>${title}</b> — ${statusLabel}\n`;
  });

  const buttons = [];

  // Har bir guruh uchun tugma (1 dan boshlab raqamlangan va holati ko'rsatilgan)
  pageGroups.forEach((g, idx) => {
    const itemNum = startIdx + idx + 1;
    const isSelected = selectedIds.includes(String(g.id));
    const icon = isSelected ? "✅" : "◻️";
    let title = g.title || "Guruh";
    if (title.length > 28) {
      title = title.substring(0, 26) + "..";
    }
    buttons.push([
      Markup.button.callback(
        `${itemNum}. ${icon} ${title}`,
        `tbgrp_${batch.id}_${g.id}_${currentPage}`,
      ),
    ]);
  });

  // Sahifalash (Orqaga va Oldinga tugmalari har doim mavjud va ishlaydi)
  const navRow = [];
  const prevPage = currentPage > 0 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages - 1 ? currentPage + 1 : null;

  navRow.push(
    Markup.button.callback(
      "◀️ Orqaga",
      prevPage !== null ? `bgroups_${batch.id}_${prevPage}` : `bgrp_first_${batch.id}`,
    ),
  );
  navRow.push(
    Markup.button.callback(
      `📄 ${currentPage + 1}/${totalPages} (${groups.length} ta)`,
      "noop",
    ),
  );
  navRow.push(
    Markup.button.callback(
      "Oldinga ▶️",
      nextPage !== null ? `bgroups_${batch.id}_${nextPage}` : `bgrp_last_${batch.id}`,
    ),
  );
  buttons.push(navRow);

  // Hammasini tanlash / Tozalash
  buttons.push([
    Markup.button.callback(
      "✅ Dastlabki 15 tasini tanlash",
      `all_bgrp_${batch.id}_${currentPage}`,
    ),
    Markup.button.callback(
      "◻️ Tozalash",
      `clr_bgrp_${batch.id}_${currentPage}`,
    ),
  ]);

  // Telegramdan yangilash & Orqaga qaytish
  buttons.push([
    Markup.button.callback("🔄 Guruhlarni yangilash (Telegramdan)", `ref_bgrp_${batch.id}_${currentPage}`),
  ]);
  buttons.push([
    Markup.button.callback("⬅️ To'plamlarga qaytish", "back_to_batches"),
  ]);

  const headerText =
    `👥 <b>TO'PLAMGA GURUHLARNI BIRIKTIRISH</b>\n\n` +
    `📦 <b>To'plam:</b> "${esc(batch.title)}"\n` +
    `📊 <b>Tanlangan:</b> <b>${selectedIds.length}</b> / <b>${config.MAX_BATCH_GROUPS}</b> ta guruh (Maksimal ${config.MAX_BATCH_GROUPS} ta)\n` +
    `📄 <b>Sahifa:</b> <b>${currentPage + 1} / ${totalPages}</b> (Jami mavjud: <b>${groups.length}</b> ta guruh)\n\n` +
    `📋 <b>Guruhlar ro'yxati (${startIdx + 1}–${startIdx + pageGroups.length} dan ${groups.length}):</b>\n` +
    groupsListText +
    `\n<i>💡 Guruh ustiga bosib belgilang yoki olib tashlang:</i>`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(headerText, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard(buttons),
      });
      return;
    } catch (e) {
      if (!e.message?.includes("message is not modified")) {
        console.warn("editMessageText muvaffaqiyatsiz bo'ldi, yangi xabar yuboriladi:", e.message);
      } else {
        return;
      }
    }
  }
  await ctx.replyWithHTML(headerText, Markup.inlineKeyboard(buttons));
}

// --- Callback Query Handlers ---
bot.action("show_cargoes_list", async (ctx) => {
  await ctx.answerCbQuery();
  await showCargoList(ctx, "faol");
});

bot.action(/edit_cargo_(cargo_\d+_\d+)/, async (ctx) => {
  const cargoId = ctx.match[1];
  const cargo = db.getCargoById(cargoId);
  if (!cargo) return ctx.answerCbQuery("E'lon topilmadi.");

  await ctx.answerCbQuery();
  const preview = formatter.formatSingleCargo(cargo, 1);

  const editMenu = Markup.inlineKeyboard([
    [
      Markup.button.callback("1. 📍 Qayerdan", `efield_${cargoId}_from`),
      Markup.button.callback("2. 📍 Qayerga", `efield_${cargoId}_to`),
    ],
    [
      Markup.button.callback("3. 📏 Masofa", `efield_${cargoId}_distance`),
      Markup.button.callback("4. 📦 Yuk turi", `efield_${cargoId}_cargo`),
    ],
    [
      Markup.button.callback("5. ⚖️ Vazn/Hajm", `efield_${cargoId}_weight_volume`),
      Markup.button.callback("6. 🚛 Transport", `efield_${cargoId}_transport`),
    ],
    [
      Markup.button.callback("7. ✅ Holati", `efield_${cargoId}_cargo_status`),
      Markup.button.callback("8. 💰 Avans", `efield_${cargoId}_advance`),
    ],
    [
      Markup.button.callback("9. 💵 To'lov", `efield_${cargoId}_payment`),
      Markup.button.callback("10. ☎️ Kontakt", `efield_${cargoId}_contact`),
    ],
    [
      Markup.button.callback("🔄 Butun e'lonni qaytadan kiritish", `efull_${cargoId}`),
    ],
    [
      Markup.button.callback("⬅️ E'lonlar ro'yxatiga qaytish", "show_cargoes_list"),
    ],
  ]);

  const text = `✏️ **E'lonni tahrirlash:**\n🆔 \`${cargo.id}\`\n\n${preview}\n\nQaysi ma'lumotni o'zgartirmoqchisiz? Quyidagi tugmalardan birini tanlang:`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...editMenu });
    } catch {
      await ctx.replyWithMarkdown(text, editMenu);
    }
  } else {
    await ctx.replyWithMarkdown(text, editMenu);
  }
});

bot.action(
  /efield_(cargo_\d+_\d+)_(from|to|distance|cargo|weight_volume|transport|cargo_status|advance|payment|contact)/,
  async (ctx) => {
    const cargoId = ctx.match[1];
    const field = ctx.match[2];
    const cargo = db.getCargoById(cargoId);
    if (!cargo) return ctx.answerCbQuery("E'lon topilmadi.");

    await ctx.answerCbQuery();

    const fieldLabels = {
      from: "📍 1. Qayerdan (Yuklanadigan joy)",
      to: "📍 2. Qayerga (Yetkazib beriladigan joy)",
      distance: "📏 3. Masofa",
      cargo: "📦 4. Yuk nomi va turi",
      weight_volume: "⚖️ 5. Og'irligi va hajmi",
      transport: "🚛 6. Transport turi",
      cargo_status: "✅ 7. Yuk holati",
      advance: "💰 8. Avans sharti",
      payment: "💵 9. To'lov shakli",
      contact: "☎️ 10. Kontakt (Telefon / @username)",
    };

    return ctx.scene.enter("edit_single_field_wizard", {
      cargoId,
      field,
      fieldName: fieldLabels[field] || field,
      currentValue: cargo[field],
    });
  },
);

bot.action(/efull_(cargo_\d+_\d+)/, async (ctx) => {
  const cargoId = ctx.match[1];
  await ctx.answerCbQuery();
  return ctx.scene.enter("edit_full_cargo_wizard", { cargoId });
});
bot.action("action_create_batch", (ctx) => {
  ctx.answerCbQuery();
  return ctx.scene.enter("create_batch_wizard");
});

bot.action(/filter_(faol|nofaol|qoralama)/, async (ctx) => {
  const status = ctx.match[1];
  await ctx.answerCbQuery();
  await showCargoList(ctx, status);
});

bot.action(/toggle_status_(cargo_\d+_\d+)/, async (ctx) => {
  const cargoId = ctx.match[1];
  const cargo = db.getCargoById(cargoId);
  if (cargo) {
    const newStatus = cargo.status === "faol" ? "nofaol" : "faol";
    db.updateCargoStatus(cargoId, newStatus);
    await ctx.answerCbQuery(`Status: ${newStatus.toUpperCase()}`);
    await ctx.editMessageText(
      `✅ E'lon statusi **${newStatus.toUpperCase()}** ga o'zgartirildi.`,
    );
  }
});

bot.action(/delete_(cargo_\d+_\d+)/, async (ctx) => {
  const cargoId = ctx.match[1];
  db.deleteCargo(cargoId);
  await ctx.answerCbQuery(`E'lon o'chirildi`);
  await ctx.editMessageText(`🗑 E'lon muvaffaqiyatli o'chirildi.`);
});

bot.action(/history_(cargo_\d+_\d+)/, async (ctx) => {
  const cargoId = ctx.match[1];
  const cargo = db.getCargoById(cargoId);
  if (!cargo) return ctx.answerCbQuery(`E'lon topilmadi.`);

  await ctx.answerCbQuery();
  let text = `📊 **E'lon yuborilish tarixi:**\nID: \`${cargo.id}\`\nBajarilgan Sikllar: **${cargo.sent_cycles || 0}/${config.MAX_SENT_COUNT}** sikl\n\n`;

  if (!cargo.sent_history || cargo.sent_history.length === 0) {
    text += `Hozircha guruhlarga yuborilmadi.`;
  } else {
    cargo.sent_history.slice(-15).forEach((h, i) => {
      const dateStr = new Date(h.timestamp).toLocaleTimeString();
      text += `${i + 1}. [Sikl ${h.cycle || 1} | ${dateStr}] ${h.group_title}\n`;
    });
  }

  await ctx.replyWithMarkdown(text);
});

// --- Batch Target Groups Handlers ---
bot.action("noop", (ctx) => ctx.answerCbQuery());

bot.action("back_to_batches", async (ctx) => {
  await ctx.answerCbQuery();
  await showBatchesList(ctx);
});

bot.action(/bgroups_(batch_\d+_\d+)_(\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const page = parseInt(ctx.match[2], 10) || 0;
  await ctx.answerCbQuery();
  await renderBatchGroupsSelector(ctx, batchId, page);
});

bot.action(/bgrp_first_(batch_\d+_\d+)/, async (ctx) => {
  await ctx.answerCbQuery("ℹ️ Siz birinchi sahifadasiz.");
});

bot.action(/bgrp_last_(batch_\d+_\d+)/, async (ctx) => {
  await ctx.answerCbQuery("ℹ️ Siz oxirgi sahifadasiz.");
});

bot.action(/tbgrp_(batch_\d+_\d+)_(.+)_(\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const groupId = ctx.match[2];
  const page = parseInt(ctx.match[3], 10) || 0;
  const res = db.toggleBatchTargetGroup(batchId, groupId);
  if (res && res.reason === "limit_reached") {
    await ctx.answerCbQuery(
      `⚠️ Limit to'ldi (15/15)! Yangi guruh tanlash uchun avval tanlanganlardan birini olib tashlang yoki 'Tozalash'ni bosing.`,
      { show_alert: true },
    );
    return;
  }
  if (res && res.action === "added") {
    await ctx.answerCbQuery(`✅ Guruh tanlandi (${res.count}/${config.MAX_BATCH_GROUPS})`);
  } else if (res && res.action === "removed") {
    await ctx.answerCbQuery(`◻️ Olib tashlandi (${res.count}/${config.MAX_BATCH_GROUPS})`);
  } else {
    await ctx.answerCbQuery();
  }
  await renderBatchGroupsSelector(ctx, batchId, page);
});

bot.action(/all_bgrp_(batch_\d+_\d+)_(\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const page = parseInt(ctx.match[2], 10) || 0;
  let groups = db.getTargetGroups();
  if ((!groups || groups.length === 0) && userbot.isConnected && userbot.client) {
    try {
      groups = await userbot.getJoinedGroups();
    } catch (e) {}
  }
  db.selectAllGroupsForBatch(batchId, (groups || []).map((g) => g.id));
  await ctx.answerCbQuery(`Dastlabki ${config.MAX_BATCH_GROUPS} ta guruh tanlandi (Maksimal ${config.MAX_BATCH_GROUPS} ta)!`);
  await renderBatchGroupsSelector(ctx, batchId, page);
});

bot.action(/clr_bgrp_(batch_\d+_\d+)_(\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const page = parseInt(ctx.match[2], 10) || 0;
  db.clearBatchTargetGroups(batchId);
  await ctx.answerCbQuery("Barcha guruhlar tozalandi!");
  await renderBatchGroupsSelector(ctx, batchId, page);
});

bot.action(/ref_bgrp_(batch_\d+_\d+)_(\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const page = parseInt(ctx.match[2], 10) || 0;
  await ctx.answerCbQuery("Telegramdan guruhlar yangilanmoqda...");
  await renderBatchGroupsSelector(ctx, batchId, page, true);
});

// --- Batch Cargo Add/Remove Handlers ---
bot.action(/batch_add_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const batch = db.getBatchById(batchId);
  if (!batch) return ctx.answerCbQuery(`To'plam topilmadi.`);

  const activeCargoes = db.getAllCargoes("faol");
  const availableCargoes = activeCargoes.filter(
    (c) => !batch.cargo_ids.includes(c.id),
  );

  if (availableCargoes.length === 0) {
    return ctx.answerCbQuery(`Qo'shish uchun mos faol e'lonlar topilmadi.`);
  }

  ctx.answerCbQuery();
  const buttons = availableCargoes.map((c) => [
    Markup.button.callback(
      `➕ [${c.from} ➔ ${c.to}] (${c.cargo})`,
      `badd_${batchId}_${c.id}`,
    ),
  ]);

  await ctx.reply(
    `📦 **"${batch.title}"** to'plamiga qaysi e'lonni qo'shmoqchisiz?`,
    Markup.inlineKeyboard(buttons),
  );
});

bot.action(/badd_(batch_\d+_\d+)_(cargo_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const cargoId = ctx.match[2];
  try {
    db.addCargoToBatch(batchId, cargoId);
    await ctx.answerCbQuery(`E'lon to'plamga qo'shildi!`);
    await ctx.reply(`✅ E'lon to'plamga muvaffaqiyatli qo'shildi.`);
  } catch (err) {
    await ctx.answerCbQuery(err.message);
  }
});

bot.action(/batch_rem_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const batch = db.getBatchById(batchId);
  if (!batch || batch.cargo_ids.length === 0) {
    return ctx.answerCbQuery(`To'plamda olib tashlanadigan e'lonlar yo'q.`);
  }

  ctx.answerCbQuery();
  const buttons = batch.cargo_ids.map((cId) => {
    const c = db.getCargoById(cId);
    const label = c ? `➖ [${c.from} ➔ ${c.to}]` : `➖ ID: ${cId}`;
    return [Markup.button.callback(label, `brem_${batchId}_${cId}`)];
  });

  await ctx.reply(
    `📦 **"${batch.title}"** to'plamidan qaysi e'lonni olib tashlamoqchisiz?`,
    Markup.inlineKeyboard(buttons),
  );
});

bot.action(/brem_(batch_\d+_\d+)_(cargo_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const cargoId = ctx.match[2];
  db.removeCargoFromBatch(batchId, cargoId);
  await ctx.answerCbQuery(`E'lon to'plamdan olib tashlandi!`);
  await ctx.reply(`➖ E'lon to'plamdan olib tashlandi.`);
});

bot.action(/batch_view_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const batchInfo = db.getBatchWithCargoes(batchId);
  if (!batchInfo || !batchInfo.batch)
    return ctx.answerCbQuery(`To'plam topilmadi.`);

  ctx.answerCbQuery();
  if (batchInfo.cargoes.length === 0) {
    return ctx.reply(
      `ℹ️ "${batchInfo.batch.title}" to'plamida hozircha faol e'lonlar yo'q.`,
    );
  }

  const formattedMessage = formatter.formatBatchMessage(batchInfo.cargoes, 1);
  await ctx.reply(
    `📦 **To'plam xabari ko'rinishi (Live Preview):**\n\n${formattedMessage}`,
  );
});

bot.action(/batch_del_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  db.deleteBatch(batchId);
  await ctx.answerCbQuery(`To'plam o'chirildi`);
  await ctx.reply(`🗑 To'plam muvaffaqiyatli o'chirildi.`);
});

bot.action(/toggle_batch_status_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const batch = db.getBatchById(batchId);
  if (!batch) return ctx.answerCbQuery(`To'plam topilmadi.`);

  const newStatus = batch.status === "faol" ? "nofaol" : "faol";
  db.updateBatchStatus(batchId, newStatus);
  await ctx.answerCbQuery(`To'plam holati: ${newStatus.toUpperCase()}`);
  await ctx.reply(
    `✅ "${batch.title}" to'plami holati **${newStatus.toUpperCase()}** ga o'zgartirildi.`,
    getMainMenuKeyboard(),
  );
});

bot.action(/batch_stats_(batch_\d+_\d+)/, async (ctx) => {
  const batchId = ctx.match[1];
  const batch = db.getBatchById(batchId);
  if (!batch) return ctx.answerCbQuery(`To'plam topilmadi.`);

  await ctx.answerCbQuery();
  const groupStats = batch.group_stats || {};
  const groupIds = Object.keys(groupStats);

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let text = `📊 <b>"${esc(batch.title)}" TO'PLAMI STATISTIKASI</b>\n\n`;
  text += `📌 <b>Holati:</b> ${batch.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
  text += `🔄 <b>Bajarilgan sikllar:</b> ${batch.completed_cycles || 0}/${config.MAX_SENT_COUNT} ta\n`;
  text += `👥 <b>Tanlangan guruhlar:</b> ${(batch.target_group_ids || []).length}/${config.MAX_BATCH_GROUPS} ta\n`;
  text += `📊 <b>Yuborilgan guruhlar:</b> ${groupIds.length} ta\n\n`;

  if (groupIds.length === 0) {
    text += `<i>Bu to'plam hali birorta ham guruhga yuborilmagan.</i>`;
  } else {
    text += `📋 <b>Guruhlar bo'yicha statistika (necha marta yuborilgani):</b>\n`;
    groupIds.forEach((gId, idx) => {
      const item = groupStats[gId];
      let linkPart = "";
      if (item.last_message_link) {
        linkPart = ` | <a href="${item.last_message_link}">👉 Oxirgi xabar</a>`;
      }
      text += `${idx + 1}. <b>${esc(item.title || "Guruh")}</b> — <b>${item.count}/${config.MAX_SENT_COUNT} marta</b>${linkPart}\n`;
    });
  }

  if (text.length > 4000) {
    const chunks = text.match(/[\s\S]{1,3800}/g) || [text];
    for (const chunk of chunks) {
      await ctx.replyWithHTML(chunk, { disable_web_page_preview: true });
    }
  } else {
    await ctx.replyWithHTML(text, { disable_web_page_preview: true });
  }
});

// Link scheduler to bot instance for live message updates
scheduler.setBot(bot);

// Forward scheduler logs to bot owner if available
scheduler.setLogCallback((logMsg) => {
  if (config.OWNER_ID) {
    bot.telegram.sendMessage(config.OWNER_ID, `🤖 ${logMsg}`).catch(() => {});
  }
});

module.exports = bot;
module.exports.renderBatchGroupsSelector = renderBatchGroupsSelector;
