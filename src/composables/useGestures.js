/** Короткая вибрация на отметку там, где браузер её поддерживает (Android), мс */
export const haptic = (ms = 10) => navigator.vibrate?.(ms);

/** Через сколько миллисекунд удержания пальца срабатывает долгое нажатие */
const LONG_PRESS_DELAY = 450;
/** Сдвиг пальца, после которого удержание считается прокруткой, а не долгим нажатием, px */
const LONG_PRESS_SLOP = 10;

/**
 * Долгое нажатие пальцем и правый клик мышью: bind(payload) даёт обработчики для v-on,
 * onLongPress(payload) вызывается один раз. Клик, который браузер присылает после долгого нажатия
 * (iOS), нужно погасить: обработчик клика сначала спрашивает consumeClick().
 * Android сам открывает контекстное меню по удержанию: кто сработал первым, таймер
 * или contextmenu, тот и вызывает onLongPress, второй только гасится.
 */
export function useLongPress(onLongPress) {
  let timer = null;
  let start = null;
  let fired = false;
  let pointerType = 'mouse';

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  const bind = payload => ({
    pointerdown: event => {
      pointerType = event.pointerType;
      fired = false;
      cancel();
      if (pointerType === 'mouse') return;
      start = [event.clientX, event.clientY];
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        onLongPress(payload);
      }, LONG_PRESS_DELAY);
    },
    pointermove: event => {
      if (
        timer &&
        Math.hypot(event.clientX - start[0], event.clientY - start[1]) > LONG_PRESS_SLOP
      ) {
        cancel();
      }
    },
    pointerup: cancel,
    pointercancel: cancel,
    pointerleave: cancel,
    contextmenu: event => {
      event.preventDefault();
      if (pointerType === 'mouse') {
        onLongPress(payload);
      } else if (!fired) {
        cancel();
        fired = true;
        onLongPress(payload);
      }
    },
  });

  /** true, если клик пришёл после долгого нажатия и его нужно пропустить */
  const consumeClick = () => {
    if (!fired) return false;
    fired = false;
    return true;
  };

  return { bind, consumeClick };
}

/** Минимальный горизонтальный путь пальца для свайпа, px */
const SWIPE_DISTANCE = 60;

/**
 * Горизонтальный свайп одним пальцем: onNext – «вперёд» (влево, а в RTL вправо), onPrev – назад.
 * Свайп засчитывается, если путь по горизонтали заметно больше вертикального (это не прокрутка).
 * Обработчики вешаются как @touchstart.passive="swipe.start" @touchend="swipe.end".
 */
export function useSwipe({ onPrev, onNext }) {
  let start = null;

  return {
    start: event => {
      start =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    end: event => {
      if (!start) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const rtl = document.documentElement.dir === 'rtl';
      if (rtl ? dx > 0 : dx < 0) onNext();
      else onPrev();
    },
    cancel: () => {
      start = null;
    },
  };
}
