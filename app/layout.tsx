import type { ReactNode } from 'react';

/**
 * Raíz de paso. El `<html>` y el `<body>` se emiten en `app/[locale]/layout.tsx`,
 * porque el atributo `lang` depende del idioma y aquí todavía no se conoce.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
