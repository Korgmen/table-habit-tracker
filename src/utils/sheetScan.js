import {
  SHEETS,
  MARKER_SIZE,
  QR_SIZE,
  CIRCLE_RADIUS,
  decodePayload,
  daysInMonthKey,
  taskHash,
} from '@/utils/sheetLayout';

/** Ошибка распознавания с кодом для текста в интерфейсе: 'markers' | 'qr' */
export class ScanError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Длинная сторона фото после уменьшения: хватает для кружков и не тормозит на телефоне */
const MAX_IMAGE_SIDE = 2400;

/**
 * Пороги: доля тёмного внутри кружка ниже MARK_FILL – пусто.
 * Иначе по точкам на горизонтали и вертикали: закрашенный кружок тёмный и там (выполнено),
 * у крестика они светлые (пропуск).
 */
const MARK_FILL = 0.12;
const AXIS_FILL = 0.5;
/** Отметка считается сомнительной, если доля ближе этого к порогу или контраст слишком мал */
const UNCERTAIN_MARGIN = 0.06;
const MIN_CONTRAST = 25;

/** Поиск центра кружка вокруг расчётной точки (мм) и окно сглаживания сдвигов по строке (дней) */
const SEARCH_RADIUS = 1.8;
const SEARCH_STEP = 0.3;
const SMOOTH_WINDOW = 3;

/**
 * Читает фото: image – уменьшенное до MAX_IMAGE_SIDE для маркеров и кружков,
 * readRegion – участок уменьшенного фото в исходном разрешении (для мелкого QR),
 * close – освобождает фото.
 */
export const loadPhoto = async file => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const draw = (sx, sy, sw, sh, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  };
  return {
    image: draw(
      0,
      0,
      bitmap.width,
      bitmap.height,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale)
    ),
    readRegion: (x0, y0, x1, y1) => {
      const left = Math.max(0, Math.floor(x0 / scale));
      const top = Math.max(0, Math.floor(y0 / scale));
      const width = Math.max(1, Math.min(bitmap.width, Math.ceil(x1 / scale)) - left);
      const height = Math.max(1, Math.min(bitmap.height, Math.ceil(y1 / scale)) - top);
      return {
        imageData: draw(left, top, width, height, width, height),
        x: left * scale,
        y: top * scale,
        scale: 1 / scale,
      };
    },
    close: () => bitmap.close(),
  };
};

/** Решает систему A·x = b методом Гаусса с выбором главного элемента */
const solveLinear = (matrix, vector) => {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = a[row][n];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
};

/**
 * Гомография из пар точек «мм бланка → пиксели фото» методом наименьших квадратов.
 * Координаты нормируются, чтобы система была обусловлена.
 */
export const computeHomography = pairs => {
  const scaleFrom = 1 / 100;
  const scaleTo = 1 / 1000;
  const ata = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const atb = new Array(8).fill(0);
  const addRow = (row, value) => {
    for (let i = 0; i < 8; i++) {
      atb[i] += row[i] * value;
      for (let j = 0; j < 8; j++) ata[i][j] += row[i] * row[j];
    }
  };
  pairs.forEach(([[x0, y0], [u0, v0]]) => {
    const [x, y, u, v] = [x0 * scaleFrom, y0 * scaleFrom, u0 * scaleTo, v0 * scaleTo];
    addRow([x, y, 1, 0, 0, 0, -x * u, -y * u], u);
    addRow([0, 0, 0, x, y, 1, -x * v, -y * v], v);
  });
  const h = solveLinear(ata, atb);
  return (x0, y0) => {
    const x = x0 * scaleFrom;
    const y = y0 * scaleFrom;
    const w = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / w / scaleTo, (h[3] * x + h[4] * y + h[5]) / w / scaleTo];
  };
};

/** Яркость пикселей (0–255) из RGBA */
const toGray = ({ data, width, height }) => {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { gray, width, height };
};

