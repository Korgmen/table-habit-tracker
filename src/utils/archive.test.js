import { describe, it, expect } from 'vitest';
import {
  monthKey,
  decodeArchiveTitles,
  normalizeArchive,
  isValidArchive,
  repairArchive,
  mergeArchives,
  unwrapExport,
  exportFileName,
  filledMonths,
  countTasks,
} from '@/utils/archive';

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
    expect(isValidArchive({ '2026-10': null })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: [null] } })).toBe(false);
  });

  it('отклоняет превышение лимитов задач, подзадач и дней', () => {
    const tasks = count => Array.from({ length: count }, (_, i) => task([], i * 2));
    expect(isValidArchive({ '2026-10': { tasks: tasks(20) } })).toBe(true);
    expect(isValidArchive({ '2026-10': { tasks: tasks(21) } })).toBe(false);
    const subtasks = count => Array.from({ length: count }, (_, id) => ({ id, marks: [] }));
    expect(isValidArchive({ '2026-10': { tasks: [{ title: 'T', subtasks: subtasks(8) }] } })).toBe(
      true
    );
    expect(isValidArchive({ '2026-10': { tasks: [{ title: 'T', subtasks: subtasks(9) }] } })).toBe(
      false
    );
    expect(isValidArchive({ '2026-10': { tasks: [task(Array(32).fill(null))] } })).toBe(false);
  });
});

describe('repairArchive', () => {
  it('заменяет отсутствующие и повторные id, сохраняя корректные', () => {
    const archive = {
      '2026-10': {
        tasks: [
          { title: 'A', progress: '12.5', subtasks: [{ id: 7 }, { id: 7 }, {}] },
          { id: 'abc', title: 'B', progress: { x: 1 }, subtasks: [] },
          { id: 'abc', title: 'C', progress: 0, subtasks: [] },
        ],
      },
    };
    repairArchive(archive);
    const [a, b, c] = archive['2026-10'].tasks;
    expect(typeof a.id).toBe('string');
    expect(a.subtasks[0].id).toBe(7);
    expect(new Set(a.subtasks.map(s => s.id)).size).toBe(3);
    expect(a.progress).toBe('12.5');
    expect(b.id).toBe('abc');
    expect(b.progress).toBe(0);
    expect(c.id).not.toBe('abc');
  });
});

describe('mergeArchives', () => {
  const a = { '2026-09': { tasks: [task([], 1)] }, '2026-10': { tasks: [task([], 3)] } };
  const b = { '2026-08': { tasks: [task([], 5)] }, '2026-10': { tasks: [task([], 7)] } };

  it('добавляет новые месяцы и сохраняет совпавшие текущими', () => {
    const result = mergeArchives(a, b);
    expect(filledMonths(result)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result['2026-10'].tasks[0].id).toBe(3);
    expect(countTasks(result)).toBe(3);
  });

  it('совпавший месяц берётся из файла по выбору', () => {
    expect(mergeArchives(a, b, ['2026-10'])['2026-10'].tasks[0].id).toBe(7);
  });
});

describe('unwrapExport', () => {
  it('файл без schemaVersion – голый архив первой версии', () => {
    const archive = { '2026-10': { tasks: [] } };
    expect(unwrapExport(archive)).toEqual({ version: 1, archive, settings: {} });
  });

  it('обёртка второй версии отдаёт архив и настройки', () => {
    const data = { schemaVersion: 2, settings: { theme: 'dark' }, archive: {} };
    expect(unwrapExport(data)).toEqual({ version: 2, archive: {}, settings: { theme: 'dark' } });
    expect(unwrapExport({ schemaVersion: 2, settings: 5 }).settings).toEqual({});
  });
});

describe('exportFileName', () => {
  it('содержит локальную дату', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toBe('habit_data_2026-01-05.json');
    expect(exportFileName(new Date(2026, 9, 26), 'habit_backup')).toBe(
      'habit_backup_2026-10-26.json'
    );
  });
});
