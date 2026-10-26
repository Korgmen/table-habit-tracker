import { describe, it, expect } from 'vitest';
import {
  TABLE,
  QR_SLOTS,
  paginate,
  pageLayout,
  taskHash,
  encodePayload,
  decodePayload,
  daysInMonthKey,
} from '@/utils/sheetLayout';

describe('paginate', () => {
  it('держит каждую страницу в пределах таблицы', () => {
    const counts = Array.from({ length: 20 }, (_, i) => (i % 8) + 1);
    const pages = paginate(counts);
    expect(pages.flat()).toEqual(counts.map((_, i) => i));
    pages.forEach(indexes => {
      const layout = pageLayout(
        31,
        indexes.map(i => counts[i])
      );
      expect(layout.bottom).toBeLessThanOrEqual(TABLE.bottom);
    });
  });

  it('помещает 11 задач с одной подзадачей на одну страницу', () => {
    expect(paginate(new Array(11).fill(1))).toHaveLength(1);
  });
});

describe('pageLayout', () => {
  it('ставит столбцы внутри таблицы с равным шагом', () => {
    const { columnsX } = pageLayout(31, [1]);
    expect(columnsX).toHaveLength(31);
    expect(columnsX[0]).toBeGreaterThan(TABLE.x);
    expect(columnsX[30]).toBeLessThan(TABLE.x + TABLE.width);
  });
});

describe('payload', () => {
  it('кодирует и разбирает содержимое QR', () => {
    const payload = {
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
      month: '2026-10',
      page: 2,
      pages: 2,
      tasks: Array.from({ length: 11 }, (_, i) => ({ hash: taskHash(i), subtasks: 1 })),
    };
    const chunks = encodePayload(payload);
    expect(chunks).toHaveLength(QR_SLOTS.length);
    chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(38));
    expect(decodePayload([...chunks].reverse())).toEqual(payload);
    expect(decodePayload(chunks.slice(0, 1))).toBeNull();
  });

  it('отвергает чужой QR', () => {
    expect(decodePayload(['https://example.com'])).toBeNull();
    expect(decodePayload(['11T22613' + '11ABC1'])).toBeNull();
    expect(decodePayload(['11T2261011ABC9'])).toBeNull();
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