/** Билинейная выборка яркости; за пределами фото – белый */
const sampleGray = ({ gray, width, height }, u, v) => {
  if (u < 0 || v < 0 || u > width - 1 || v > height - 1) return 255;
  const x = Math.floor(u);
  const y = Math.floor(v);
  const fx = u - x;
  const fy = v - y;
  const x1 = Math.min(x + 1, width - 1);
  const y1 = Math.min(y + 1, height - 1);
  const top = gray[y * width + x] * (1 - fx) + gray[y * width + x1] * fx;
  const bottom = gray[y1 * width + x] * (1 - fx) + gray[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
};

/**
 * Ищет маркеры ArUco, по их номерам определяет формат бланка
 * и строит гомографию по углам найденных маркеров этого формата (нужно минимум 3)
 */
const locateSheet = async imageData => {
  const { AR } = (await import('js-aruco2')).default;
  const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
  const known = new Map(
    SHEETS.flatMap(sheet => sheet.markers.map(marker => [marker.id, { sheet, marker }]))
  );
  const found = new Map();
  detector.detect(imageData).forEach(marker => {
    const previous = found.get(marker.id);
    if (known.has(marker.id) && (!previous || previous.hammingDistance > marker.hammingDistance)) {
      found.set(marker.id, marker);
    }
  });
  const [sheet, count] = SHEETS.map(sheet => [
    sheet,
    sheet.markers.filter(marker => found.has(marker.id)).length,
  ]).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  if (count < 3) throw new ScanError('markers');

  const pairs = [];
  sheet.markers.forEach(({ id, x, y }) => {
    const marker = found.get(id);
    if (!marker) return;
    const sheetCorners = [
      [x, y],
      [x + MARKER_SIZE, y],
      [x + MARKER_SIZE, y + MARKER_SIZE],
      [x, y + MARKER_SIZE],
    ];
    marker.corners.forEach((corner, index) =>
      pairs.push([sheetCorners[index], [corner.x, corner.y]])
    );
  });
  return { sheet, project: computeHomography(pairs) };
};

/**
 * Выпрямляет каждое место под часть QR (с полями) и читает части.
 * Если доступен readRegion, участок берётся из фото в исходном разрешении.
 * QR другого формата, чем маркеры, считается чужим.
 */
const readQr = async (sheet, image, project, readRegion) => {
  const jsQR = (await import('jsqr')).default;
  const margin = 2;
  const pxPerMm = 12;
  const side = Math.round((QR_SIZE + margin * 2) * pxPerMm);
  const chunks = [];
  for (const slot of sheet.qrSlots) {
    let source = { gray: image, x: 0, y: 0, scale: 1 };
    if (readRegion) {
      const corners = [
        [slot.x - margin, slot.y - margin],
        [slot.x + QR_SIZE + margin, slot.y - margin],
        [slot.x + QR_SIZE + margin, slot.y + QR_SIZE + margin],
        [slot.x - margin, slot.y + QR_SIZE + margin],
      ].map(([x, y]) => project(x, y));
      const us = corners.map(([u]) => u);
      const vs = corners.map(([, v]) => v);
      const region = readRegion(Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs));
      source = { gray: toGray(region.imageData), x: region.x, y: region.y, scale: region.scale };
    }
    const data = new Uint8ClampedArray(side * side * 4);
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        const [u, v] = project(slot.x - margin + col / pxPerMm, slot.y - margin + row / pxPerMm);
        const value = sampleGray(
          source.gray,
          (u - source.x) * source.scale,
          (v - source.y) * source.scale
        );
        const offset = (row * side + col) * 4;
        data[offset] = data[offset + 1] = data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }
    const code = jsQR(data, side, side, { inversionAttempts: 'dontInvert' });
    if (code) chunks.push(code.data);
  }
  const payload = decodePayload(chunks);
  if (!payload || payload.version !== sheet.version) throw new ScanError('qr');
  return payload;
};

/** Точки окружности радиуса r (мм) */
const ring = (radius, count) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });

const STROKE_RING = ring(CIRCLE_RADIUS, 24);
const PAPER_RING = ring(CIRCLE_RADIUS + 0.6, 24);
const INNER_POINTS = (() => {
  const points = [];
  const limit = CIRCLE_RADIUS - 0.5;
  for (let x = -limit; x <= limit + 1e-9; x += 0.2) {
    for (let y = -limit; y <= limit + 1e-9; y += 0.2) {
      if (x * x + y * y <= limit * limit) points.push([x, y]);
    }
  }
  return points;
})();
const AXIS_POINTS = [0.75, 0.95, 1.1].flatMap(radius =>
  [0, 1, 2, 3].map(quarter => {
    const angle = (quarter * Math.PI) / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  })
);

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

