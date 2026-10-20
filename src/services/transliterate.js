/**
 * Transliterates Latin alphabet text to Cyrillic alphabet (Uzbek / Russian rules).
 * @param {string} text - Input text in Latin or Cyrillic
 * @returns {string} Transliterated Cyrillic text
 */
function toCyrillic(text) {
  if (!text || typeof text !== 'string') return '';

  let str = text;

  // Specific common logistics place names & words
  const wordOverrides = [
    { lat: "Shymkent", cyr: "Шымкент" },
    { lat: "shymkent", cyr: "шымкент" },
    { lat: "Kazakhstan", cyr: "Казахстан" },
    { lat: "kazakhstan", cyr: "казахстан" },
    { lat: "Qozog'iston", cyr: "Қозоғистон" },
    { lat: "Qozog`iston", cyr: "Қозоғистон" },
    { lat: "Uzbekistan", cyr: "Узбекистан" },
    { lat: "uzbekistan", cyr: "узбекистан" },
    { lat: "O'zbekiston", cyr: "Ўзбекистон" },
    { lat: "O`zbekiston", cyr: "Ўзбекистон" },
    { lat: "Sirdaryo", cyr: "Сырдарья" },
    { lat: "sirdaryo", cyr: "сырдарья" },
    { lat: "Syrdarya", cyr: "Сырдарья" },
    { lat: "syrdarya", cyr: "сырдарья" },
    { lat: "Tashkent", cyr: "Ташкент" },
    { lat: "tashkent", cyr: "ташкент" },
    { lat: "Toshkent", cyr: "Тошкент" },
    { lat: "toshkent", cyr: "тошкент" },
    { lat: "Almaty", cyr: "Алматы" },
    { lat: "almaty", cyr: "алматы" }
  ];

  for (const item of wordOverrides) {
    str = str.split(item.lat).join(item.cyr);
  }

  // Multi-character replacements (case-sensitive order)
  const multiMap = [
    // Two-letter combinations with apostrophes / modifiers
    { lat: "o'", cyr: "ў" }, { lat: "O'", cyr: "Ў" },
    { lat: "o‘", cyr: "ў" }, { lat: "O‘", cyr: "Ў" },
    { lat: "o`", cyr: "ў" }, { lat: "O`", cyr: "Ў" },
    { lat: "g'", cyr: "ғ" }, { lat: "G'", cyr: "Ғ" },
    { lat: "g‘", cyr: "ғ" }, { lat: "G‘", cyr: "Ғ" },
    { lat: "g`", cyr: "ғ" }, { lat: "G`", cyr: "Ғ" },

    // Double character letter combinations
    { lat: "SH", cyr: "Ш" }, { lat: "Sh", cyr: "Ш" }, { lat: "sh", cyr: "ш" },
    { lat: "CH", cyr: "Ч" }, { lat: "Ch", cyr: "Ч" }, { lat: "ch", cyr: "ч" },
    { lat: "YO", cyr: "Ё" }, { lat: "Yo", cyr: "Ё" }, { lat: "yo", cyr: "ё" },
    { lat: "YU", cyr: "Ю" }, { lat: "Yu", cyr: "Ю" }, { lat: "yu", cyr: "ю" },
    { lat: "YA", cyr: "Я" }, { lat: "Ya", cyr: "Я" }, { lat: "ya", cyr: "я" },
    { lat: "YE", cyr: "Е" }, { lat: "Ye", cyr: "Е" }, { lat: "ye", cyr: "е" },
    { lat: "TS", cyr: "Ц" }, { lat: "Ts", cyr: "Ц" }, { lat: "ts", cyr: "ц" },
    { lat: "ZH", cyr: "Ж" }, { lat: "Zh", cyr: "Ж" }, { lat: "zh", cyr: "ж" },

    // Consonant + y -> Consonant + и
    { lat: "by", cyr: "би" }, { lat: "vy", cyr: "ви" }, { lat: "gy", cyr: "ги" },
    { lat: "dy", cyr: "ди" }, { lat: "zy", cyr: "зи" }, { lat: "ky", cyr: "ки" },
    { lat: "ly", cyr: "ли" }, { lat: "my", cyr: "ми" }, { lat: "ny", cyr: "ни" },
    { lat: "py", cyr: "пи" }, { lat: "ry", cyr: "ри" }, { lat: "sy", cyr: "си" },
    { lat: "ty", cyr: "ти" }, { lat: "fy", cyr: "фи" }, { lat: "hy", cyr: "хи" }
  ];

  for (const item of multiMap) {
    str = str.split(item.lat).join(item.cyr);
  }

  // Single letter map
  const singleMap = {
    'a': 'а', 'A': 'А',
    'b': 'б', 'B': 'Б',
    'v': 'в', 'V': 'В',
    'g': 'г', 'G': 'Г',
    'd': 'д', 'D': 'Д',
    'e': 'е', 'E': 'Е',
    'z': 'з', 'Z': 'З',
    'i': 'и', 'I': 'И',
    'j': 'ж', 'J': 'Ж',
    'k': 'к', 'K': 'К',
    'l': 'л', 'L': 'Л',
    'm': 'м', 'M': 'М',
    'n': 'н', 'N': 'Н',
    'o': 'о', 'O': 'О',
    'p': 'п', 'P': 'П',
    'r': 'р', 'R': 'Р',
    's': 'с', 'S': 'С',
    't': 'т', 'T': 'Т',
    'u': 'у', 'U': 'У',
    'f': 'ф', 'F': 'Ф',
    'x': 'х', 'X': 'Х',
    'y': 'й', 'Y': 'Й',
    'q': 'қ', 'Q': 'Қ',
    'h': 'ҳ', 'H': 'Ҳ',
    'c': 'с', 'C': 'С'
  };

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    result += singleMap[ch] !== undefined ? singleMap[ch] : ch;
  }

  return result;
}

module.exports = {
  toCyrillic
};
