/**
 * Геометрия печатного бланка (A4, книжная, единицы в мм) и содержимое его QR-кода.
 * Один источник координат и для отрисовки бланка, и для распознавания фото.
 */

export const PAGE_WIDTH = 210;
export const PAGE_HEIGHT = 297;

/** Маркеры ArUco (словарь ARUCO_MIP_36h12): чёрная рамка и 6×6 бит, '1' – белая клетка */
export const MARKER_SIZE = 10;
export const MARKER_CELL = MARKER_SIZE / 8;
export const MARKERS = [
  { id: 0, x: 10, y: 10, bits: '110100101011011000111010000010011101' },
  { id: 1, x: 190, y: 10, bits: '011000000000000100010011010011100101' },
  { id: 2, x: 190, y: 277, bits: '000100100000011011111011111001110010' },
  { id: 3, x: 10, y: 277, bits: '111111111000101011010110110010110100' },
];

/**
 * Места под части QR высотой с маркер, справа налево от правого верхнего маркера.
 * Содержимое делится на части, чтобы модули оставались крупными (QR версии 2, модуль 0,4 мм).
 */
export const QR_SIZE = MARKER_SIZE;
export const QR_SLOTS = [
  { x: 176, y: 10 },
  { x: 163, y: 10 },
];
/** Символов данных в одной части: ёмкость QR версии 2 (уровень M) минус номер части и их число */
const QR_CHUNK = 36;

/** Плашка с месяцем рядом с левым верхним маркером, той же высоты */
export const MONTH_BOX = { x: 24, y: 10, width: 60, height: MARKER_SIZE };

/** Таблица */
export const TABLE = { x: 10, width: 190, top: 26, bottom: 273, border: 0.8 };
export const COLUMN_PITCH = 5.6;
export const CIRCLE_RADIUS = 1.6;
export const CIRCLE_STROKE = 0.4;
export const DAY_FONT = 3.2;
export const TITLE_FONT = 3.6;

/** Вертикальные отступы блоков */
const HEADER_PAD = 4;
const TASK_PAD_TOP = 2.4;
const TITLE_LINE = 5;
const TITLE_GAP = 1.6;
const NUMBERS_GAP = 1.2;
const ROW_PITCH = 4.2;
const TASK_PAD_BOTTOM = 3;

/** Высота шапки с номерами дней и общими кружками */
export const HEADER_HEIGHT = HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS * 2 + HEADER_PAD;

/** Высота блока задачи с заданным числом подзадач */
export const taskBlockHeight = subtasks =>
  TASK_PAD_TOP +
  TITLE_LINE +
  TITLE_GAP +
  DAY_FONT +
  NUMBERS_GAP +
  CIRCLE_RADIUS * 2 +
  (subtasks - 1) * ROW_PITCH +
  TASK_PAD_BOTTOM;

/** Центр кружка дня по горизонтали */
export const columnX = (days, dayIndex) =>
  TABLE.x + (TABLE.width - days * COLUMN_PITCH) / 2 + COLUMN_PITCH * (dayIndex + 0.5);

/** Разбивает задачи по страницам: возвращает массивы индексов задач */
export const paginate = subtaskCounts => {
  const capacity = TABLE.bottom - TABLE.top - HEADER_HEIGHT;
  const pages = [];
  let current = [];
  let used = 0;
  subtaskCounts.forEach((count, index) => {
    const height = taskBlockHeight(count);
    if (current.length > 0 && used + height > capacity) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += height;
  });
  if (current.length > 0) pages.push(current);
  return pages;
};

/**
 * Раскладка страницы: шапка таблицы и блоки задач с координатами строк кружков.
 * Зависит только от числа дней и числа подзадач, поэтому восстанавливается из QR.
 */
export const pageLayout = (days, subtaskCounts) => {
  const header = {
    top: TABLE.top,
    height: HEADER_HEIGHT,
    numbersY: TABLE.top + HEADER_PAD + DAY_FONT,
    circlesY: TABLE.top + HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS,
  };

  let top = TABLE.top + HEADER_HEIGHT;
  const blocks = subtaskCounts.map(count => {
    const numbersY = top + TASK_PAD_TOP + TITLE_LINE + TITLE_GAP + DAY_FONT;
    const firstRowY = numbersY + NUMBERS_GAP + CIRCLE_RADIUS;
    const block = {
      top,
      height: taskBlockHeight(count),
      titleY: top + TASK_PAD_TOP + TITLE_LINE * 0.75,
      numbersY,
      rowsY: Array.from({ length: count }, (_, row) => firstRowY + row * ROW_PITCH),
    };
    top += block.height;
    return block;
  });

  return {
    header,
    blocks,
    bottom: top,
    columnsX: Array.from({ length: days }, (_, dayIndex) => columnX(days, dayIndex)),
  };
};

/** Короткий хэш id задачи (FNV-1a, 3 символа base36): связывает строку бланка с задачей */
export const taskHash = id => {
  let hash = 0x811c9dc5;
  for (const char of String(id)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(3, '0').slice(-3);
};

/**
 * Содержимое QR: `T2` + ГГММ + страница + всего страниц + по задаче ХЭШn (n – число подзадач).
 * Только символы алфавитно-цифрового режима QR. Возвращает части для QR_SLOTS,
 * каждая начинается с номера части и их числа.
 */
export const encodePayload = ({ month, page, pages, tasks }) => {
  const text = (
    `T2${month.slice(2, 4)}${month.slice(5, 7)}${page.toString(36)}${pages.toString(36)}` +
    tasks.map(task => `${task.hash}${task.subtasks}`).join('')
  ).toUpperCase();
  const count = Math.ceil(text.length / QR_CHUNK);
  return Array.from(
    { length: count },
    (_, i) => `${i}${count}${text.slice(i * QR_CHUNK, (i + 1) * QR_CHUNK)}`
  );
};

/** Собирает содержимое из прочитанных частей QR; для неполного, чужого или повреждённого – null */
export const decodePayload = chunks => {
  const parts = [];
  for (const chunk of chunks) {
    const match = /^(\d)(\d)([0-9A-Z]+)$/.exec(chunk);
    if (!match) return null;
    parts[Number(match[1])] = { count: Number(match[2]), text: match[3] };
  }
  const count = parts[0]?.count;
  if (!count || parts.length !== count || parts.some(part => !part || part.count !== count)) {
    return null;
  }
  const match = /^T2(\d{2})(0[1-9]|1[0-2])([1-9A-Z])([1-9A-Z])((?:[0-9A-Z]{3}[1-8])+)$/.exec(
    parts.map(part => part.text).join('')
  );
  if (!match) return null;
  return {
    month: `20${match[1]}-${match[2]}`,
    page: parseInt(match[3], 36),
    pages: parseInt(match[4], 36),
    tasks: match[5].match(/.{4}/g).map(item => ({
      hash: item.slice(0, 3),
      subtasks: Number(item[3]),
    })),
  };
};

/** Число дней в месяце 'YYYY-MM' */
export const daysInMonthKey = key => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};
