<script setup>
  import { computed } from 'vue';
  import { encode } from 'uqr';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import {
    PAGE_WIDTH,
    PAGE_HEIGHT,
    MARKERS,
    MARKER_SIZE,
    MARKER_CELL,
    QR_SIZE,
    QR_SLOTS,
    MONTH_BOX,
    TABLE,
    COLUMN_PITCH,
    CIRCLE_RADIUS,
    CIRCLE_STROKE,
    DAY_FONT,
    TITLE_FONT,
    paginate,
    pageLayout,
    taskHash,
    encodePayload,
  } from '@/utils/sheetLayout';

  const store = useHabitStore();
  const { isWeekStart } = useHabitUtils();

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

  /** Путь SVG из чёрных модулей частей QR, каждая на своём месте QR_SLOTS */
  const qrPath = chunks =>
    chunks
      .flatMap((text, i) => {
        const { x: left, y: top } = QR_SLOTS[i];
        const qr = encode(text, { ecc: 'M', border: 0 });
        const module = QR_SIZE / qr.size;
        return qr.data.flatMap((row, y) =>
          row.map((black, x) =>
            black ? `M${left + x * module} ${top + y * module}h${module}v${module}h${-module}z` : ''
          )
        );
      })
      .join('');

  /** Дни, после которых рисуется разделитель недели */
  const weekEnds = computed(() =>
    store.showWeekSeparators
      ? Array.from({ length: store.daysInMonth - 1 }, (_, i) => i + 1).filter(day =>
          isWeekStart(day + 1)
        )
      : []
  );

  /** Страницы бланка: задачи, раскладка и QR */
  const pages = computed(() => {
    const counts = store.tasks.map(task => task.subtasks.length);
    const groups = paginate(counts);
    return groups.map((indexes, pageIndex) => {
      const tasks = indexes.map(i => store.tasks[i]);
      return {
        number: pageIndex + 1,
        tasks,
        layout: pageLayout(
          store.daysInMonth,
          tasks.map(task => task.subtasks.length)
        ),
        qr: qrPath(
          encodePayload({
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
    <component :is="'style'">@page { size: A4 portrait; margin: 0; }</component>

    <svg
      v-for="page in pages"
      :key="page.number"
      class="block not-last:break-after-page"
      width="210mm"
      height="296mm"
      :viewBox="`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`"
      fill="black"
      font-family="Golos Text Variable"
    >
      <rect :width="PAGE_WIDTH" :height="PAGE_HEIGHT" fill="white" />

      <!-- Угловые маркеры -->
      <g v-for="marker in MARKERS" :key="marker.id">
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

      <!-- Части QR: месяц, страница и задачи бланка -->
      <path :d="page.qr" />

      <!-- Рамка таблицы -->
      <rect
        :x="TABLE.x + TABLE.border / 2"
        :y="page.layout.header.top + TABLE.border / 2"
        :width="TABLE.width - TABLE.border"
        :height="page.layout.bottom - page.layout.header.top - TABLE.border"
        fill="none"
        stroke="black"
        :stroke-width="TABLE.border"
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
        <line
          v-for="day in weekEnds"
          :key="day"
          :x1="page.layout.columnsX[day - 1] + COLUMN_PITCH / 2"
          :x2="page.layout.columnsX[day - 1] + COLUMN_PITCH / 2"
          :y1="page.layout.header.numbersY - DAY_FONT"
          :y2="page.layout.header.circlesY + CIRCLE_RADIUS"
          stroke="black"
          stroke-width="0.4"
        />
      </g>

      <!-- Блоки задач -->
      <g v-for="(task, taskIndex) in page.tasks" :key="task.id">
        <line
          :x1="TABLE.x"
          :x2="TABLE.x + TABLE.width"
          :y1="page.layout.blocks[taskIndex].top"
          :y2="page.layout.blocks[taskIndex].top"
          stroke="black"
          :stroke-width="TABLE.border"
        />
        <text
          :x="TABLE.x + TABLE.width / 2"
          :y="page.layout.blocks[taskIndex].titleY"
          :font-size="TITLE_FONT"
          font-weight="700"
          text-anchor="middle"
        >
          {{ task.title }}
        </text>
        <template v-for="(x, index) in page.layout.columnsX" :key="index">
          <text
            :x="x"
            :y="page.layout.blocks[taskIndex].numbersY"
            :font-size="DAY_FONT"
            font-weight="500"
            text-anchor="middle"
          >
            {{ days[index] }}
          </text>
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
        <line
          v-for="day in weekEnds"
          :key="day"
          :x1="page.layout.columnsX[day - 1] + COLUMN_PITCH / 2"
          :x2="page.layout.columnsX[day - 1] + COLUMN_PITCH / 2"
          :y1="page.layout.blocks[taskIndex].numbersY - DAY_FONT"
          :y2="page.layout.blocks[taskIndex].rowsY.at(-1) + CIRCLE_RADIUS"
          stroke="black"
          stroke-width="0.4"
        />
      </g>
    </svg>
  </div>
</template>