const median = values => percentile(values, 0.5);

/**
 * Распознаёт фото бланка.
 * Возвращает месяц, страницу и для каждой задачи страницы строки отметок
 * `{ value: true|false|null, uncertain }` по дням.
 * readRegion из loadPhoto необязателен: если его нет, QR читается с того же imageData.
 */
export const scanSheet = async (imageData, readRegion = null) => {
  const { sheet, project } = await locateSheet(imageData);
  const image = toGray(imageData);
  const payload = await readQr(sheet, image, project, readRegion);
  const days = daysInMonthKey(payload.month);
  const layout = sheet.layout(
    days,
    payload.tasks.map(task => task.subtasks)
  );

  const sampleAt = (x, y, points) =>
    points.map(([dx, dy]) => sampleGray(image, ...project(x + dx, y + dy)));
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  /** Сдвиг, при котором напечатанная окружность совпадает с рамкой поиска лучше всего */
  const bestOffset = (x, y) => {
    let best = { dx: 0, dy: 0, score: -Infinity };
    for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS + 1e-9; dx += SEARCH_STEP) {
      for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS + 1e-9; dy += SEARCH_STEP) {
        const score =
          mean(sampleAt(x + dx, y + dy, PAPER_RING)) - mean(sampleAt(x + dx, y + dy, STROKE_RING));
        if (score > best.score) best = { dx, dy, score };
      }
    }
    return best;
  };

  const classify = (x, y) => {
    const paper = percentile(sampleAt(x, y, PAPER_RING), 0.75);
    const ink = percentile(sampleAt(x, y, STROKE_RING), 0.25);
    const contrast = paper - ink;
    const threshold = paper - contrast * 0.35;
    const darkShare = points => {
      const values = sampleAt(x, y, points);
      return values.filter(value => value < threshold).length / values.length;
    };
    const fill = darkShare(INNER_POINTS);
    if (fill <= MARK_FILL) {
      return {
        value: null,
        uncertain: contrast < MIN_CONTRAST || MARK_FILL - fill < UNCERTAIN_MARGIN,
      };
    }
    const axis = darkShare(AXIS_POINTS);
    const margin = Math.min(fill - MARK_FILL, Math.abs(axis - AXIS_FILL));
    return {
      value: axis >= AXIS_FILL,
      uncertain: contrast < MIN_CONTRAST || margin < UNCERTAIN_MARGIN,
    };
  };

  const tasks = payload.tasks.map((task, taskIndex) => ({
    hash: task.hash,
    rows: layout.blocks[taskIndex].rowsY.map(rowY => {
      const offsets = layout.columnsX.map(x => bestOffset(x, rowY));
      return layout.columnsX.map((x, dayIndex) => {
        const window = offsets.slice(
          Math.max(0, dayIndex - SMOOTH_WINDOW),
          dayIndex + SMOOTH_WINDOW + 1
        );
        const dx = median(window.map(offset => offset.dx));
        const dy = median(window.map(offset => offset.dy));
        return classify(x + dx, rowY + dy);
      });
    }),
  }));

  return { month: payload.month, page: payload.page, pages: payload.pages, tasks };
};

/**
 * Сопоставляет распознанные задачи с задачами месяца по хэшу id.
 * При совпадении хэшей задачи берутся по порядку. Строки сверх текущего числа подзадач отбрасываются.
 */
export const matchScannedTasks = (scan, tasks) => {
  const byHash = new Map();
  tasks.forEach(task => {
    const hash = taskHash(task.id);
    byHash.set(hash, [...(byHash.get(hash) || []), task]);
  });
  const matched = [];
  let missing = 0;
  scan.tasks.forEach(scanned => {
    const task = byHash.get(scanned.hash)?.shift();
    if (!task) {
      missing++;
      return;
    }
    matched.push({
      task,
      rows: scanned.rows.slice(0, task.subtasks.length),
    });
  });
  return { matched, missing };
};
