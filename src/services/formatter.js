const { toCyrillic } = require("./transliterate");

// 4-bo'limda to'liq berilgan 10 ta rasmiy matn varianti
const DEFAULT_CARGO_VARIANTS = [
  // 1-variant: qisqa, emojilar bilan
  `📍Алматы, Казахстан 🇰🇿 ➡️ Ташкент, Узбекистан 🇺🇿
📏 808 км
📦 Груз: напитки
⚖️ 20т / 86м3
🚛 Авто: 1 тент (зад)
📅 Погрузка: завтра
💰 Аванс есть
💳 Оплата безналичная
☎️ +998940046475`,

  // 2-variant: rasmiy uslub
  `Направление: Алматы (Казахстан) — Ташкент (Узбекистан)
Расстояние: 808 км
Груз: напитки
Вес/объём: 20 тонн, 86 м3
Требуемый транспорт: 1 тентованная машина, загрузка сзади
Дата погрузки: завтра
Условия: аванс имеется, оплата безналичная
Контакт: +998940046475`,

  // 3-variant: shoshilinch format
  `🔥 ЕСТЬ ГРУЗ! 🔥
Алматы (KZ) → Ташкент (UZ) | 808 км
📦 Груз: напитки
⚖️ 20т / 86м3
🚛 1 тент (зад)
📅 Погрузка — ЗАВТРА
💰 Аванс есть, оплата безнал
📞 +998940046475`,

  // 4-variant: heshteglar va ro'yxat bilan
  `#груз #тент #напитки #Алматы #Ташкент #Казахстан
━━━━━━━━━━
📍 Откуда: Алматы, KZ
📍 Куда: Ташкент, UZ
📏 Расстояние: 808 км
📦 Груз: напитки
⚖️ Вес/объём: 20т / 86м3
🚛 Авто: 1 тент (зад)
📅 Погрузка: завтра
💰 Аванс: есть
💳 Оплата: безналичная
☎️ +998940046475`,

  // 5-variant: minimal, bir qatorli
  `🚛 Алматы → Ташкент | 808 км | напитки | 20т/86м3 | тент (зад) | погрузка завтра | аванс есть, безнал | ☎️ +998940046475`,

  // 6-variant: Telegram uslubi, qalin shrift bilan
  `🚚 ГРУЗ: АЛМАТЫ ➡️ ТАШКЕНТ

Груз: напитки
Вес/объём: 20 т / 86 м3
Машина: тент, задняя загрузка (1 шт.)
Погрузка: завтра
Расстояние: 808 км
Оплата: безнал + аванс есть

📞 +998940046475`,

  // 7-variant: do'stona, "ish bor" uslubi
  `Здравствуйте! Есть заказ на перевозку.
Маршрут: Алматы (KZ) — Ташкент (UZ), 808 км.
Груз — напитки, 20 тонн, 86 кубов. Нужен 1 тент с задней загрузкой.
Погрузка завтра. Аванс выплачивается, расчёт безналичный.
Звоните: +998940046475`,

  // 8-variant: jadval ko'rinishida
  `📋 Параметр | 📌 Данные
Маршрут | Алматы 🇰🇿 → Ташкент 🇺🇿
Расстояние | 808 км
Груз | напитки
Вес / объём | 20т / 86м3
Транспорт | 1 тент (зад)
Погрузка | завтра
Оплата | безнал, аванс есть
Контакт | +998940046475`,

  // 9-variant: haydovchilarga murojaat
  `👋 Водители, внимание!
Нужен тент на рейс Алматы ➡️ Ташкент 🚛
📦 Напитки, 20т / 86м3
📏 808 км
📅 Загрузка завтра, задняя
💰 Аванс сразу, безнал
Пишите/звоните: ☎️ +998940046475`,

  // 10-variant: o'zbek tilida (kirill yozuvida)
  `🇰🇿 Алматы ➡️ Тошкент 🇺🇿
📏 Масофа: 808 км
📦 Юк: ичимликлар
⚖️ 20 тонна / 86 м3
🚛 Машина: 1 та тент (орқадан юклаш)
📅 Юклаш: эртага
💰 Аванс бор, тўлов банк орқали (безнал)
☎️ +998940046475`
];

/**
 * Helper to extract simple city name without emojis and country suffixes
 */
