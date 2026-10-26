import { describe, it, expect } from 'vitest';
import { encode } from 'uqr';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARKERS,
  MARKER_SIZE,
  MARKER_CELL,
  QR_SIZE,
  QR_SLOTS,
  TABLE,
  CIRCLE_RADIUS,
  CIRCLE_STROKE,
  pageLayout,
  encodePayload,
  taskHash,
} from '@/utils/sheetLayout';
import { scanSheet, computeHomography, matchScannedTasks, ScanError } from '@/utils/sheetScan';

/** Детерминированный генератор случайных чисел для повторяемых тестов */
const random = seed => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Разрешение растра бланка, пикселей на мм */
const PX = 12;

/**
 * Растеризует бланк с отметками ручкой: 1 – краска, 0 – бумага.
 * Текст не рисуется, остальное повторяет PaperSheet.vue.
 */
const renderSheet = ({ month, subtaskCounts, marks, hideMarker }) => {
  const width = PAGE_WIDTH * PX;
  const height = PAGE_HEIGHT * PX;
  const ink = new Uint8Array(width * height);
  const paint = (x0, y0, x1, y1, test, value = 1) => {
    for (let py = Math.floor(y0 * PX); py < Math.ceil(y1 * PX); py++) {
      for (let px = Math.floor(x0 * PX); px < Math.ceil(x1 * PX); px++) {
        if (test((px + 0.5) / PX, (py + 0.5) / PX)) ink[py * width + px] = value;
      }
    }
  };
  const rect = (x, y, w, h, value = 1) => paint(x, y, x + w, y + h, () => true, value);
  const ring = (cx, cy, r, stroke) =>
    paint(cx - r - stroke, cy - r - stroke, cx + r + stroke, cy + r + stroke, (x, y) => {
      return Math.abs(Math.hypot(x - cx, y - cy) - r) <= stroke / 2;
    });
  const disc = (cx, cy, r) =>
    paint(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r);
  const segment = (x1, y1, x2, y2, w) =>
    paint(
      Math.min(x1, x2) - w,
      Math.min(y1, y2) - w,
      Math.max(x1, x2) + w,
      Math.max(y1, y2) + w,
      (x, y) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= w / 2;
      }
    );

  MARKERS.forEach(marker => {
    rect(marker.x, marker.y, MARKER_SIZE, MARKER_SIZE);
    [...marker.bits].forEach((bit, i) => {
      if (bit === '1') {
        rect(
          marker.x + MARKER_CELL * (1 + (i % 6)),
          marker.y + MARKER_CELL * (1 + Math.floor(i / 6)),
          MARKER_CELL,
          MARKER_CELL,
          0
        );
      }
    });
  });
  if (hideMarker !== undefined) {
    const { x, y } = MARKERS[hideMarker];
    rect(x - 1, y - 1, MARKER_SIZE + 2, MARKER_SIZE + 2, 0);
  }

  const chunks = encodePayload({
    month,
    page: 1,
    pages: 1,
    tasks: subtaskCounts.map((subtasks, i) => ({ hash: taskHash(i + 1), subtasks })),
  });
  chunks.forEach((text, i) => {
    const qr = encode(text, { ecc: 'M', border: 0 });
    const module = QR_SIZE / qr.size;
    const slot = QR_SLOTS[i];
    qr.data.forEach((row, y) =>
      row.forEach(
        (black, x) => black && rect(slot.x + x * module, slot.y + y * module, module, module)
      )
    );
  });

  const days = marks[0][0].length;
  const layout = pageLayout(days, subtaskCounts);
  const border = TABLE.border;
  rect(TABLE.x, layout.header.top, TABLE.width, border);
  rect(TABLE.x, layout.bottom - border, TABLE.width, border);
  rect(TABLE.x, layout.header.top, border, layout.bottom - layout.header.top);
  rect(
    TABLE.x + TABLE.width - border,
    layout.header.top,
    border,
    layout.bottom - layout.header.top
  );
  layout.columnsX.forEach(x => ring(x, layout.header.circlesY, CIRCLE_RADIUS, CIRCLE_STROKE));
  layout.blocks.forEach((block, taskIndex) => {
    rect(TABLE.x, block.top - border / 2, TABLE.width, border);
    block.rowsY.forEach((y, row) =>
      layout.columnsX.forEach((x, day) => {
        ring(x, y, CIRCLE_RADIUS, CIRCLE_STROKE);
        const mark = marks[taskIndex][row][day];
        if (mark === true) disc(x + 0.1, y - 0.1, CIRCLE_RADIUS - 0.1);
        if (mark === false) {
          segment(x - 1.8, y - 1.8, x + 1.8, y + 1.8, 0.45);
          segment(x - 1.8, y + 1.8, x + 1.8, y - 1.8, 0.45);
        }
      })
    );
  });

  return { ink, width, height };
};

