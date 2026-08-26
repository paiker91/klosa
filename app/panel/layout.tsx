import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '../globals.css';
import { claseFuentes } from '../fuentes';
import { ScriptTema } from '@/components/Tema';

/**
 * El panel es privado y nunca debe indexarse.
 *
 * En este proyecto el `noindex` mal puesto ya costó meses de SEO una vez, así
 * que aquí va explícito y en la dirección contraria: esta rama del sitio SÍ
 * tiene que quedar fuera de los buscadores. Tampoco entra en el sitemap.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Panel — Klosa',
};

export default function LayoutPanel({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={claseFuentes}>
      <head>
        <ScriptTema />
      </head>
      <body className="min-h-dvh bg-fondo text-tinta">{children}</body>
    </html>
  );
}
