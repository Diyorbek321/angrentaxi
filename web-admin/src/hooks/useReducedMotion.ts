'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Recharts kabi JS orqali animatsiya qiladigan kutubxonalar CSS media query'ni
 * ko'rmaydi — ularga `isAnimationActive={false}` ni shu hook orqali beramiz.
 * SSR'da `false` qaytadi (server harakatni bilmaydi); mount'dan keyin haqiqiy
 * qiymat qo'llanadi.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
