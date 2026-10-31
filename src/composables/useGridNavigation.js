import { onMounted, onUnmounted } from 'vue';

/**
 * Клавиатура в таблице отметок (role="grid"): в порядке Tab одна клетка, стрелки ходят по
 * клеткам, Home/End – к началу и концу строки. Клетки – кнопки с data-row и data-col:
 * data-row – строка отметок (у привычки с подзадачами их несколько, шапка дней – -1),
 * data-col – число месяца (0 – название привычки). tabindex переставляется прямо в DOM, без
 * перерисовки строк. Недоступные клетки (будущие дни) пропускаются.
 * @param {import('vue').Ref<HTMLElement>} gridRef - элемент role="grid"
 * @param {Object} handlers - { skip(el), note(el) }: X и Alt+Enter на клетке отметки
 * @returns {{ refresh: Function }} refresh – проверить точку входа после смены строк
 */
export function useGridNavigation(gridRef, handlers = {}) {
  /** Клетка, которая сейчас в порядке Tab */
  let current = null;

  const cells = () => [...gridRef.value.querySelectorAll('[data-col]')];
  const pos = el => ({ row: Number(el.dataset.row), col: Number(el.dataset.col) });

  const setCurrent = el => {
    if (current && current !== el) current.tabIndex = -1;
    current = el;
    el.tabIndex = 0;
  };

  /** Точка входа: прежняя клетка, если она ещё в таблице, иначе сегодня в первой строке */
  const refresh = () => {
    if (!gridRef.value) return;
    if (current?.isConnected && !current.disabled) {
      current.tabIndex = 0;
      return;
    }
    const list = cells().filter(el => !el.disabled && el.dataset.row !== '-1');
    const marks = list.filter(el => el.dataset.col !== '0');
    const firstRow = Math.min(...marks.map(el => pos(el).row));
    /** Клетки строки идут по порядку дней: последняя доступная – сегодня */
    const entry = marks.filter(el => pos(el).row === firstRow).at(-1) || list[0];
    if (entry) setCurrent(entry);
  };

  /** Ближайшая доступная клетка по направлению от from */
  const find = (from, dRow, dCol) => {
    const list = cells().filter(el => !el.disabled);
    const { row, col } = pos(from);

    if (dCol !== 0) {
      /** Название привычки одно на все её строки: из него вправо – в первую строку */
      const candidates = list
        .map(el => ({ el, ...pos(el) }))
        .filter(c => (dCol > 0 ? c.col > col : c.col < col))
        .filter(c => (c.col === 0 ? c.row <= row : c.row === row));
      if (candidates.length === 0) return null;
      const best = candidates.reduce((a, b) => {
        const da = Math.abs(a.col - col);
        const db = Math.abs(b.col - col);
        if (da !== db) return da < db ? a : b;
        return a.row >= b.row ? a : b;
      });
      return best.el;
    }

    const sameCol = list
      .map(el => ({ el, ...pos(el) }))
      .filter(c => c.col === col && (dRow > 0 ? c.row > row : c.row < row));
    if (sameCol.length === 0) return null;
    return sameCol.reduce((a, b) => (Math.abs(a.row - row) <= Math.abs(b.row - row) ? a : b)).el;
  };

  const rowEdge = (from, last) => {
    const { row } = pos(from);
    const inRow = cells()
      .filter(el => !el.disabled)
      .filter(el => {
        const p = pos(el);
        return p.row === row || (p.col === 0 && p.row <= row);
      });
    const sorted = inRow.sort((a, b) => pos(a).col - pos(b).col);
    return last ? sorted.at(-1) : sorted[0];
  };

  const handleKeydown = event => {
    const el = event.target.closest?.('[data-col]');
    if (!el || !gridRef.value.contains(el)) return;

    /** X – пропуск, Alt+Enter – заметка: аналоги правого клика и Alt+клика */
    if (el.dataset.sub && !event.ctrlKey && !event.metaKey) {
      if (event.code === 'KeyX' && !event.altKey) {
        event.preventDefault();
        handlers.skip?.(el);
        return;
      }
      if (event.key === 'Enter' && event.altKey) {
        event.preventDefault();
        handlers.note?.(el);
        return;
      }
    }

    const rtl = getComputedStyle(gridRef.value).direction === 'rtl';
    const moves = {
      ArrowUp: () => find(el, -1, 0),
      ArrowDown: () => find(el, 1, 0),
      ArrowLeft: () => find(el, 0, rtl ? 1 : -1),
      ArrowRight: () => find(el, 0, rtl ? -1 : 1),
      Home: () => rowEdge(el, false),
      End: () => rowEdge(el, true),
    };
    const move = moves[event.key];
    if (!move || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    /** Стрелки внутри таблицы не листают месяцы (горячие клавиши App.vue) */
    event.stopPropagation();
    const target = move();
    if (!target) return;
    setCurrent(target);
    target.focus();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  /** Клик или Tab на клетку делает её точкой входа */
  const handleFocusIn = event => {
    const el = event.target.closest?.('[data-col]');
    if (el && gridRef.value.contains(el)) setCurrent(el);
  };

  /** Строки перерисовываются сами по себе (поиск, перенос, месяц): точка входа проверяется */
  let observer = null;
  let frame = 0;

  onMounted(() => {
    gridRef.value.addEventListener('keydown', handleKeydown);
    gridRef.value.addEventListener('focusin', handleFocusIn);
    observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    });
    observer.observe(gridRef.value, { childList: true, subtree: true });
    refresh();
  });

  onUnmounted(() => {
    observer?.disconnect();
    cancelAnimationFrame(frame);
  });

  return { refresh };
}
