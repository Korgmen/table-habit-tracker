/**
 * Поиск эмодзи по словам и подсказки по названию привычки.
 * Данные – список [символ, группа, строка поиска] из virtual:emoji/<язык> (см. vite.config.js).
 */

/** Нижний регистр без диакритики: «ё» совпадает с «е», «canción» – с «cancion» */
const normalize = text =>
  text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

/** Слова строки без знаков препинания */
const toWords = text =>
  normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const hasHan = text => /\p{Script=Han}/u.test(text);

/** Эмодзи, введённые в строку поиска как есть (можно выбрать любой, даже без слов) */
export const emojiInText = text =>
  [...new Intl.Segmenter().segment(text.trim())]
    .map(part => part.segment)
    .filter(segment => /\p{Extended_Pictographic}/u.test(segment));

/** Индекс для поиска: { emoji, group, words, text, order } */
export const buildEmojiIndex = list =>
  list.map(([emoji, group, text], order) => ({
    emoji,
    group,
    text: normalize(text),
    words: toWords(text),
    order,
  }));

/**
 * Совпадение слова запроса со словами эмодзи: 3 – слово целиком, 2 – начало слова,
 * 1 – слово эмодзи является началом слова запроса («бегать» и «бег»).
 */
const wordScore = (query, words) => {
  let best = 0;
  for (const word of words) {
    if (word === query) return 3;
    if (word.startsWith(query)) best = Math.max(best, 2);
    else if (word.length >= 3 && query.startsWith(word)) best = Math.max(best, 1);
  }
  return best;
};

const ranked = (scored, limit) =>
  scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
    .slice(0, limit)
    .map(item => item.entry.emoji);

/**
 * Поиск по строке: каждое слово запроса должно совпасть с каким-то словом эмодзи.
 * Китайский текст без пробелов ищется вхождением подстроки.
 */
export const searchEmoji = (index, query, limit = 120) => {
  const text = normalize(query.trim());
  if (!text) return [];
  if (hasHan(text)) {
    return ranked(
      index.map(entry => ({ entry, score: entry.text.includes(text) ? 1 : 0 })),
      limit
    );
  }
  const words = toWords(text);
  if (words.length === 0) return [];
  return ranked(
    index.map(entry => {
      const scores = words.map(word => wordScore(word, entry.words));
      return {
        entry,
        score: scores.every(score => score > 0) ? scores.reduce((a, b) => a + b) : 0,
      };
    }),
    limit
  );
};

/** Основа слова: окончание срезается на 2 буквы у длинных слов и на 1 у слов из 4–5 букв */
const stemOf = word =>
  word.length >= 6 ? word.slice(0, -2) : word.length >= 4 ? word.slice(0, -1) : word;

/**
 * Совпадение слова названия со словами эмодзи для подсказок: 3 – целиком, 2 – начало слова,
 * 1 – по основе («воду» → «вода») или слово эмодзи от 4 букв – начало слова («read» в «reading»).
 * Короткие слова эмодзи не совпадают по основе: «early» не находит «ear».
 */
const titleWordScore = (word, words) => {
  const stem = stemOf(word);
  let best = 0;
  for (const candidate of words) {
    if (candidate === word) return 3;
    if (candidate.startsWith(word)) best = Math.max(best, 2);
    else if (stem !== word && candidate.startsWith(stem) && candidate.length > stem.length) {
      best = Math.max(best, 1);
    } else if (candidate.length >= 4 && word.startsWith(candidate)) best = Math.max(best, 1);
  }
  return best;
};

/** Основа эмодзи без вариантов пола, направления и тона: 🏃‍♀️ и 🏃‍➡️ дают 🏃 */
const baseOf = emoji => emoji.split('\u200D')[0].replace(/\uFE0F/g, '');

/**
 * Подсказки по названию привычки: подходит любое слово названия длиной от 3 букв,
 * у каждого эмодзи показывается один вариант. В китайском названии ищутся пары соседних
 * иероглифов.
 */
export const suggestEmoji = (index, title, limit = 8) => {
  const text = normalize(title.trim());
  if (!text) return [];
  let scored;
  if (hasHan(text)) {
    const chars = [...text].filter(char => hasHan(char));
    const pairs = chars.length > 1 ? chars.slice(1).map((char, i) => chars[i] + char) : chars;
    scored = index.map(entry => ({
      entry,
      score: pairs.filter(pair => entry.text.includes(pair)).length,
    }));
  } else {
    const words = toWords(text).filter(word => word.length >= 3);
    if (words.length === 0) return [];
    scored = index.map(entry => ({
      entry,
      score: words.reduce((sum, word) => sum + titleWordScore(word, entry.words), 0),
    }));
  }
  const seen = new Set();
  return ranked(scored, Infinity)
    .filter(emoji => {
      const base = baseOf(emoji);
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .slice(0, limit);
};
