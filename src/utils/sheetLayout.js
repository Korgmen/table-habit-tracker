/**
 * Геометрия печатных бланков (A4, единицы в мм) и содержимое их QR-кода.
 * Один источник координат и для отрисовки бланка, и для распознавания фото.
 *
 * Форматов два, их различают по номерам маркеров ArUco ещё до чтения QR:
 * альбомный T3 печатается сейчас, книжный T2 остаётся для распознавания уже распечатанных бланков.
 */

/** Маркеры ArUco (словарь ARUCO_MIP_36h12): чёрная рамка и 6×6 бит, '1' – белая клетка */
export const MARKER_SIZE = 10;
export const MARKER_CELL = MARKER_SIZE / 8;

/**
 * Части QR высотой с маркер. Содержимое делится на части,
 * чтобы модули оставались крупными (QR версии 2, модуль 0,4 мм).
 */
export const QR_SIZE = MARKER_SIZE;
/** Символов данных в одной части: ёмкость QR версии 2 (уровень M) минус номер части и их число */
const QR_CHUNK = 36;
/** Символов в начале содержимого: `T` + версия + ГГММ + страница + всего страниц */
const PAYLOAD_HEAD = 8;
/** Символов на задачу: хэш из 3 символов и число подзадач */
const PAYLOAD_TASK = 4;

export const COLUMN_PITCH = 5.6;
export const ROW_PITCH = 4.2;
export const CIRCLE_RADIUS = 1.6;
export const CIRCLE_STROKE = 0.4;
export const DAY_FONT = 3.2;
export const TITLE_FONT = 3.6;
const NUMBERS_GAP = 1.2;

