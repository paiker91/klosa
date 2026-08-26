import type { TextosMarco } from '@/i18n/textos-marco';

/**
 * El producto en una figura.
 *
 * La línea es la cuota moviéndose desde que abre el mercado hasta que cierra;
 * el punto es el precio que se cogió, por encima de ella. Eso es tener CLV
 * positivo, y explicarlo con un dibujo cuesta menos que con un párrafo — que
 * era lo único que había aquí antes.
 *
 * Tres decisiones que no son de gusto:
 *
 *   1. Lleva la palabra «Ejemplo» encima. La figura tiene cifras y, en una
 *      página que además publica un registro real, un número sin etiquetar se
 *      lee como un dato. Esa confusión es justo la que este producto existe
 *      para deshacer.
 *   2. Es SVG en línea, sin fichero. Entra en el primer HTML y no cuesta una
 *      petición más antes de la primera pintura, que es lo único que ve quien
 *      llega desde un enlace.
 *   3. El trazo se dibuja solo al cargar, con `stroke-dasharray`. La hoja de
 *      estilo ya anula las animaciones bajo `prefers-reduced-motion`, así que
 *      quien lo pida ve la figura entera y quieta.
 */
export function FiguraCLV({ textos: t }: { textos: TextosMarco }) {
  const f = t.hero.figura;

  /*
   * La cuota BAJA hacia el cierre, así que en pantalla la línea sube: el eje
   * vertical está invertido a propósito, porque una línea descendente se lee
   * como «va mal» y aquí que la cuota caiga después de haberla cogido es
   * precisamente lo bueno. El eje se rotula, no se deja a la intuición.
   */
  const linea = 'M 24 118 C 62 112, 96 96, 132 84 S 210 58, 248 44';

  return (
    <figure className="relative">
      <svg
        viewBox="0 0 280 150"
        className="w-full"
        role="img"
        aria-label={`${f.ejemplo}: ${f.tuCuota} 2,10 · ${f.cierre} 1,88 — ${f.ventaja}`}
      >
        <defs>
          <linearGradient id="clv-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-dato)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--color-dato)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="clv-linea" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-dato)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-dato)" />
          </linearGradient>
        </defs>

        {/* Rejilla: da escala sin competir con la línea. */}
        {[38, 68, 98, 128].map((y) => (
          <line
            key={y}
            x1="14"
            y1={y}
            x2="266"
            y2={y}
            stroke="var(--color-borde)"
            strokeWidth="1"
            strokeOpacity="0.9"
          />
        ))}

        <path d={`${linea} L 248 140 L 24 140 Z`} fill="url(#clv-area)" />

        <path
          className="trazo-clv"
          d={linea}
          fill="none"
          stroke="url(#clv-linea)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/*
          La banda entre el precio que se cogió y el de cierre. Es la ventaja
          hecha superficie: lo que se discute en toda la página es el grosor de
          esta franja.
        */}
        <line
          x1="248"
          y1="26"
          x2="248"
          y2="44"
          stroke="var(--color-positivo)"
          strokeWidth="2.5"
          strokeOpacity="0.9"
          strokeDasharray="3 3"
        />

        {/* El punto: la cuota que se cogió, por encima de la línea. */}
        <circle className="punto-clv" cx="248" cy="26" r="9" fill="var(--color-acento)" opacity="0.16" />
        <circle
          className="punto-clv"
          cx="248"
          cy="26"
          r="4.5"
          fill="var(--color-acento)"
          stroke="var(--color-fondo)"
          strokeWidth="2"
        />

        <text x="14" y="134" className="rotulo-figura" fill="var(--color-apagado)">
          {f.apertura}
        </text>
        <text x="266" y="134" textAnchor="end" className="rotulo-figura" fill="var(--color-apagado)">
          {f.cierre}
        </text>
      </svg>

      {/*
        Los rótulos van en HTML y no en <text>: heredan la tipografía del sitio,
        se traducen sin recalcular anchuras y no se rompen cuando «you got
        value» ocupa el doble que «cogiste valor».
      */}
      <figcaption className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 text-xs">
        <span className="etiqueta-dato">{f.ejemplo}</span>
        <span className="rounded-lg border border-positivo/30 bg-positivo/10 px-2 py-1 font-medium text-positivo">
          ↑ {f.ventaja}
        </span>
      </figcaption>

      <p className="mt-1 flex justify-between texto-ayuda">
        <span>
          {f.tuCuota} <span className="cifra text-acento">2,10</span>
        </span>
        <span>
          {f.cierre} <span className="cifra text-tinta">1,88</span>
        </span>
      </p>
    </figure>
  );
}