/**
 * «Фотографирует» растр бланка: перспектива, неравномерный свет, шум, фон вокруг листа.
 * corners – куда на фото попадают углы листа (TL, TR, BR, BL), bend – прогиб листа в мм,
 * blur – радиус размытия в пикселях фото.
 * Возвращает image (как уменьшенное фото) и readRegion – участок с вдвое большим разрешением,
 * как исходник с камеры в loadPhoto.
 */
const photograph = (sheet, corners, size = [1500, 2000], { bend = 0, blur = 0 } = {}) => {
  const [width, height] = size;
  const pageCorners = [
    [0, 0],
    [PAGE_WIDTH, 0],
    [PAGE_WIDTH, PAGE_HEIGHT],
    [0, PAGE_HEIGHT],
  ];
  const toSheet = computeHomography(corners.map((corner, i) => [corner, pageCorners[i]]));
  const noise = random(7);
  const shade = (u, v) => {
    const [x, flatY] = toSheet(u, v);
    const y = flatY + bend * Math.sin((Math.PI * x) / PAGE_WIDTH);
    let value = 70;
    if (x >= 0 && y >= 0 && x < PAGE_WIDTH && y < PAGE_HEIGHT) {
      const index = Math.floor(y * PX) * sheet.width + Math.floor(x * PX);
      value = sheet.ink[index] ? 45 : 175 + 50 * (u / width);
    }
    return value + (noise() - 0.5) * 20;
  };
  const render = (left, top, w, h, scale) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const offset = (row * w + col) * 4;
        data[offset] =
          data[offset + 1] =
          data[offset + 2] =
            shade(left + (col + 0.5) / scale, top + (row + 0.5) / scale);
        data[offset + 3] = 255;
      }
    }
    return { data, width: w, height: h };
  };
  const image = render(0, 0, width, height, 1);
  const { data } = image;
  if (blur > 0) {
    const source = data.slice();
    for (let v = blur; v < height - blur; v++) {
      for (let u = blur; u < width - blur; u++) {
        let sum = 0;
        for (let dv = -blur; dv <= blur; dv++) {
          for (let du = -blur; du <= blur; du++) sum += source[((v + dv) * width + u + du) * 4];
        }
        const offset = (v * width + u) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = sum / (2 * blur + 1) ** 2;
      }
    }
  }
  const readRegion = (x0, y0, x1, y1) => {
    const left = Math.floor(x0);
    const top = Math.floor(y0);
    return {
      imageData: render(left, top, Math.ceil((x1 - left) * 2), Math.ceil((y1 - top) * 2), 2),
      x: left,
      y: top,
      scale: 2,
    };
  };
  return { image, readRegion };
};

/** Распознаёт «фото», как PhotoImport: QR – с участка в повышенном разрешении */
const scan = photo => scanSheet(photo.image, photo.readRegion);

const MONTH = '2026-10';
const SUBTASKS = [1, 3, 1, 2];

const randomMarks = (seed, counts = SUBTASKS) => {
  const next = random(seed);
  return counts.map(count =>
    Array.from({ length: count }, () =>
      Array.from({ length: 31 }, () => [true, false, null][Math.floor(next() * 3)])
    )
  );
};

