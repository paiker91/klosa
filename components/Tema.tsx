'use client';

import { useEffect, useState } from 'react';

const CLAVE = 'klosa-tema';

/**
 * Decide el tema ANTES de la primera pintura.
 *
 * Va como script inline en el <head> de cada layout que emite documento: si
 * esperara a React, quien usa oscuro vería un fogonazo claro en cada carga.
 * Elección guardada primero; si no hay, la preferencia del sistema. El
 * try/catch no es paranoia: localStorage lanza en navegación privada de
 * algunos navegadores.
 */
export function ScriptTema() {
  const codigo = `(function(){try{var t=localStorage.getItem('${CLAVE}');if(t==null)t=matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro';if(t==='oscuro')document.documentElement.dataset.tema='oscuro'}catch(e){}})()`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: codigo }} />;
}

/**
 * Interruptor de tema.
 *
 * Solo glifos, sin librería de iconos: el sol y la luna se entienden en los
 * tres idiomas. `montado` evita el desajuste de hidratación — el servidor no
 * sabe qué tema tiene el visitante, así que hasta el primer efecto se pinta
 * un marcador neutro del mismo tamaño y nada salta.
 */
export function CambioTema({ etiqueta }: { etiqueta: string }) {
  const [oscuro, setOscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setOscuro(document.documentElement.dataset.tema === 'oscuro');
  }, []);

  const cambiar = () => {
    const nuevo = !(document.documentElement.dataset.tema === 'oscuro');
    if (nuevo) document.documentElement.dataset.tema = 'oscuro';
    else delete document.documentElement.dataset.tema;
    try {
      localStorage.setItem(CLAVE, nuevo ? 'oscuro' : 'claro');
    } catch {
      /* navegación privada: el cambio vale para esta página y ya */
    }
    setOscuro(nuevo);
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borde bg-superficie text-sm text-tenue transition-colors hover:border-borde-fuerte hover:text-tinta"
    >
      <span aria-hidden="true">{oscuro === null ? '◐' : oscuro ? '☀' : '☾'}</span>
    </button>
  );
}
