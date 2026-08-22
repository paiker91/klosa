'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COOKIE_VISIBLE } from '@/lib/panel-visible';

/**
 * Botón de publicar, solo para quien ya entró alguna vez al panel.
 *
 * Se decide en el navegador y después de montar, no durante el renderizado
 * del servidor: la página se sirve igual para todo el mundo desde el CDN y no
 * puede llevar dentro nada que dependa de quién la pide. Empezar en `false` y
 * encenderlo en un efecto evita además el desajuste de hidratación.
 */
export function AccesoPanel({ etiqueta }: { etiqueta: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(
      document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE_VISIBLE}=`)),
    );
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/panel"
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-acento px-4 text-sm font-semibold text-fondo transition-opacity hover:opacity-90"
    >
      <span aria-hidden="true">+</span>
      {etiqueta}
    </Link>
  );
}