/** Разбивает задачи по страницам с учётом высоты таблицы и ёмкости QR: массивы индексов задач */
const paginateBy = (capacity, blockHeight, maxTasks) => subtaskCounts => {
  const pages = [];
  let current = [];
  let used = 0;
  subtaskCounts.forEach((count, index) => {
    const height = blockHeight(count);
    if (current.length > 0 && (used + height > capacity || current.length >= maxTasks)) {
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

const maxTasksFor = qrSlots =>
  Math.floor((qrSlots.length * QR_CHUNK - PAYLOAD_HEAD) / PAYLOAD_TASK);

/**
 * Книжный бланк T2: название задачи над строкой кружков, номера дней в каждом блоке.
 * Не печатается, раскладку менять нельзя: по ней читаются уже распечатанные бланки.
 */
const portrait = (() => {
  const table = { x: 10, width: 190, top: 26, bottom: 273, border: 0.8 };
  const qrSlots = [
    { x: 176, y: 10 },
    { x: 163, y: 10 },
  ];
  const HEADER_PAD = 4;
  const TASK_PAD_TOP = 2.4;
  const TITLE_LINE = 5;
  const TITLE_GAP = 1.6;
  const TASK_PAD_BOTTOM = 3;
  const headerHeight = HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS * 2 + HEADER_PAD;
  const blockHeight = subtasks =>
    TASK_PAD_TOP +
    TITLE_LINE +
    TITLE_GAP +
    DAY_FONT +
    NUMBERS_GAP +
    CIRCLE_RADIUS * 2 +
    (subtasks - 1) * ROW_PITCH +
    TASK_PAD_BOTTOM;
  const columnX = (days, dayIndex) =>
    table.x + (table.width - days * COLUMN_PITCH) / 2 + COLUMN_PITCH * (dayIndex + 0.5);

  return {
    version: 2,
    width: 210,
    height: 297,
    blockLine: table.border,
    markers: [
      { id: 0, x: 10, y: 10, bits: '110100101011011000111010000010011101' },
      { id: 1, x: 190, y: 10, bits: '011000000000000100010011010011100101' },
      { id: 2, x: 190, y: 277, bits: '000100100000011011111011111001110010' },
      { id: 3, x: 10, y: 277, bits: '111111111000101011010110110010110100' },
    ],
    qrSlots,
    table,
    paginate: paginateBy(
      table.bottom - table.top - headerHeight,
      blockHeight,
      maxTasksFor(qrSlots)
    ),
    /** Раскладка страницы; зависит только от числа дней и подзадач, поэтому восстанавливается из QR */
    layout: (days, subtaskCounts) => {
      const header = {
        top: table.top,
        numbersY: table.top + HEADER_PAD + DAY_FONT,
        circlesY: table.top + HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS,
      };
      let top = table.top + headerHeight;
      const blocks = subtaskCounts.map(count => {
        const numbersY = top + TASK_PAD_TOP + TITLE_LINE + TITLE_GAP + DAY_FONT;
        const firstRowY = numbersY + NUMBERS_GAP + CIRCLE_RADIUS;
        const block = {
          top,
          titleY: top + TASK_PAD_TOP + TITLE_LINE * 0.75,
          numbersY,
          rowsY: Array.from({ length: count }, (_, row) => firstRowY + row * ROW_PITCH),
        };
        top += blockHeight(count);
        return block;
      });
      return {
        header,
        blocks,
        bottom: top,
        columnsX: Array.from({ length: days }, (_, dayIndex) => columnX(days, dayIndex)),
      };
    },
  };
})();

/**
 * Альбомный бланк T3: колонка названий слева, дни справа, номера дней только в шапке.
 * Изменение раскладки ломает чтение уже распечатанных бланков: новый вид – только новой версией.
 */
const landscape = (() => {
  const table = { x: 10, width: 277, top: 26, bottom: 186, border: 0.8 };
  const qrSlots = [
    { x: 263, y: 10 },
    { x: 250, y: 10 },
    { x: 237, y: 10 },
  ];
  /** Ширина колонки названий; дни месяца стоят по центру оставшейся части таблицы */
  const NAMES_WIDTH = 100;
  const HEADER_PAD = 3;
  /** Отступ строки кружков от линий блока: при прогибе листа линия не должна заходить в кружок */
  const TASK_PAD = 2;
  const headerHeight = HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS * 2 + HEADER_PAD;
  const blockHeight = subtasks => TASK_PAD * 2 + CIRCLE_RADIUS * 2 + (subtasks - 1) * ROW_PITCH;
  const namesRight = table.x + NAMES_WIDTH;
  const daysWidth = table.x + table.width - namesRight;
  /** Линии между задачами тоньше рамки таблицы */
  const BLOCK_LINE = 0.3;
  /**
   * Все линии лежат по центру границ блоков. У первой и последней задачи одна граница – рамка
   * таблицы, поэтому им добавляется разница половин толщин, чтобы строка стояла посередине
   */
  const EDGE = (table.border - BLOCK_LINE) / 2;

  return {
    version: 3,
    width: 297,
    height: 210,
    blockLine: BLOCK_LINE,
    markers: [
      { id: 4, x: 10, y: 10, bits: '100001011101101010011011110001001001' },
      { id: 5, x: 277, y: 10, bits: '101101000110000110101111111010011100' },
      { id: 6, x: 277, y: 190, bits: '011011011011010100011111111000010011' },
      { id: 7, x: 10, y: 190, bits: '010100100100100011000101010000011111' },
    ],
    qrSlots,
    table,
    namesRight,
    paginate: paginateBy(
      table.bottom - table.top - headerHeight - EDGE * 2,
      blockHeight,
      maxTasksFor(qrSlots)
    ),
    /** Раскладка страницы; зависит только от числа дней и подзадач, поэтому восстанавливается из QR */
    layout: (days, subtaskCounts) => {
      const header = {
        top: table.top,
        numbersY: table.top + HEADER_PAD + DAY_FONT,
        circlesY: table.top + HEADER_PAD + DAY_FONT + NUMBERS_GAP + CIRCLE_RADIUS,
      };
      let top = table.top + headerHeight;
      const blocks = subtaskCounts.map((count, index) => {
        const lead = index === 0 ? EDGE : 0;
        const tail = index === subtaskCounts.length - 1 ? EDGE : 0;
        const firstRowY = top + lead + TASK_PAD + CIRCLE_RADIUS;
        const block = {
          top,
          titleY: firstRowY + TITLE_FONT * 0.35,
          rowsY: Array.from({ length: count }, (_, row) => firstRowY + row * ROW_PITCH),
        };
        top += lead + blockHeight(count) + tail;
        return block;
      });
      return {
        header,
        blocks,
        bottom: top,
        columnsX: Array.from(
          { length: days },
          (_, dayIndex) =>
            namesRight + (daysWidth - days * COLUMN_PITCH) / 2 + COLUMN_PITCH * (dayIndex + 0.5)
        ),
      };
    },
  };
})();

export const SHEETS = [portrait, landscape];

/** Формат, в котором бланк печатается */
export const PRINT_SHEET = landscape;

/** Плашка с месяцем рядом с левым верхним маркером, той же высоты; одинакова у обоих форматов */
export const MONTH_BOX = { x: 24, y: 10, width: 60, height: MARKER_SIZE };

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
 * Содержимое QR: `T` + версия бланка + ГГММ + страница + всего страниц + по задаче ХЭШn
 * (n – число подзадач). Только символы алфавитно-цифрового режима QR. Возвращает части для мест
 * под QR, каждая начинается с номера части и их числа.
 */
export const encodePayload = ({ version, month, page, pages, tasks }) => {
  const text = (
    `T${version}${month.slice(2, 4)}${month.slice(5, 7)}${page.toString(36)}${pages.toString(36)}` +
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
  const match = /^T([23])(\d{2})(0[1-9]|1[0-2])([1-9A-Z])([1-9A-Z])((?:[0-9A-Z]{3}[1-8])+)$/.exec(
    parts.map(part => part.text).join('')
  );
  if (!match) return null;
  return {
    version: Number(match[1]),
    month: `20${match[2]}-${match[3]}`,
    page: parseInt(match[4], 36),
    pages: parseInt(match[5], 36),
    tasks: match[6].match(/.{4}/g).map(item => ({
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
