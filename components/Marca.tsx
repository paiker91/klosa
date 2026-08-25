/**
 * Marca. SVG en línea, no un fichero: el logotipo entra en el primer HTML y
 * no cuesta una petición más antes de la primera pintura.
 *
 * El símbolo es el producto en una figura: una línea que sube (el mercado
 * moviéndose hacia el cierre) y un punto por encima de ella (la cuota que se
 * cogió antes). Eso es exactamente lo que significa tener CLV positivo.
 */
export function Simbolo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8.5" fill="url(#klosa-fondo)" />
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="8.5"
        stroke="currentColor"
        strokeOpacity="0.10"
        strokeWidth="1.5"
      />
      <path
        d="M7 22.5 L13 17 L18.5 19 L25.5 11"
        stroke="var(--color-dato)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx="11.5" cy="10" r="3" fill="var(--color-acento)" />
      <defs>
        <linearGradient id="klosa-fondo" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#e7ebfa" />
          <stop offset="1" stopColor="#d3daf4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Marca({
  nombre,
  reclamo,
  conReclamo = false,
}: {
  nombre: string;
  reclamo: string;
  conReclamo?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Simbolo />
      <span className="flex flex-col leading-none">
        <span className="text-[1.0625rem] font-semibold tracking-tight">{nombre}</span>
        {conReclamo && (
          <span className="mt-1 text-[0.6875rem] tracking-wide text-apagado">{reclamo}</span>
        )}
      </span>
    </span>
  );
}
