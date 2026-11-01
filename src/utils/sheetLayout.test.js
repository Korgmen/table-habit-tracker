import { describe, it, expect } from 'vitest';
import {
  SHEETS,
  PRINT_SHEET,
  CIRCLE_RADIUS,
  taskHash,
  encodePayload,
  decodePayload,
  daysInMonthKey,
} from '@/utils/sheetLayout';

const portrait = SHEETS.find(sheet => sheet.version === 2);

describe.each(SHEETS.map(sheet => [sheet.version, sheet]))('бланк T%i', (_, sheet) => {
  it('держит каждую страницу в пределах таблицы', () => {
    const counts = Array.from({ length: 20 }, (_, i) => (i % 8) + 1);
    const pages = sheet.paginate(counts);
    expect(pages.flat()).toEqual(counts.map((_, i) => i));
    pages.forEach(indexes => {
      const layout = sheet.layout(
        31,
        indexes.map(i => counts[i])
      );
      expect(layout.bottom).toBeLessThanOrEqual(sheet.table.bottom);
    });
  });

  it('ставит столбцы внутри таблицы с равным шагом', () => {
    const { columnsX } = sheet.layout(31, [1]);
    expect(columnsX).toHaveLength(31);
    expect(columnsX[0] - CIRCLE_RADIUS).toBeGreaterThan(sheet.table.x);
    expect(columnsX[30] + CIRCLE_RADIUS).toBeLessThan(sheet.table.x + sheet.table.width);
  });

  it('не кладёт на страницу больше задач, чем вмещают части QR', () => {
    const pages = sheet.paginate(new Array(40).fill(1));
    pages.forEach(indexes => {
      const chunks = encodePayload({
        version: sheet.version,
        month: '2026-10',
        page: 1,
        pages: pages.length,
        tasks: indexes.map(i => ({ hash: taskHash(i), subtasks: 1 })),
      });
      expect(chunks.length).toBeLessThanOrEqual(sheet.qrSlots.length);
    });
  });
});

describe('форматы бланка', () => {
  it('печатается альбомный бланк', () => {
    expect(PRINT_SHEET.version).toBe(3);
    expect(PRINT_SHEET.width).toBeGreaterThan(PRINT_SHEET.height);
  });

  it('помещает 20 задач с одной подзадачей на один альбомный лист', () => {
    expect(PRINT_SHEET.paginate(new Array(20).fill(1))).toHaveLength(1);
  });

  it('помещает 15 задач, если у части из них несколько подзадач', () => {
    const counts = [1, 2, 1, 1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1];
    expect(PRINT_SHEET.paginate(counts)).toHaveLength(1);
  });

  it('сохраняет раскладку книжного бланка для уже распечатанных листов', () => {
    expect(portrait.paginate(new Array(11).fill(1))).toHaveLength(1);
    expect(portrait.paginate(new Array(12).fill(1))).toHaveLength(2);
    const { blocks, columnsX } = portrait.layout(31, [1]);
    expect(blocks[0].rowsY[0]).toBeCloseTo(56.6);
    expect(columnsX[0]).toBeCloseTo(21);
  });

  it('различает форматы по номерам маркеров', () => {
    const ids = SHEETS.flatMap(sheet => sheet.markers.map(marker => marker.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('держит колонку дней справа от колонки названий', () => {
    const { columnsX } = PRINT_SHEET.layout(31, [1]);
    expect(columnsX[0] - CIRCLE_RADIUS).toBeGreaterThan(PRINT_SHEET.namesRight);
  });
});

describe('payload', () => {
  it('кодирует и разбирает содержимое QR', () => {
    const payload = {
      version: 3,
      month: '2026-10',
      page: 1,
      pages: 2,
      tasks: [
        { hash: taskHash(1700000000000), subtasks: 1 },
        { hash: taskHash(1700000000005), subtasks: 8 },
      ],
    };
    const chunks = encodePayload(payload);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatch(/^[0-9A-Z]+$/);
    expect(decodePayload(chunks)).toEqual(payload);
  });

  it('делит полную страницу на части по ёмкости QR версии 2 и собирает в любом порядке', () => {
    const payload = {
      version: 3,
      month: '2026-10',
      page: 1,
      pages: 1,
      tasks: Array.from({ length: 20 }, (_, i) => ({ hash: taskHash(i), subtasks: 1 })),
    };
    const chunks = encodePayload(payload);
    expect(chunks).toHaveLength(PRINT_SHEET.qrSlots.length);
    chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(38));
    expect(decodePayload([...chunks].reverse())).toEqual(payload);
    expect(decodePayload(chunks.slice(0, 2))).toBeNull();
  });

  it('читает содержимое книжного бланка', () => {
    expect(decodePayload(['01T2261011ABC1'])).toEqual({
      version: 2,
      month: '2026-10',
      page: 1,
      pages: 1,
      tasks: [{ hash: 'ABC', subtasks: 1 }],
    });
  });

  it('отвергает чужой QR', () => {
    expect(decodePayload(['https://example.com'])).toBeNull();
    expect(decodePayload(['11T22613' + '11ABC1'])).toBeNull();
    expect(decodePayload(['11T2261011ABC9'])).toBeNull();
    expect(decodePayload(['11T4261011ABC1'])).toBeNull();
    expect(decodePayload([])).toBeNull();
  });

  it('даёт стабильный хэш из 3 символов', () => {
    expect(taskHash(1700000000000)).toBe(taskHash('1700000000000'));
    expect(taskHash(1700000000000)).toMatch(/^[0-9A-Z]{3}$/);
    expect(taskHash(1700000000000)).not.toBe(taskHash(1700000000001));
  });
});

describe('daysInMonthKey', () => {
  it('считает дни месяца', () => {
    expect(daysInMonthKey('2026-02')).toBe(28);
    expect(daysInMonthKey('2028-02')).toBe(29);
    expect(daysInMonthKey('2026-10')).toBe(31);
  });
});
