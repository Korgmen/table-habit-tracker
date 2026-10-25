import { describe, it, expect } from 'vitest';
import { monthKey, decodeArchiveTitles, normalizeArchive, isValidArchive } from '@/utils/archive';

const task = (marks, id = 1) => ({
  id,
  title: 'Task',
  progress: 0,
  subtasks: [{ id: id + 1, marks }],
});

describe('monthKey', () => {
  it('добавляет ведущий ноль к месяцу', () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});

describe('decodeArchiveTitles', () => {
  it('снимает многослойное экранирование и не трогает остальное', () => {
    const archive = {
      '2026-10': {
        tasks: [
          { ...task([]), title: '&amp;lt;b&amp;gt; &quot;x&quot; &#39;y&#39;' },
          { ...task([], 3), title: 'plain & text' },
          { ...task([], 5), title: 42 },
        ],
      },
      '2026-09': {},
    };
    const result = decodeArchiveTitles(archive);
    expect(result).toBe(archive);
    expect(archive['2026-10'].tasks.map(t => t.title)).toEqual([
      '<b> "x" \'y\'',
      'plain & text',
      42,
    ]);
  });
});

describe('normalizeArchive', () => {
  it('не зависит от порядка ключей и пустых месяцев', () => {
    const a = {
      '2026-10': { tasks: [{ title: 'T', id: 1, subtasks: [] }] },
      '2026-09': { tasks: [] },
    };
    const b = { '2026-10': { tasks: [{ id: 1, subtasks: [], title: 'T' }] } };
    expect(normalizeArchive(a)).toBe(normalizeArchive(b));
  });

  it('различает разные отметки', () => {
    const a = { '2026-10': { tasks: [task([true])] } };
    const b = { '2026-10': { tasks: [task([null])] } };
    expect(normalizeArchive(a)).not.toBe(normalizeArchive(b));
  });
});

describe('isValidArchive', () => {
  it('принимает корректный архив', () => {
    expect(isValidArchive({ '2026-10': { tasks: [task([true, null, false])] } })).toBe(true);
    expect(isValidArchive({ '2026-10': { tasks: [{ title: 'T', subtasks: [{ id: 1 }] }] } })).toBe(
      true
    );
    expect(isValidArchive({})).toBe(true);
  });

  it('отклоняет битую структуру', () => {
    expect(isValidArchive(null)).toBe(false);
    expect(isValidArchive([])).toBe(false);
    expect(isValidArchive({ october: { tasks: [] } })).toBe(false);
    expect(isValidArchive({ '2026-13': { tasks: [] } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: {} } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: [{ title: 'T', subtasks: null }] } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: [task([1, 'x'])] } })).toBe(false);
  });
});
