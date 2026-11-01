<script setup>
  import { computed } from 'vue';
  import { encode } from 'uqr';
  import { useHabitStore } from '@/stores/habitStore';
  import {
    PRINT_SHEET,
    MARKER_SIZE,
    MARKER_CELL,
    QR_SIZE,
    MONTH_BOX,
    CIRCLE_RADIUS,
    CIRCLE_STROKE,
    DAY_FONT,
    TITLE_FONT,
    taskHash,
    encodePayload,
  } from '@/utils/sheetLayout';

  const store = useHabitStore();
  const sheet = PRINT_SHEET;
  const { table } = sheet;

  /** Отступ названия от краёв колонки названий */
  const TITLE_PAD = 2.5;
  const titleMaxWidth = sheet.namesRight - table.x - TITLE_PAD * 2;
  /** Средняя ширина символа полужирного шрифта в долях кегля: с запасом для широких букв */
  const CHAR_WIDTH = 0.6;

  /** Длинное название сжимается по ширине колонки, короткое остаётся как есть */
  const titleLength = title =>
    title.length * TITLE_FONT * CHAR_WIDTH > titleMaxWidth ? titleMaxWidth : undefined;

  /** Белые клетки маркера ArUco */
  const markerCells = marker =>
    [...marker.bits].flatMap((bit, i) =>
      bit === '1'
        ? [
            {
              x: marker.x + MARKER_CELL * (1 + (i % 6)),
              y: marker.y + MARKER_CELL * (1 + Math.floor(i / 6)),
            },
          ]
        : []
    );

  /** Путь SVG из чёрных модулей частей QR, каждая на своём месте */
  const qrPath = chunks =>
    chunks
      .flatMap((text, i) => {
        const { x: left, y: top } = sheet.qrSlots[i];
        const qr = encode(text, { ecc: 'M', border: 0 });
        const module = QR_SIZE / qr.size;
        return qr.data.flatMap((row, y) =>
          row.map((black, x) =>
            black ? `M${left + x * module} ${top + y * module}h${module}v${module}h${-module}z` : ''
          )
        );
      })
      .join('');

  /** Страницы бланка: задачи, раскладка и QR */
  const pages = computed(() => {
    const counts = store.tasks.map(task => task.subtasks.length);
    const groups = sheet.paginate(counts);
    return groups.map((indexes, pageIndex) => {
      const tasks = indexes.map(i => store.tasks[i]);
      return {
        number: pageIndex + 1,
        tasks,
        layout: sheet.layout(
          store.daysInMonth,
          tasks.map(task => task.subtasks.length)
        ),
        qr: qrPath(
          encodePayload({
            version: sheet.version,
            month: store.currentMonthKey,
            page: pageIndex + 1,
            pages: groups.length,
            tasks: tasks.map(task => ({ hash: taskHash(task.id), subtasks: task.subtasks.length })),
          })
        ),
      };
    });
  });

  const days = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));
</script>

<template>
  <div class="hidden bg-white text-black print:block" dir="ltr">
    <!-- Поля страницы задаёт сам бланк -->
    <component :is="'style'">@page { size: A4 landscape; margin: 0; }</component>

    <svg
      v-for="page in pages"
      :key="page.number"
      class="block not-last:break-after-page"
      :width="`${sheet.width}mm`"
      :height="`${sheet.height - 1}mm`"
      :viewBox="`0 0 ${sheet.width} ${sheet.height}`"
      fill="black"
      font-family="Golos Text Variable"
    >
      <rect :width="sheet.width" :height="sheet.height" fill="white" />

      <!-- Угловые маркеры -->
      <g v-for="marker in sheet.markers" :key="marker.id">
        <rect :x="marker.x" :y="marker.y" :width="MARKER_SIZE" :height="MARKER_SIZE" />
        <rect
          v-for="(cell, i) in markerCells(marker)"
          :key="i"
          :x="cell.x"
          :y="cell.y"
          :width="MARKER_CELL"
          :height="MARKER_CELL"
          fill="white"
        />
      </g>

      <!-- Месяц и год, номер страницы: рамка по высоте вровень с маркером -->
      <rect
        :x="MONTH_BOX.x + 0.25"
        :y="MONTH_BOX.y + 0.25"
        :width="MONTH_BOX.width - 0.5"
        :height="MONTH_BOX.height - 0.5"
        fill="none"
        stroke="black"
        stroke-width="0.5"
      />
      <text
        :x="MONTH_BOX.x + MONTH_BOX.width / 2"
        :y="MONTH_BOX.y + MONTH_BOX.height / 2 + 1.4"
        font-size="4"
        font-weight="600"
        font-style="italic"
        text-anchor="middle"
      >
        {{ store.monthName }} {{ store.currentYear }}
      </text>
      <text
        v-if="pages.length > 1"
        :x="MONTH_BOX.x + MONTH_BOX.width + 4"
        :y="MONTH_BOX.y + MONTH_BOX.height / 2 + 1.2"
        font-size="3.5"
      >
        {{ page.number }}/{{ pages.length }}
      </text>

      <!-- Части QR: формат, месяц, страница и задачи бланка -->
      <path :d="page.qr" />

      <!-- Рамка таблицы и граница колонки названий: линии по центру границ, как и между задачами -->
      <rect
        :x="table.x"
        :y="page.layout.header.top"
        :width="table.width"
        :height="page.layout.bottom - page.layout.header.top"
        fill="none"
        stroke="black"
        :stroke-width="table.border"
      />
      <line
        :x1="sheet.namesRight"
        :x2="sheet.namesRight"
        :y1="page.layout.header.top"
        :y2="page.layout.bottom"
        stroke="black"
        :stroke-width="table.border"
      />

      <!-- Шапка: номера дней и общие кружки -->
      <g>
        <template v-for="(x, index) in page.layout.columnsX" :key="index">
          <text
            :x="x"
            :y="page.layout.header.numbersY"
            :font-size="DAY_FONT"
            font-weight="500"
            text-anchor="middle"
          >
            {{ days[index] }}
          </text>
          <circle
            :cx="x"
            :cy="page.layout.header.circlesY"
            :r="CIRCLE_RADIUS"
            fill="none"
            stroke="black"
            :stroke-width="CIRCLE_STROKE"
          />
        </template>
      </g>

      <!-- Строки задач: название слева, кружки дней справа -->
      <g v-for="(task, taskIndex) in page.tasks" :key="task.id">
        <line
          :x1="table.x"
          :x2="table.x + table.width"
          :y1="page.layout.blocks[taskIndex].top"
          :y2="page.layout.blocks[taskIndex].top"
          stroke="black"
          :stroke-width="taskIndex === 0 ? table.border : sheet.blockLine"
        />
        <text
          :x="table.x + TITLE_PAD"
          :y="page.layout.blocks[taskIndex].titleY"
          :font-size="TITLE_FONT"
          font-weight="700"
          :textLength="titleLength(task.title)"
          :lengthAdjust="titleLength(task.title) ? 'spacingAndGlyphs' : undefined"
        >
          {{ task.title }}
        </text>
        <template v-for="(x, index) in page.layout.columnsX" :key="index">
          <circle
            v-for="(y, row) in page.layout.blocks[taskIndex].rowsY"
            :key="row"
            :cx="x"
            :cy="y"
            :r="CIRCLE_RADIUS"
            fill="none"
            stroke="black"
            :stroke-width="CIRCLE_STROKE"
          />
        </template>
      </g>
    </svg>
  </div>
</template>
