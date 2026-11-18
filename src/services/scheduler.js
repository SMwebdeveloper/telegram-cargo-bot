const db = require("../database/db");
const userbot = require("./userbot");
const formatter = require("./formatter");
const config = require("../config");

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class DistributionScheduler {
  constructor() {
    this.isRunning = false;
    this.timerId = null;
    this.botInstance = null;
    this.statusMessageId = null;
    this.userbotStatusMsgId = null;
    this.logCallback = null;
  }

  setBot(bot) {
    this.botInstance = bot;
  }

  setLogCallback(fn) {
    this.logCallback = fn;
  }

  log(msg) {
    console.log(`[Scheduler] ${msg}`);
    if (this.logCallback) {
      this.logCallback(msg);
    }
  }

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Tanlangan guruh uchun navbatdagi matn variantini hisoblaydi.
   * Qoida: Guruhga har doim namunalar yangilanib, 1 dan 10 gacha ketma-ket almashib boradi (hech qachon bir xil namuna ketma-ket yuborilmaydi).
   */
  getNextVariant(batchId, groupId, cycleIndex, groupIndex) {
    const lastVariant = db.getBatchLastVariantForGroup(batchId, groupId);

    if (lastVariant) {
      // Guruhga avval yuborilgan namunadan keyingi yangi namuna (1 -> 2 -> 3 ... -> 10 -> 1)
      return (lastVariant % 10) + 1;
    }

    // Boshlang'ich jo'natishda har bir guruh har xil namunadan boshlaydi
    return ((((groupIndex) % 10) + 10) % 10) + 1;
  }

  /**
   * Statistika xabarini HTML formatida xavfsiz shakllantiradi
   * Tarqatilayotgan to'plam matni, qaysi guruhlarga yuborilishi kerakligi va necha marta yuborilganligini ko'rsatadi
   */
  buildStatisticsText(batch, cycleNumber, currentGroupIndex, targetGroups = [], currentStatus = "", currentMessageText = "") {
    const freshBatch = db.getBatchById(batch.id) || batch;
    const completedCycles = freshBatch.completed_cycles || 0;
    const groupStats = freshBatch.group_stats || {};
    const totalGroups = targetGroups.length;

    let text = `🚚 <b>TARQATILAYOTGAN TO'PLAM: ${escapeHtml(freshBatch.title)}</b>\n\n`;
    text += `📌 <b>Holati:</b> ${freshBatch.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
    text += `🔄 <b>Bajarilgan sikllar:</b> ${completedCycles}/${config.MAX_SENT_COUNT} ta\n`;
    text += `👥 <b>Tanlangan guruhlar:</b> ${totalGroups} ta (Faqat 15 tanlangan guruh)\n`;
    const progressIndex = currentGroupIndex >= 0 ? currentGroupIndex + 1 : 0;
    text += `⚡️ <b>Hozirgi jarayon:</b> [${progressIndex}/${totalGroups}] ${escapeHtml(currentStatus)}\n\n`;

    text += `📋 <b>GURUHLAR BO'YICHA STATISTIKA (QAYSI GURUHGA NECHA MARTA YUBORILGANI):</b>\n`;
    if (totalGroups === 0) {
      text += `<i>⚠️ Ushbu to'plamga hali birorta ham guruh biriktirilmagan!</i>\n`;
    } else {
      let lines = [];
      targetGroups.forEach((group, idx) => {
        const item = groupStats[group.id] || { count: 0 };
        const sentCount = item.count || 0;

        let icon = "⏳";
        let statusNote = "";
        if (currentGroupIndex >= 0) {
          if (idx < currentGroupIndex) {
            icon = "✅";
          } else if (idx === currentGroupIndex) {
            icon = "🔄";
            statusNote = " <i>(Hozirgi)</i>";
          } else {
            icon = "⏳";
            statusNote = " <i>(Navbatda)</i>";
          }
        }

        let linkPart = "";
        if (item.last_message_link) {
          linkPart = ` | <a href="${item.last_message_link}">👉 Oxirgi xabar</a>`;
        } else if (item.last_message_id) {
          linkPart = ` | <i>(ID: #${item.last_message_id})</i>`;
        }

        lines.push(
          `${idx + 1}. ${icon} <b>${escapeHtml(group.title || "Guruh")}</b> — <b>${sentCount}/${config.MAX_SENT_COUNT} marta</b>${statusNote}${linkPart}`,
        );
      });

      // Telegram 4096 belgilik chegarasiga sig'dirish
      if (lines.length > 25) {
        // Agar guruhlar ko'p bo'lsa, joriy guruh atrofidagilarni ko'rsatamiz
        const start = Math.max(0, currentGroupIndex - 10);
        const end = Math.min(lines.length, start + 25);
        let visibleLines = lines.slice(start, end);
        let headerNote = start > 0 ? `<i>...avvalgi ${start} ta guruh</i>\n` : "";
        let footerNote = end < lines.length ? `\n<i>...yana ${lines.length - end} ta guruh</i>` : "";
        text += headerNote + visibleLines.join("\n") + footerNote + "\n";
      } else {
        text += lines.join("\n") + "\n";
      }
    }

    if (currentMessageText) {
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📦 <b>TARQATILAYOTGAN TO'PLAM MATNI:</b>\n`;
      let previewSafe = escapeHtml(currentMessageText.trim());
      if (previewSafe.length > 1000) {
        previewSafe = previewSafe.substring(0, 990) + "...";
      }
      text += `<code>${previewSafe}</code>`;
    }

    // Umumiy matn 4000 belgidan oshmasligini ta'minlash
    if (text.length > 3900) {
      text = text.substring(0, 3850) + "\n<i>...(matn qisqartirildi)</i>";
    }

    return text;
  }

  /**
   * Jonli statistika xabarini tahrirlaydi (editMessage). Har safar yangi xabar yuborilmaydi!
   */
  async updateLiveStatsMessage(batch, cycleNumber, currentGroupIndex, targetGroups = [], currentStatus = "", currentMessageText = "") {
    const text = this.buildStatisticsText(
      batch,
      cycleNumber,
      currentGroupIndex,
      targetGroups,
      currentStatus,
      currentMessageText,
    );

    // 1. Telegraf Admin Bot (Owner) chatidagi xabarni yangilash
    if (this.botInstance && config.OWNER_ID) {
      try {
        if (this.statusMessageId) {
          await this.botInstance.telegram.editMessageText(
            config.OWNER_ID,
            this.statusMessageId,
            null,
            text,
            { parse_mode: "HTML", disable_web_page_preview: true },
          );
        } else {
          const sent = await this.botInstance.telegram.sendMessage(
            config.OWNER_ID,
            text,
            { parse_mode: "HTML", disable_web_page_preview: true },
          );
          this.statusMessageId = sent.message_id;
        }
      } catch (err) {
        // Agar xabar topilmasa yoki o'chirilgan bo'lsa, yangisini yuboramiz
        try {
          const sent = await this.botInstance.telegram.sendMessage(
            config.OWNER_ID,
            text,
            { parse_mode: "HTML", disable_web_page_preview: true },
          );
          this.statusMessageId = sent.message_id;
        } catch (sendErr) {
          // ignore
        }
      }
    }

    // 2. Userbot Saved Messages ("me") dagi xabarni yangilash
    if (userbot && userbot.isConnected && userbot.client) {
      try {
        if (this.userbotStatusMsgId) {
          await userbot.client.editMessage("me", {
            message: this.userbotStatusMsgId,
            text: text,
            parseMode: "html",
            linkPreview: false,
          });
        } else {
          const sent = await userbot.client.sendMessage("me", {
            message: text,
            parseMode: "html",
            linkPreview: false,
          });
          this.userbotStatusMsgId = sent.id;
        }
      } catch (uErr) {
        try {
          const sent = await userbot.client.sendMessage("me", {
            message: text,
            parseMode: "html",
            linkPreview: false,
          });
          this.userbotStatusMsgId = sent.id;
        } catch (sErr) {
          // ignore
        }
      }
    }
  }

  start() {
    if (this.isRunning) return false;
    this.isRunning = true;
    db.updateBotSettings({ is_running: true });
    this.log(`🚀 Tarqatish dvigateli ishga tushdi! (Jami ${config.MAX_SENT_COUNT} ta sikl rejasi)`);
    this.runLoop();
    return true;
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    db.updateBotSettings({ is_running: false });
    this.log("⏹ Tarqatish dvigateli to'xtatildi.");
    return true;
  }

  async runLoop() {
    while (this.isRunning) {
      try {
        // 1. Auto-clean 48-hour old inactive cargoes
        db.autoCleanInactiveCargoes();

        // 2. Faqat haqiqiy guruhlar ro'yxatini yuklash (kanallar butunlay chiqarib tashlanadi)
        let defaultGroups = [];
        if (userbot.isConnected && userbot.client) {
          try {
            defaultGroups = await userbot.getJoinedGroups();
            if (defaultGroups && defaultGroups.length > 0) {
              db.setTargetGroups(
                defaultGroups.map((g) => ({
                  id: g.id,
                  title: g.title,
                  username: g.username || null,
                })),
              );
            }
          } catch (loadErr) {
            this.log(`⚠️ Guruhlarni yuklashda ogohlantirish: ${loadErr.message}`);
          }
        }

        if (!defaultGroups || defaultGroups.length === 0) {
          defaultGroups = db.getTargetGroups();
        }

        if (!defaultGroups || defaultGroups.length === 0) {
          this.log("⚠️ Profilingizda guruhlar topilmadi. Engine 5 daqiqaga to'xtatildi.");
          await this.sleep(5 * 60 * 1000);
          continue;
        }

        // 3. Tarqatiladigan faol to'plamlarni olish
        const allBatches = db.getAllBatches("faol");

        // Agar to'plam bo'lmasa, faol e'lonlardan to'plam yaratish
        if (allBatches.length === 0) {
          const activeCargoes = db.getAllCargoes("faol");
          if (activeCargoes.length > 0) {
            this.log("📦 Yangi to'plam yaratilmoqda...");
            const newBatch = db.createBatch(
              "Asosiy to'plam",
              activeCargoes.slice(0, config.MAX_BATCH_CARGOES).map((c) => c.id),
              defaultGroups.slice(0, config.MAX_BATCH_GROUPS).map((g) => g.id), // yangi to'plamga faqat 15 ta guruhni biriktirish
            );
            allBatches.push(newBatch);
          } else {
            this.log(
              `⚠️ Faol to'plamlar topilmadi (Barcha to'plamlar ${config.MAX_SENT_COUNT} ta siklni tugatgan yoki nofaol). 5 daqiqadan so'ng qayta tekshiriladi.`,
            );
            await this.sleep(5 * 60 * 1000);
            continue;
          }
        }

        // Har bir faol to'plam uchun tarqatish
        for (const batch of allBatches) {
          if (!this.isRunning) break;

          // Agar to'plam allaqachon MAX_SENT_COUNT ta siklni bajargan bo'lsa, uni nofaolga o'tkazamiz
          if ((batch.completed_cycles || 0) >= config.MAX_SENT_COUNT) {
            db.updateBatchStatus(batch.id, "nofaol");
            continue;
          }

          const { cargoes } = db.getBatchWithCargoes(batch.id) || {};
          const cargoList = cargoes || [];
          const previewMessage =
            cargoList.length > 0
              ? formatter.formatBatchMessage(cargoList, 1)
              : formatter.formatSingleCargo(null, 1);

          // To'plam uchun biriktirilgan maqsadli guruhlarni tekshirish
          const targetGroupIds = (batch.target_group_ids || []).map(String);
          if (targetGroupIds.length === 0) {
            this.log(
              `⚠️ "${batch.title}" to'plami uchun guruhlar tanlanmagan! Iltimos, to'plam sozlamalaridan guruhlarni tanlang.`,
            );
            await this.updateLiveStatsMessage(
              batch,
              (batch.completed_cycles || 0) + 1,
              -1,
              [],
              `⚠️ Ushbu to'plam uchun birorta ham guruh tanlanmagan! To'plam sozlamalaridan guruhlarni belgilang.`,
              previewMessage,
            );
            continue;
          }

          const batchGroups = defaultGroups
            .filter((g) => targetGroupIds.includes(String(g.id)))
            .slice(0, config.MAX_BATCH_GROUPS); // Faqat 15 tanlangan guruhga cheklash

          if (batchGroups.length === 0) {
            this.log(
              `⚠️ "${batch.title}" to'plamiga tanlangan guruhlar profilingizda topilmadi.`,
            );
            await this.updateLiveStatsMessage(
              batch,
              (batch.completed_cycles || 0) + 1,
              -1,
              [],
              `⚠️ Tanlangan guruhlar hisobingizda topilmadi.`,
              previewMessage,
            );
            continue;
          }

          // Tanlangan guruhlarni aralashtirish (anti-spam)
          const targetGroups = this.shuffleArray(batchGroups);
          const totalGroups = targetGroups.length;
          const currentCycle = (batch.completed_cycles || 0) + 1;

          this.log(
            `📦 "${batch.title}" to'plami [Sikl #${currentCycle}/${config.MAX_SENT_COUNT}] boshlandi (${totalGroups} ta tanlangan guruh)...`,
          );

          // Statistika xabarini boshlang'ich holatda yangilash
          await this.updateLiveStatsMessage(
            batch,
            currentCycle,
            -1,
            targetGroups,
            `Sikl #${currentCycle} boshlanmoqda...`,
            previewMessage,
          );

          // Tanlangan guruhlar bo'ylab navbat bilan yuborish
          for (let i = 0; i < targetGroups.length; i++) {
            if (!this.isRunning) break;

            const group = targetGroups[i];

            // HAR BIR GURUHGA YUBORISHDAN OLDIN BAZADAN ENG YANGI E'LONLAR MA'LUMOTLARINI OLISH!
            const freshBatchWithCargoes = db.getBatchWithCargoes(batch.id) || {};
            const activeCargoList = (freshBatchWithCargoes.cargoes || []).filter(
              (c) => c && c.status === "faol",
            );

            // Matn varianti (1 dan 10 gacha): Namunalar doimiy yangilanib, 1 dan 10 gacha ketma-ket almashadi
            const variantNumber = this.getNextVariant(
              batch.id,
              group.id,
              currentCycle,
              i,
            );

            // Xabar matnini tayyorlash (Doim 10 ta namunadan biriga moslab yangi ma'lumot bilan shakllantirish)
            let groupMessage = "";
            if (activeCargoList.length > 0) {
              groupMessage = formatter.formatBatchMessage(
                activeCargoList,
                variantNumber,
              );
            } else {
              groupMessage = formatter.formatSingleCargo(null, variantNumber);
            }

            let sentMsg = null;
            let messageLink = null;

            try {
              sentMsg = await userbot.sendMessageToGroup(group.id, groupMessage);

              // Xabarga havola yaratish (username yoki supergroup /c/ formatida)
              if (sentMsg && sentMsg.id) {
                if (group.username) {
                  messageLink = `https://t.me/${group.username}/${sentMsg.id}`;
                } else {
                  const cleanId = group.id
                    .toString()
                    .replace(/^-100/, "")
                    .replace(/^-/, "");
                  messageLink = `https://t.me/c/${cleanId}/${sentMsg.id}`;
                }
              }

              this.log(
                `[Sikl #${currentCycle} | ${i + 1}/${totalGroups}] ✅ Variant #${variantNumber} yuborildi: "${group.title}"`,
              );

              // To'plam statistikasi va oxirgi xabar havolasini bazaga yozish
              db.recordBatchGroupDispatch(
                batch.id,
                group,
                currentCycle,
                variantNumber,
                { id: sentMsg?.id, link: messageLink },
              );

              for (const cargo of cargoList) {
                db.recordGroupDispatch(cargo.id, group, currentCycle);
              }
            } catch (err) {
              this.log(
                `[Sikl #${currentCycle} | ${i + 1}/${totalGroups}] ❌ Xatolik "${group.title}": ${err.message}`,
              );

              // Agar Telegram FloodWait xatosi bersa, aytilgan soniyani kutish
              if (err.seconds) {
                this.log(`⏳ Telegram FloodWait: ${err.seconds} soniya kutilmoqda...`);
                await this.sleep((err.seconds + 2) * 1000);
              }
            }

            // Statistika xabarini har bir guruhdan keyin yangilash!
            await this.updateLiveStatsMessage(
              batch,
              currentCycle,
              i,
              targetGroups,
              `"${group.title}"ga yuborildi (Variant #${variantNumber})`,
              groupMessage,
            );

            // VAQT QOIDALARI:
            if (i < totalGroups - 1 && this.isRunning) {
              // Har 5 ta guruhdan so'ng 3-4 daqiqa dam olish
              if ((i + 1) % config.BATCH_PAUSE_GROUPS_COUNT === 0) {
                const minPause = config.BATCH_PAUSE_MIN_MS || 180000;
                const maxPause = config.BATCH_PAUSE_MAX_MS || 240000;
                const totalPauseMs =
                  Math.floor(Math.random() * (maxPause - minPause + 1)) + minPause;
                const pauseMinStr = (totalPauseMs / 60000).toFixed(1);

                this.log(`☕️ ${i + 1} ta guruhga yuborildi. 3-4 daqiqa dam olinmoqda (${pauseMinStr} daqiqa)...`);

                // 3-4 daqiqalik dam olishda taymerni jonli yangilab turish
                let pausePassedMs = 0;
                while (pausePassedMs < totalPauseMs && this.isRunning) {
                  const remainingSec = Math.max(0, Math.ceil((totalPauseMs - pausePassedMs) / 1000));
                  const remMin = Math.floor(remainingSec / 60);
                  const remSec = remainingSec % 60;
                  const timeText = remMin > 0 ? `${remMin} daq ${remSec} sek` : `${remSec} sek`;

                  await this.updateLiveStatsMessage(
                    batch,
                    currentCycle,
                    i,
                    targetGroups,
                    `☕️ ${i + 1} ta guruh yakunlandi. 3-4 daqiqa dam olish: qolgan vaqt ${timeText}...`,
                    groupMessage,
                  );
                  const waitChunk = Math.min(10000, totalPauseMs - pausePassedMs);
                  await this.sleep(waitChunk);
                  pausePassedMs += waitChunk;
                }
                this.log(`▶️ Dam olish yakunlandi, navbatdagi guruhga jo'natish davom etmoqda.`);
              } else {
                // Har bir guruhdan so'ng belgilangan kutish
                const waitSec = Math.round(config.GROUP_DELAY_MS / 1000);
                await this.updateLiveStatsMessage(
                  batch,
                  currentCycle,
                  i,
                  targetGroups,
                  `"${group.title}"ga yuborildi. Keyingi guruhgacha ${waitSec}s kutilmoqda...`,
                  groupMessage,
                );
                await this.sleep(config.GROUP_DELAY_MS);
              }
            }
          }

          if (!this.isRunning) break;

          // SIKL TUGADI: Belgilangan barcha guruhlarga ushbu to'plam to'liq yuborildi!
          db.incrementBatchCompletedCycle(batch.id);
          const updatedBatch = db.getBatchById(batch.id);

          this.log(
            `✅ "${batch.title}" to'plami uchun #${currentCycle}-sikl to'liq yakunlandi! (Jami: ${updatedBatch.completed_cycles}/${config.MAX_SENT_COUNT})`,
          );

          if (updatedBatch.status === "nofaol") {
            this.log(
              `🛑 "${batch.title}" to'plami ${config.MAX_SENT_COUNT} ta siklni to'liq yakunladi! Holati "NOFAOL"ga o'tkazildi.`,
            );
            await this.updateLiveStatsMessage(
              updatedBatch,
              currentCycle,
              totalGroups - 1,
              targetGroups,
              `🎉 ${config.MAX_SENT_COUNT} ta sikl to'liq yakunlandi! To'plam holati NOFAOLga o'tkazildi.`,
              previewMessage,
            );
          } else {
            // Sikl tugagach, keyingi sikl boshlanishidan oldin 20 daqiqa kutiladi!
            const totalCycleDelayMs = config.CYCLE_DELAY_MS;
            this.log(`😴 Sikl tugadi. Keyingi siklgacha 20 daqiqa tanaffus kutilmoqda...`);

            // 20 daqiqa davomida har 1 daqiqada taymer yangilanib boradi
            let cyclePassedMs = 0;
            while (cyclePassedMs < totalCycleDelayMs && this.isRunning) {
              const remainingMin = Math.ceil((totalCycleDelayMs - cyclePassedMs) / (60 * 1000));
              await this.updateLiveStatsMessage(
                updatedBatch,
                currentCycle,
                totalGroups - 1,
                targetGroups,
                `😴 Sikl #${currentCycle} tugadi. Keyingi #${currentCycle + 1}-siklgacha: ${remainingMin} daqiqa qoldi...`,
                previewMessage,
              );
              const waitChunk = Math.min(60000, totalCycleDelayMs - cyclePassedMs);
              await this.sleep(waitChunk);
              cyclePassedMs += waitChunk;
            }
            this.log(`🔄 Keyingi sikl (#${currentCycle + 1}) boshlanmoqda!`);
          }
        }
      } catch (err) {
        this.log(`❌ Loopda kutilmagan xatolik: ${err.message}`);
        await this.sleep(30000);
      }
    }
  }
}

module.exports = new DistributionScheduler();