function extractCity(str) {
  if (!str) return "";
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .split(/[,(]/)[0]
    .trim();
}

/**
 * Helper to format city with country code (e.g. "Алматы, KZ" or "Алматы (Казахстан)")
 */
function formatCityWithCountry(str, format = "code") {
  if (!str) return "";
  const city = extractCity(str);
  const lower = str.toLowerCase();
  let countryCode = "";
  let countryName = "";

  if (lower.includes("казах") || lower.includes("kz") || str.includes("🇰🇿")) {
    countryCode = "KZ";
    countryName = "Казахстан";
  } else if (
    lower.includes("узбек") ||
    lower.includes("uz") ||
    str.includes("🇺🇿")
  ) {
    countryCode = "UZ";
    countryName = "Узбекистан";
  } else if (
    lower.includes("росс") ||
    lower.includes("ru") ||
    str.includes("🇷🇺")
  ) {
    countryCode = "RU";
    countryName = "Россия";
  }

  if (format === "paren") {
    return countryName ? `${city} (${countryName})` : city;
  }
  if (format === "parenCode") {
    return countryCode ? `${city} (${countryCode})` : city;
  }
  if (format === "commaCode") {
    return countryCode ? `${city}, ${countryCode}` : city;
  }
  return city;
}

/**
 * Checks if cargo is the default Almaty-Tashkent cargo
 */
function isDefaultCargo(cargo) {
  if (!cargo) return true;
  const from = (cargo.from || "").toLowerCase();
  const to = (cargo.to || "").toLowerCase();
  return (
    (from.includes("алмат") || from.includes("almat")) &&
    (to.includes("ташкент") || to.includes("тошкент") || to.includes("tashkent"))
  );
}

/**
 * Formats a single cargo announcement into one of the 10 variants.
/**
 * Helper to format contact line according to variant style and whether contact is phone or username
 */
function formatContactLine(contact, variant) {
  const isOnlyUsername = !/\d{5,}/.test(contact);

  if (isOnlyUsername) {
    switch (variant) {
      case 1:
      case 4:
      case 10:
        return `✈️ Telegram: ${contact}`;
      case 2:
        return `Контакт (Telegram): ${contact}`;
      case 3:
      case 6:
        return `💬 Telegram: ${contact}`;
      case 5:
        return `✈️ Telegram: ${contact}`;
      case 7:
        return `Пишите в Telegram: ${contact}`;
      case 8:
        return `Telegram | ${contact}`;
      case 9:
        return `Пишите: ✈️ ${contact}`;
      default:
        return `💬 Telegram: ${contact}`;
    }
  }

  // If contains phone number (or phone + username)
  switch (variant) {
    case 1:
    case 4:
    case 5:
    case 10:
      return `☎️ ${contact}`;
    case 2:
      return `Контакт: ${contact}`;
    case 3:
    case 6:
      return `📞 ${contact}`;
    case 7:
      return `Звоните/пишите: ${contact}`;
    case 8:
      return `Контакт | ${contact}`;
    case 9:
      return `Пишите/звоните: ☎️ ${contact}`;
    default:
      return `☎️ ${contact}`;
  }
}

/**
 * Formats a single cargo announcement into one of the 10 variants.
 * If cargo is empty/null, returns exact text from default variants.
 * Otherwise dynamically adapts to the 10 styles preserving all data and custom contacts.
 *
 * @param {Object} cargo - Cargo data object
 * @param {number} variantIndex - 1 to 10 template variant
 * @returns {string} Formatted text
 */
function formatSingleCargo(cargo, variantIndex = 1) {
  const v = ((((variantIndex - 1) % 10) + 10) % 10) + 1; // 1-indexed (1 to 10)

  // If cargo is null/undefined, return exact variant text from default variants
  if (!cargo) {
    return DEFAULT_CARGO_VARIANTS[v - 1];
  }

  const from = toCyrillic(cargo.from || "Алматы, Казахстан 🇰🇿");
  const to = toCyrillic(cargo.to || "Ташкент, Узбекистан 🇺🇿");
  const distance = toCyrillic(cargo.distance || "808 км");
  const cargoName = toCyrillic(cargo.cargo || "напитки");
  const weightVolume = toCyrillic(cargo.weight_volume || "20т / 86м3");
  const transport = toCyrillic(cargo.transport || "1 тент (зад)");
  const loading = toCyrillic(cargo.cargo_status || cargo.loading_date || "завтра");
  const advance = toCyrillic(cargo.advance || "Аванс есть");
  const payment = toCyrillic(cargo.payment || "безналичная");

  let rawContact = (cargo.contact || "").trim();
  if (!rawContact) {
    rawContact = "+998940046475";
  } else if (
    !rawContact.startsWith("@") &&
    !rawContact.startsWith("+") &&
    !/^\d/.test(rawContact) &&
    !rawContact.includes("t.me")
  ) {
    rawContact = "@" + rawContact;
  }
  const contact = rawContact;

  const cityFrom = extractCity(from);
  const cityTo = extractCity(to);

  switch (v) {
    case 1:
      return `📍${from} ➡️ ${to}
📏 ${distance}
📦 Груз: ${cargoName}
⚖️ ${weightVolume}
🚛 Авто: ${transport}
📅 Погрузка: ${loading}
💰 ${advance}
💳 Оплата ${payment}
${formatContactLine(contact, 1)}`;

    case 2:
      return `Направление: ${formatCityWithCountry(from, "paren")} — ${formatCityWithCountry(to, "paren")}
Расстояние: ${distance}
Груз: ${cargoName}
Вес/объём: ${weightVolume}
Требуемый транспорт: ${transport}
Дата погрузки: ${loading}
Условия: ${advance}, оплата ${payment}
${formatContactLine(contact, 2)}`;

    case 3:
      return `🔥 ЕСТЬ ГРУЗ! 🔥
${formatCityWithCountry(from, "parenCode")} → ${formatCityWithCountry(to, "parenCode")} | ${distance}
📦 Груз: ${cargoName}
⚖️ ${weightVolume}
🚛 ${transport}
📅 Погрузка — ${loading.toUpperCase()}
💰 ${advance}, оплата ${payment}
${formatContactLine(contact, 3)}`;

    case 4:
      return `#груз #тент #${cargoName.split(/[\s,]+/)[0]} #${cityFrom} #${cityTo}
━━━━━━━━━━
📍 Откуда: ${formatCityWithCountry(from, "commaCode")}
📍 Куда: ${formatCityWithCountry(to, "commaCode")}
📏 Расстояние: ${distance}
📦 Груз: ${cargoName}
⚖️ Вес/объём: ${weightVolume}
🚛 Авто: ${transport}
📅 Погрузка: ${loading}
💰 Аванс: ${advance}
💳 Оплата: ${payment}
${formatContactLine(contact, 4)}`;

    case 5:
      return `🚛 ${cityFrom} → ${cityTo} | ${distance} | ${cargoName} | ${weightVolume} | ${transport} | погрузка ${loading} | ${advance}, ${payment} | ${formatContactLine(contact, 5)}`;

    case 6:
      return `🚚 ГРУЗ: ${cityFrom.toUpperCase()} ➡️ ${cityTo.toUpperCase()}

Груз: ${cargoName}
Вес/объём: ${weightVolume}
Машина: ${transport}
Погрузка: ${loading}
Расстояние: ${distance}
Оплата: ${payment} + ${advance}

${formatContactLine(contact, 6)}`;

    case 7:
      return `Здравствуйте! Есть заказ на перевозку.
Маршрут: ${formatCityWithCountry(from, "parenCode")} — ${formatCityWithCountry(to, "parenCode")}, ${distance}.
Груз — ${cargoName}, ${weightVolume}. Нужен ${transport}.
Погрузка ${loading}. ${advance}, расчёт ${payment}.
${formatContactLine(contact, 7)}`;

    case 8:
      return `📋 Параметр | 📌 Данные
Маршрут | ${from} → ${to}
Расстояние | ${distance}
Груз | ${cargoName}
Вес / объём | ${weightVolume}
Транспорт | ${transport}
Погрузка | ${loading}
Оплата | ${payment}, ${advance}
${formatContactLine(contact, 8)}`;

    case 9:
      return `👋 Водители, внимание!
Нужен ${transport} на рейс ${cityFrom} ➡️ ${cityTo} 🚛
📦 ${cargoName}, ${weightVolume}
📏 ${distance}
📅 Загрузка ${loading}
💰 ${advance}, ${payment}
${formatContactLine(contact, 9)}`;

    case 10:
    default:
      return `🇰🇿 ${cityFrom} ➡️ ${cityTo} 🇺🇿
📏 Масофа: ${distance}
📦 Юк: ${cargoName}
⚖️ ${weightVolume}
🚛 Машина: ${transport}
📅 Юклаш: ${loading}
💰 ${advance}, тўлов ${payment}
${formatContactLine(contact, 10)}`;
  }
}

/**
 * Formats a batch of cargo announcements into a single message text.
 * When a batch has multiple cargo items, they are formatted and joined.
 *
 * @param {Array} cargoList - Array of cargo objects
 * @param {number} variantIndex - 1 to 10 template variant
 * @returns {string} Formatted batch text
 */
function formatBatchMessage(cargoList, variantIndex = 1) {
  if (!cargoList || cargoList.length === 0) return "";

  // If batch contains only 1 cargo item (common case)
  if (cargoList.length === 1) {
    return formatSingleCargo(cargoList[0], variantIndex);
  }

  // If batch contains multiple cargo items, format each
  const formattedItems = cargoList.map((cargo, idx) => {
    // Keep variant consistent or offset slightly per cargo in batch
    const itemVariant = ((((variantIndex - 1 + idx) % 10) + 10) % 10) + 1;
    return formatSingleCargo(cargo, itemVariant);
  });

  return formattedItems.join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");
}

module.exports = {
  DEFAULT_CARGO_VARIANTS,
  formatSingleCargo,
  formatBatchMessage,
};
