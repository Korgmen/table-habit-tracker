/**
 * v-radio-group на элементе role="radiogroup": клавиатура как у группы переключателей
 * (WAI-ARIA radio group). В порядке Tab одна кнопка – выбранная (или первая доступная),
 * стрелки переходят к соседней и выбирают её кликом, Home/End – к крайним.
 * В RTL стрелки влево/вправо меняются местами.
 */

const radios = el => [...el.querySelectorAll('[role="radio"]')].filter(radio => !radio.disabled);

/** Расставляет tabindex: 0 у выбранной кнопки, -1 у остальных */
const syncTabIndex = el => {
  const list = radios(el);
  const active = list.find(radio => radio.getAttribute('aria-checked') === 'true') || list[0];
  list.forEach(radio => {
    radio.tabIndex = radio === active ? 0 : -1;
  });
};

const STEPS = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1 };

const handleKeydown = event => {
  const el = event.currentTarget;
  const list = radios(el);
  const index = list.indexOf(document.activeElement);
  if (index < 0) return;

  let next;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = list.length - 1;
  else if (event.key in STEPS) {
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const flip = horizontal && getComputedStyle(el).direction === 'rtl';
    const step = flip ? -STEPS[event.key] : STEPS[event.key];
    next = (index + step + list.length) % list.length;
  } else return;

  event.preventDefault();
  event.stopPropagation();
  list[next].focus();
  list[next].click();
};

export const radioGroup = {
  mounted(el) {
    el.addEventListener('keydown', handleKeydown);
    syncTabIndex(el);
  },
  updated(el) {
    syncTabIndex(el);
  },
  unmounted(el) {
    el.removeEventListener('keydown', handleKeydown);
  },
};
