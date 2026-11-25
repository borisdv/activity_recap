import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's content width so SVG charts can render at real pixel
 * size (text stays readable instead of being scaled with a viewBox).
 * Returns a callback ref, so it keeps working if the element is re-mounted.
 */
export function useElementWidth(initial = 0) {
  const [width, setWidth] = useState(initial);
  const observer = useRef(null);
  const ref = useCallback((el) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width];
}
