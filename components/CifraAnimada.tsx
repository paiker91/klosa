'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un número que cuenta hasta su valor al aparecer.
 *
 * Es la ceremonia del resultado: la cifra a la que ha venido el visitante no
 * se estampa, se gana en medio segundo. Curva de frenado fuerte (quintic) para
 * que el final se pose en vez de cortarse.
 *
 * Tres reglas que no son decoración:
 *
 *   1. Con `prefers-reduced-motion`, el valor final directamente. La regla
 *      global de la hoja no puede anular esto porque no es una animación CSS.
 *   2. El formateo lo pone quien llama, con el MISMO formateador que usaría
 *      sin animación: cada fotograma pasa por él, así que el separador, el
 *      signo y los decimales son idénticos al valor en reposo y el último
 *      fotograma es exactamente la cadena final.
 *   3. Cifras tabulares vía la clase `cifra` de quien la usa: el ancho no
 *      baila mientras cuenta.
 */
export function CifraAnimada({
  valor,
  formato,
  duracionMs = 550,
}: {
  valor: number;
  formato: (v: number) => string;
  duracionMs?: number;
}) {
  const [mostrado, setMostrado] = useState<number | null>(null);
  const marco = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMostrado(valor);
      return;
    }

    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const suavizado = 1 - (1 - t) ** 5;
      setMostrado(valor * suavizado);
      if (t < 1) marco.current = requestAnimationFrame(paso);
    };
    marco.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco.current);
  }, [valor, duracionMs]);

  // Antes del primer fotograma, el valor final: sin JavaScript no hay ceremonia
  // pero tampoco un cero mentiroso.
  return <>{formato(mostrado ?? valor)}</>;
}
