/** Интервал, в который второй тап считается двойным */
const DOUBLE_TAP_DELAY = 250;

/**
 * Различает одиночный и двойной тап по одному и тому же элементу.
 * Одиночный срабатывает с задержкой, когда ясно, что второго тапа не будет.
 */
export function useDoubleTap() {
  const pending = new Map();

  /** key отличает элементы, тапы по разным элементам не склеиваются */
  const tap = (key, onSingle, onDouble) => {
    const timeout = pending.get(key);
    if (timeout) {
      clearTimeout(timeout);
      pending.delete(key);
      onDouble();
      return;
    }
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        onSingle();
      }, DOUBLE_TAP_DELAY)
    );
  };

  return { tap };
}
