const fs = require("fs");
const path = require("path");
const config = require("../config");
const { toCyrillic } = require("../services/transliterate");

class Database {
  constructor() {
    this.dbFile = config.DB_FILE;
    this.data = {
      cargoes: [],
      batches: [], // List of cargo batches/collections
      target_groups: [], // Default list of all joined groups
      bot_settings: {
        is_running: false,
        last_cycle: 0,
        current_variant: 1,
        last_status_message_id: null,
      },
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(config.DATA_DIR)) {
        fs.mkdirSync(config.DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, "utf8");
        this.data = JSON.parse(raw);
        if (!this.data.batches) this.data.batches = [];

        // Ensure backward compatibility for batches
        this.data.batches.forEach((b) => {
          if (!b.status) b.status = "faol";
          if (b.completed_cycles === undefined) b.completed_cycles = 0;
          if (!b.sent_history) b.sent_history = [];
          if (!b.group_stats) b.group_stats = {};
          if (!b.target_group_ids) b.target_group_ids = [];
          if (b.deactivated_at === undefined) b.deactivated_at = null;
        });

        if (!this.data.bot_settings) {
          this.data.bot_settings = {
            is_running: false,
            last_cycle: 0,
            current_variant: 1,
          };
        }
      } else {
        this.save();
      }
    } catch (err) {
      console.error("Error initializing database:", err);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.data, null, 2), "utf8");
    } catch (err) {
      console.error("Error saving database:", err);
    }
  }

  // --- Cargo CRUD ---

  getAllCargoes(statusFilter = null) {
    if (!statusFilter) return this.data.cargoes;
    return this.data.cargoes.filter((c) => c.status === statusFilter);
  }

  getCargoById(id) {
    return this.data.cargoes.find((c) => c.id === id);
  }

  createCargo(cargoData) {
    const newCargo = {
      id: "cargo_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      from: toCyrillic(cargoData.from || ""),
      to: toCyrillic(cargoData.to || ""),
      distance: toCyrillic(cargoData.distance || ""),
      cargo: toCyrillic(cargoData.cargo || ""),
      weight_volume: toCyrillic(cargoData.weight_volume || ""),
      transport: toCyrillic(cargoData.transport || ""),
      cargo_status: toCyrillic(cargoData.cargo_status || "Груз готов"),
      advance: toCyrillic(cargoData.advance || "Аванс есть"),
      payment: toCyrillic(cargoData.payment || "Оплата наличными"),
      contact: cargoData.contact || "",
      status: cargoData.status || "faol", // faol | nofaol | qoralama
      sent_cycles: 0, // Number of COMPLETED CYCLES across all groups (0 to 10)
      sent_history: [],
      created_at: new Date().toISOString(),
      deactivated_at: null,
    };
    this.data.cargoes.push(newCargo);
    this.save();
    return newCargo;
  }

  updateCargo(id, updatedFields) {
    const cargo = this.getCargoById(id);
    if (!cargo) return null;

    for (const key of [
      "from",
      "to",
      "distance",
      "cargo",
      "weight_volume",
      "transport",
      "cargo_status",
      "advance",
      "payment",
    ]) {
      if (updatedFields[key] !== undefined) {
        updatedFields[key] = toCyrillic(updatedFields[key]);
      }
    }

    Object.assign(cargo, updatedFields);
    this.save();
    return cargo;
  }

  updateCargoStatus(id, newStatus) {
    const cargo = this.getCargoById(id);
    if (!cargo) return null;
    cargo.status = newStatus;
    if (newStatus === "nofaol" && !cargo.deactivated_at) {
      cargo.deactivated_at = new Date().toISOString();
    } else if (newStatus === "faol") {
      cargo.deactivated_at = null;
    }
    this.save();
    return cargo;
  }

  deleteCargo(id) {
    const index = this.data.cargoes.findIndex((c) => c.id === id);
    if (index !== -1) {
      const removed = this.data.cargoes.splice(index, 1);

      // Remove reference from batches
      this.data.batches.forEach((b) => {
        b.cargo_ids = b.cargo_ids.filter((cId) => cId !== id);
      });

      this.save();
      return removed[0];
    }
    return null;
  }

  /**
   * Logs a single group dispatch event for history.
   */
  recordGroupDispatch(id, groupInfo, cycleNumber) {
    const cargo = this.getCargoById(id);
    if (!cargo) return null;

    if (!cargo.sent_history) cargo.sent_history = [];
    cargo.sent_history.push({
      cycle: cycleNumber,
      group_id: groupInfo.id,
      group_title: groupInfo.title || "Group",
      timestamp: new Date().toISOString(),
    });

    this.save();
    return cargo;
  }

  /**
   * Increments COMPLETED CYCLE count for cargo.
   */
  incrementCompletedCycle(id) {
    const cargo = this.getCargoById(id);
    if (!cargo) return null;

    cargo.sent_cycles = (cargo.sent_cycles || 0) + 1;
    this.save();
    return cargo;
  }

  autoCleanInactiveCargoes() {
    const now = Date.now();
    const expiryMs = config.AUTO_DELETE_HOURS * 60 * 60 * 1000;
    const initialCount = this.data.cargoes.length;

    const removedIds = [];
    this.data.cargoes = this.data.cargoes.filter((cargo) => {
      if (cargo.status === "nofaol" && cargo.deactivated_at) {
        const deactivatedTime = new Date(cargo.deactivated_at).getTime();
        if (now - deactivatedTime >= expiryMs) {
          removedIds.push(cargo.id);
          return false;
        }
      }
      return true;
    });

    if (removedIds.length > 0) {
      this.data.batches.forEach((b) => {
        b.cargo_ids = b.cargo_ids.filter((id) => !removedIds.includes(id));
      });
    }

    if (this.data.cargoes.length !== initialCount) {
      this.save();
    }
  }

  // --- Batches (To'plamlar) CRUD & Stats Management ---

  getAllBatches(statusFilter = null) {
    if (!statusFilter) return this.data.batches || [];
    return (this.data.batches || []).filter((b) => b.status === statusFilter);
  }

  getBatchById(id) {
    return (this.data.batches || []).find((b) => b.id === id);
  }

  createBatch(title, cargoIds = [], targetGroupIds = []) {
    const safeGroups = (Array.isArray(targetGroupIds) ? targetGroupIds : [])
      .slice(0, config.MAX_BATCH_GROUPS)
      .map(String);
    const newBatch = {
      id: "batch_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: title || `To'plam #${(this.data.batches.length || 0) + 1}`,
      cargo_ids: cargoIds.slice(0, config.MAX_BATCH_CARGOES),
      target_group_ids: safeGroups, // To'plam yuboriladigan faqat tanlangan (max 15 ta) guruhlar
      status: "faol", // Yangi to'plam doim faol holatda yaratiladi
      completed_cycles: 0, // Bajarilgan sikllar soni (0 dan 5 gacha)
      sent_history: [], // Har bir guruhga yuborilganlik tarixi
      group_stats: {}, // Har bir guruh bo'yicha hisobot: { [groupId]: { title, count, last_cycle, last_variant, timestamp } }
      created_at: new Date().toISOString(),
      deactivated_at: null,
    };
    this.data.batches.push(newBatch);
    this.save();
    return newBatch;
  }

  /**
   * Yangi funksiya: To'plam holatini faol / nofaol ga o'tkazish
   */
  updateBatchStatus(batchId, newStatus) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;
    batch.status = newStatus;
    if (newStatus === "nofaol" && !batch.deactivated_at) {
      batch.deactivated_at = new Date().toISOString();
    } else if (newStatus === "faol") {
      batch.deactivated_at = null;
    }
    this.save();
    return batch;
  }

  /**
   * Yangi funksiya 1: To'plam qaysi guruhga yuborilganini, necha marta yuborilganini
   * hamda oxirgi yuborilgan xabarga havola / yo'nalishni yozib borish
   */
  recordBatchGroupDispatch(
    batchId,
    groupInfo,
    cycleNumber,
    variantIndex,
    messageMeta = {},
  ) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    if (!batch.sent_history) batch.sent_history = [];
    batch.sent_history.push({
      cycle: cycleNumber,
      group_id: groupInfo.id,
      group_title: groupInfo.title || "Group",
      variant: variantIndex,
      message_id: messageMeta.id || null,
      message_link: messageMeta.link || null,
      timestamp: new Date().toISOString(),
    });

    if (!batch.group_stats) batch.group_stats = {};
    const existing = batch.group_stats[groupInfo.id] || {
      title: groupInfo.title || "Group",
      count: 0,
    };

    batch.group_stats[groupInfo.id] = {
      title: groupInfo.title || existing.title,
      username: groupInfo.username || existing.username || null,
      count: existing.count + 1,
      last_cycle: cycleNumber,
      last_variant: variantIndex,
      last_message_id: messageMeta.id || existing.last_message_id || null,
      last_message_link: messageMeta.link || existing.last_message_link || null,
      timestamp: new Date().toISOString(),
    };

    this.save();
    return batch;
  }

  /**
   * Yangi funksiya 2: Bitta to'liq sikl yakunlanganda (barcha guruhlarga yuborilgach)
   * to'plamning completed_cycles sonini oshirish va 10 ta sikldan so'ng
   * to'plam holatini "faol"dan "nofaol"ga o'tkazish!
   */
  incrementBatchCompletedCycle(batchId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    batch.completed_cycles = (batch.completed_cycles || 0) + 1;

    // 10 ta sikl to'liq tugagach, to'plam holati faoldan nofaolga o'tadi
    if (batch.completed_cycles >= config.MAX_SENT_COUNT) {
      batch.status = "nofaol";
      batch.deactivated_at = new Date().toISOString();
    }

    this.save();
    return batch;
  }

  /**
   * Berilgan guruhga oxirgi yuborilgan variant raqami (takrorlanmasligi uchun)
   */
  getBatchLastVariantForGroup(batchId, groupId) {
    const batch = this.getBatchById(batchId);
    if (!batch || !batch.group_stats || !batch.group_stats[groupId]) {
      return null;
    }
    return batch.group_stats[groupId].last_variant || null;
  }

  getBatchWithCargoes(batchId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    const cargoes = (batch.cargo_ids || [])
      .map((id) => this.getCargoById(id))
      .filter((c) => c !== undefined && c !== null);

    return {
      batch,
      cargoes,
    };
  }

  addCargoToBatch(batchId, cargoId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    if (!batch.cargo_ids.includes(cargoId)) {
      if (batch.cargo_ids.length >= config.MAX_BATCH_CARGOES) {
        throw new Error(
          `To'plamga eng ko'pi bilan ${config.MAX_BATCH_CARGOES} ta e'lon qo'shish mumkin.`,
        );
      }
      batch.cargo_ids.push(cargoId);
      this.save();
    }
    return batch;
  }

  removeCargoFromBatch(batchId, cargoId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;

    batch.cargo_ids = batch.cargo_ids.filter((id) => id !== cargoId);
    this.save();
    return batch;
  }

  deleteBatch(batchId) {
    const index = this.data.batches.findIndex((b) => b.id === batchId);
    if (index !== -1) {
      const removed = this.data.batches.splice(index, 1);
      this.save();
      return removed[0];
    }
    return null;
  }

  // --- Batch Target Groups Management ---

  getBatchTargetGroups(batchId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return [];
    return batch.target_group_ids || [];
  }

  setBatchTargetGroups(batchId, groupIds) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;
    batch.target_group_ids = (Array.isArray(groupIds) ? groupIds : [])
      .slice(0, config.MAX_BATCH_GROUPS)
      .map(String);
    this.save();
    return batch;
  }

  toggleBatchTargetGroup(batchId, groupId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;
    if (!batch.target_group_ids) batch.target_group_ids = [];

    const strGroupId = String(groupId);
    const idx = batch.target_group_ids.findIndex((id) => String(id) === strGroupId);
    if (idx !== -1) {
      batch.target_group_ids.splice(idx, 1);
      this.save();
      return { success: true, action: "removed", count: batch.target_group_ids.length };
    } else {
      if (batch.target_group_ids.length >= config.MAX_BATCH_GROUPS) {
        return { success: false, reason: "limit_reached", count: batch.target_group_ids.length };
      }
      batch.target_group_ids.push(strGroupId);
      this.save();
      return { success: true, action: "added", count: batch.target_group_ids.length };
    }
  }

  selectAllGroupsForBatch(batchId, allGroupIds) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;
    batch.target_group_ids = (allGroupIds || [])
      .slice(0, config.MAX_BATCH_GROUPS)
      .map((id) => String(id));
    this.save();
    return batch;
  }

  clearBatchTargetGroups(batchId) {
    const batch = this.getBatchById(batchId);
    if (!batch) return null;
    batch.target_group_ids = [];
    this.save();
    return batch;
  }

  // --- Target Groups Management ---

  setTargetGroups(groups) {
    this.data.target_groups = groups;
    this.save();
  }

  getTargetGroups() {
    return this.data.target_groups || [];
  }

  // --- Bot Run Settings ---

  getBotSettings() {
    return this.data.bot_settings;
  }

  updateBotSettings(fields) {
    Object.assign(this.data.bot_settings, fields);
    this.save();
    return this.data.bot_settings;
  }
}

module.exports = new Database();
