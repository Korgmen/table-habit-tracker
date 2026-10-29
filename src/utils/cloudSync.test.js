import { describe, it, expect } from 'vitest';
import { hashTasks } from '@/utils/archive';
import {
  planConnect,
  classifyRemote,
  mergeLegacy,
  readCloudTasks,
  EMPTY_HASH,
} from '@/utils/cloudSync';

const task = (marks, id = 1, title = 'Task') => ({
  id,
  title,
  progress: 0,
  subtasks: [{ id: id + 1, marks }],
});

const marked = [true, ...Array(30).fill(null)];
const blank = Array(31).fill(null);

describe('planConnect', () => {
  it('первый вход: пустые месяцы берутся из облака, месяц только на устройстве отправляется', () => {
    const local = { '2026-09': { tasks: [task(marked)] } };
    const cloud = { '2026-10': { tasks: [task(marked, 5)], revision: 3 } };
    const plan = planConnect(local, cloud, {});
    expect(Object.keys(plan.take)).toEqual(['2026-10']);
    expect(plan.upload).toEqual(['2026-09']);
    expect(plan.conflicts).toEqual({});
  });

  it('по метаданным: изменённое только с одной стороны не конфликтует', () => {
    const syncedTasks = [task(blank)];
    const meta = {
      '2026-08': { revision: 2, hash: hashTasks(syncedTasks) },
      '2026-09': { revision: 2, hash: hashTasks(syncedTasks) },
      '2026-10': { revision: 2, hash: hashTasks(syncedTasks) },
    };
    const local = {
      '2026-08': { tasks: syncedTasks },
      '2026-09': { tasks: [task(marked)] },
      '2026-10': { tasks: [task(marked)] },
    };
    const cloud = {
      '2026-08': { tasks: [task(marked, 7)], revision: 3 },
      '2026-09': { tasks: syncedTasks, revision: 2 },
      '2026-10': { tasks: [task(marked, 9)], revision: 4 },
    };
    const plan = planConnect(local, cloud, meta);
    expect(Object.keys(plan.take)).toEqual(['2026-08']);
    expect(plan.upload).toEqual(['2026-09']);
    expect(Object.keys(plan.conflicts)).toEqual(['2026-10']);
  });

  it('одинаковые данные совпадают без учёта progress; привычки без отметок заменяет облако', () => {
    const local = {
      '2026-09': { tasks: [{ ...task(marked), progress: '3.2' }] },
      '2026-10': { tasks: [task(blank, 1, 'Carried')] },
    };
    const cloud = {
      '2026-09': { tasks: [task(marked)], revision: 1 },
      '2026-10': { tasks: [task(marked, 4)], revision: 1 },
    };
    const plan = planConnect(local, cloud, {});
    expect(Object.keys(plan.same)).toEqual(['2026-09']);
    expect(Object.keys(plan.take)).toEqual(['2026-10']);
  });

  it('повреждённый облачный месяц всегда ждёт выбора', () => {
    const plan = planConnect({}, { '2026-10': { tasks: null, revision: 1 } }, {});
    expect(Object.keys(plan.conflicts)).toEqual(['2026-10']);
  });
});

describe('classifyRemote', () => {
  const local = [task(blank)];
  const known = { revision: 2, hash: hashTasks(local), device: 'a' };

  it('известная версия пропускается, совпавшие данные не трогают устройство', () => {
    expect(classifyRemote(local, { tasks: local, revision: 2, deviceId: 'a' }, known)).toBe(
      'ignore'
    );
    expect(
      classifyRemote(local, { tasks: local, revision: 3, base: 2, deviceId: 'b' }, known)
    ).toBe('same');
  });

  it('без правок на устройстве берётся облачная версия, с правками – конфликт', () => {
    const remote = { tasks: [task(marked)], revision: 3, base: 2, deviceId: 'b' };
    expect(classifyRemote(local, remote, known)).toBe('take');
    expect(classifyRemote([task(marked, 9)], remote, known)).toBe('conflict');
  });

  it('запись, сделанная без знания нашей версии, – конфликт, даже без правок на устройстве', () => {
    const remote = { tasks: [task(marked)], revision: 2, base: 1, deviceId: 'b' };
    expect(classifyRemote(local, remote, known)).toBe('conflict');
  });
});

describe('mergeLegacy', () => {
  it('первая миграция: весь старый архив – облако, которое ещё нужно записать', () => {
    const legacy = { '2026-10': { tasks: [task(marked)] } };
    const result = mergeLegacy(legacy, {});
    expect(result.firstMigration).toBe(true);
    expect(result.cloud['2026-10']).toMatchObject({ revision: 0, unsaved: true });
    expect(result.absorbed['2026-10']).toBe(hashTasks(legacy['2026-10'].tasks));
  });

  it('после миграции вливает только месяцы, изменённые старым клиентом', () => {
    const before = [task(blank)];
    const months = {
      '2026-08': { tasks: before, revision: 4, legacyHash: hashTasks(before), legacyRevision: 4 },
      '2026-09': { tasks: before, revision: 4, legacyHash: hashTasks(before), legacyRevision: 4 },
      '2026-10': { tasks: before, revision: 6, legacyHash: hashTasks(before), legacyRevision: 4 },
    };
    const legacy = {
      '2026-08': { tasks: before },
      '2026-09': { tasks: [task(marked)] },
      '2026-10': { tasks: [task(marked)] },
    };
    const { cloud, absorbed } = mergeLegacy(legacy, months);
    expect(Object.keys(absorbed)).toEqual(['2026-09', '2026-10']);
    expect(cloud['2026-08']).toBe(months['2026-08']);
    expect(cloud['2026-09']).toMatchObject({ source: 'legacy', revision: 5, forceChoice: false });
    expect(cloud['2026-10']).toMatchObject({ source: 'legacy', revision: 7, forceChoice: true });

    const keys = ['2026-08', '2026-09', '2026-10'];
    const plan = planConnect(
      Object.fromEntries(keys.map(key => [key, { tasks: before }])),
      cloud,
      Object.fromEntries(
        keys.map(key => [key, { revision: months[key].revision, hash: hashTasks(before) }])
      )
    );
    expect(Object.keys(plan.same)).toEqual(['2026-08']);
    expect(Object.keys(plan.take)).toEqual(['2026-09']);
    expect(Object.keys(plan.conflicts)).toEqual(['2026-10']);
  });

  it('месяц, которого нет в старом архиве, сравнивается с пустым', () => {
    const months = { '2026-10': { tasks: [task(marked)], revision: 1, legacyHash: EMPTY_HASH } };
    expect(mergeLegacy({}, months).absorbed).toEqual({});
  });
});

describe('readCloudTasks', () => {
  it('проверяет и чинит задачи месяца, повреждённые даёт null', () => {
    expect(readCloudTasks('2026-10', [{ ...task(marked), color: 'nope' }])[0].color).toBe(
      undefined
    );
    expect(readCloudTasks('2026-10', [{ title: 5 }])).toBe(null);
    expect(readCloudTasks('2026-10', undefined)).toBe(null);
  });
});
