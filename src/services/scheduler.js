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
   * Qoida: Bitta guruhga hech qachon ketma-ket bir xil matn yuborilmasligi kerak.
   */
  getNextVariant(batchId, groupId, cycleIndex, groupIndex) {
    const lastVariant = db.getBatchLastVariantForGroup(batchId, groupId);

    // Birlamchi formula: sikl va guruh indeksi bo'yicha rotatsiya (1 dan 10 gacha)
    let candidate = ((((cycleIndex - 1 + groupIndex) % 10) + 10) % 10) + 1;

    // Agar nomzod variant oldingi yuborilgan variant bilan bir xil bo'lsa, keyingisiga suramiz
    if (candidate === lastVariant) {
      candidate = (candidate % 10) + 1;
    }

    return candidate;
  }

  /**
   * Statistika xabarini HTML formatida xavfsiz shakllantiradi
   * Guruhlar nomi, necha marta yuborilgani va oxirgi yuborilgan xabarga havola / yo'nalish
   */
  buildStatisticsText(batch, cycleNumber, groupIndex, totalGroups, currentStatus) {
    const freshBatch = db.getBatchById(batch.id) || batch;
    const completedCycles = freshBatch.completed_cycles || 0;
    const groupStats = freshBatch.group_stats || {};
    const groupIds = Object.keys(groupStats);

    let text = `📊 <b>E'LONLAR TO'PLAMI STATISTIKASI</b>\n\n`;
    text += `📦 <b>To'plam:</b> ${escapeHtml(freshBatch.title)}\n`;
    text += `📌 <b>Holati:</b> ${freshBatch.status === "faol" ? "🟢 FAOL" : "🔴 NOFAOL"}\n`;
    text += `🔄 <b>Bajarilgan sikllar:</b> ${completedCycles}/${config.MAX_SENT_COUNT} ta\n`;
    text += `👥 <b>Guruhlar soni:</b> ${totalGroups} ta\n`;
    text += `⚡️ <b>Hozirgi jarayon:</b> [${groupIndex + 1}/${totalGroups}] ${escapeHtml(currentStatus)}\n\n`;

    text += `📋 <b>Guruhlar bo'yicha hisobot va xabarlarga havolalar:</b>\n`;
    if (groupIds.length === 0) {
      text += `<i>Hozircha guruhlarga yuborilmadi</i>\n`;
    } else {
      let lines = [];
      groupIds.forEach((gId, idx) => {
        const item = groupStats[gId];
        let linkPart = "";
        if (item.last_message_link) {
          linkPart = ` | <a href="${item.last_message_link}">👉 Oxirgi xabar</a>`;
        } else if (item.last_message_id) {
          linkPart = ` | <i>(Xabar #${item.last_message_id})</i>`;
        }

        lines.push(
          `${idx + 1}. <b>${escapeHtml(item.title || "Guruh")}</b> — <b>${item.count} marta</b>${linkPart}`,
        );
      });

      // Telegram 4096 belgilik chegarasiga sig'dirish
      let rendered = lines.join("\n");
      if (rendered.length > 3300) {
        rendered =
          lines.slice(-30).join("\n") +
          `\n<i>...va yana ${lines.length - 30} ta guruh</i>`;
      }
      text += rendered;
    }

    return text;
  }

  /**
   * Jonli statistika xabarini tahrirlaydi (editMessage). Har safar yangi xabar yuborilmaydi!
   */
  async updateLiveStatsMessage(batch, cycleNumber, groupIndex, totalGroups, currentStatus) {
    const text = this.buildStatisticsText(
      batch,
      cycleNumber,
      groupIndex,
      totalGroups,
      currentStatus,
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
    this.log(`🚀 Tarqatish dvigateli ishga tushdi! (Jami 10 ta sikl rejasi)`);
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
            );
            allBatches.push(newBatch);
          } else {
            this.log(
              "⚠️ Faol to'plamlar topilmadi (Barcha to'plamlar 10 ta siklni tugatgan yoki nofaol). 5 daqiqadan so'ng qayta tekshiriladi.",
            );
            await this.sleep(5 * 60 * 1000);
            continue;
          }
        }

        // Har bir faol to'plam uchun tarqatish
        for (const batch of allBatches) {
          if (!this.isRunning) break;

          // Agar to'plam allaqachon 10 ta siklni bajargan bo'lsa, uni nofaolga o'tkazamiz
          if ((batch.completed_cycles || 0) >= config.MAX_SENT_COUNT) {
            db.updateBatchStatus(batch.id, "nofaol");
            continue;
          }

          const { cargoes } = db.getBatchWithCargoes(batch.id) || {};
          const cargoList = cargoes || [];

          // Guruhlarni aralashtirish (anti-spam)
          const targetGroups = this.shuffleArray(defaultGroups);
          const totalGroups = targetGroups.length;
          const currentCycle = (batch.completed_cycles || 0) + 1;

          this.log(
            `📦 "${batch.title}" to'plami [Sikl #${currentCycle}/${config.MAX_SENT_COUNT}] boshlandi (${totalGroups} ta haqiqiy guruh)...`,
          );

          // Statistika xabarini boshlang'ich holatda yangilash
          await this.updateLiveStatsMessage(
            batch,
            currentCycle,
            0,
            totalGroups,
            `Sikl #${currentCycle} boshlanmoqda...`,
          );

          // Guruhlar bo'ylab navbat bilan yuborish
          for (let i = 0; i < targetGroups.length; i++) {
            if (!this.isRunning) break;

            const group = targetGroups[i];

            // Matn varianti (1 dan 10 gacha): ketma-ket takrorlanmaydi
            const variantNumber = this.getNextVariant(
              batch.id,
              group.id,
              currentCycle,
              i,
            );

            // Xabar matnini tayyorlash
            let groupMessage = "";
            if (cargoList.length > 0) {
              groupMessage = formatter.formatBatchMessage(
                cargoList,
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

              // 1-Yangi funksiya: To'plam statistikasi va oxirgi xabar havolasini bazaga yozish
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
              totalGroups,
              `"${group.title}"ga yuborildi (Variant #${variantNumber})`,
            );

            // VAQT QOIDALARI:
            if (i < totalGroups - 1 && this.isRunning) {
              // Har 20 ta guruhdan so'ng 5 daqiqa tanaffus
              if ((i + 1) % config.BATCH_PAUSE_GROUPS_COUNT === 0) {
                const totalPauseMs = config.BATCH_PAUSE_MS;
                this.log(`☕️ ${i + 1} ta guruhga yuborildi. 5 daqiqa tanaffus olinmoqda...`);

                // 5 daqiqalik tanaffusda taymerni jonli yangilab turish
                let pausePassedMs = 0;
                while (pausePassedMs < totalPauseMs && this.isRunning) {
                  const remainingMin = Math.ceil((totalPauseMs - pausePassedMs) / (60 * 1000));
                  await this.updateLiveStatsMessage(
                    batch,
                    currentCycle,
                    i,
                    totalGroups,
                    `☕️ 20 ta guruh yakunlandi. 5 daqiqa tanaffus: qolgan vaqt ${remainingMin} daqiqa...`,
                  );
                  const waitChunk = Math.min(60000, totalPauseMs - pausePassedMs);
                  await this.sleep(waitChunk);
                  pausePassedMs += waitChunk;
                }
                this.log(`▶️ Tanaffus yakunlandi, sikl davom etmoqda.`);
              } else {
                // Har bir guruhdan so'ng aniq 50 soniya kutish
                await this.updateLiveStatsMessage(
                  batch,
                  currentCycle,
                  i,
                  totalGroups,
                  `"${group.title}"ga yuborildi. Keyingi guruhgacha 50s kutilmoqda...`,
                );
                await this.sleep(config.GROUP_DELAY_MS);
              }
            }
          }

          if (!this.isRunning) break;

          // SIKL TUGADI: Barcha guruhlarga bitta e'lonlar to'plami to'liq yuborildi!
          db.incrementBatchCompletedCycle(batch.id);
          const updatedBatch = db.getBatchById(batch.id);

          this.log(
            `✅ "${batch.title}" to'plami uchun #${currentCycle}-sikl to'liq yakunlandi! (Jami: ${updatedBatch.completed_cycles}/${config.MAX_SENT_COUNT})`,
          );

          if (updatedBatch.status === "nofaol") {
            this.log(
              `🛑 "${batch.title}" to'plami 10 ta siklni to'liq yakunladi! Holati "NOFAOL"ga o'tkazildi.`,
            );
            await this.updateLiveStatsMessage(
              updatedBatch,
              currentCycle,
              totalGroups - 1,
              totalGroups,
              `🎉 10 ta sikl to'liq yakunlandi! To'plam holati NOFAOLga o'tkazildi.`,
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
                totalGroups,
                `😴 Sikl #${currentCycle} tugadi. Keyingi #${currentCycle + 1}-siklgacha: ${remainingMin} daqiqa qoldi...`,
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