const STRAIGHT = [
  [140, 110],
  [1380, 150],
  [1430, 1900],
  [80, 1860],
];

describe('scanSheet', () => {
  it('распознаёт все отметки на фото с перспективой', async () => {
    const marks = randomMarks(1);
    const sheet = renderSheet({ month: MONTH, subtaskCounts: SUBTASKS, marks });
    const result = await scan(photograph(sheet, STRAIGHT));

    expect(result.month).toBe(MONTH);
    expect(result.tasks.map(task => task.hash)).toEqual(SUBTASKS.map((_, i) => taskHash(i + 1)));
    const values = result.tasks.map(task => task.rows.map(row => row.map(cell => cell.value)));
    expect(values).toEqual(marks);
    const uncertain = result.tasks.flatMap(task => task.rows.flat()).filter(cell => cell.uncertain);
    expect(uncertain).toHaveLength(0);
  });

  it('собирает QR из двух частей на полной странице', async () => {
    const counts = new Array(11).fill(1);
    const marks = randomMarks(5, counts);
    const sheet = renderSheet({ month: MONTH, subtaskCounts: counts, marks });
    const result = await scan(photograph(sheet, STRAIGHT));

    expect(result.tasks.map(task => task.hash)).toEqual(counts.map((_, i) => taskHash(i + 1)));
    expect(result.tasks.map(task => task.rows.map(row => row.map(cell => cell.value)))).toEqual(
      marks
    );
  });

  it('распознаёт изогнутый лист на размытом фото', async () => {
    const marks = randomMarks(4);
    const sheet = renderSheet({ month: MONTH, subtaskCounts: SUBTASKS, marks });
    const result = await scan(photograph(sheet, STRAIGHT, undefined, { bend: 2, blur: 1 }));

    expect(result.tasks.map(task => task.rows.map(row => row.map(cell => cell.value)))).toEqual(
      marks
    );
  });

  it('распознаёт перевёрнутое фото', async () => {
    const marks = randomMarks(2);
    const sheet = renderSheet({ month: MONTH, subtaskCounts: SUBTASKS, marks });
    const upsideDown = [STRAIGHT[2], STRAIGHT[3], STRAIGHT[0], STRAIGHT[1]];
    const result = await scan(photograph(sheet, upsideDown));

    expect(result.tasks.map(task => task.rows.map(row => row.map(cell => cell.value)))).toEqual(
      marks
    );
  });

  it('обходится тремя маркерами', async () => {
    const marks = randomMarks(3);
    const sheet = renderSheet({ month: MONTH, subtaskCounts: SUBTASKS, marks, hideMarker: 2 });
    const result = await scan(photograph(sheet, STRAIGHT));

    expect(result.tasks.map(task => task.rows.map(row => row.map(cell => cell.value)))).toEqual(
      marks
    );
  });

  it('сообщает, что лист не найден', async () => {
    const blank = photograph(
      { ink: new Uint8Array(PAGE_WIDTH * PX * PAGE_HEIGHT * PX), width: PAGE_WIDTH * PX },
      STRAIGHT,
      [400, 500]
    );
    await expect(scan(blank)).rejects.toThrow(ScanError);
  });
});

describe('matchScannedTasks', () => {
  it('связывает задачи по хэшу и пропускает неизвестные', () => {
    const tasks = [
      { id: 1, subtasks: [{ id: 11 }] },
      { id: 2, subtasks: [{ id: 21 }, { id: 22 }] },
    ];
    const row = [{ value: true, uncertain: false }];
    const scan = {
      tasks: [
        { hash: taskHash(2), rows: [row, row, row] },
        { hash: taskHash(99), rows: [row] },
      ],
    };
    const { matched, missing } = matchScannedTasks(scan, tasks);
    expect(missing).toBe(1);
    expect(matched).toHaveLength(1);
    expect(matched[0].task.id).toBe(2);
    expect(matched[0].rows).toHaveLength(2);
  });
});
