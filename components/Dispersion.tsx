import type { Locale } from '@/i18n/config';
import type { TextosMarco } from '@/i18n/textos-marco';
import { porcentaje } from './formato';

/**
 * Nube de puntos de la ventaja, pick a pick.
 *
 * Deliberadamente NO es una curva de beneficio acumulado. Esa curva es el
 * gráfico que enseña todo el mercado y es justo el que engaña: sube y baja con
 * la varianza y se lee como una tendencia. Aquí se dibuja la dispersión, que
 * es la información que decide cuántas apuestas hacen falta — el mensaje
 * entero del producto.
 *
 * SVG generado en el servidor, sin librería de gráficas: son doscientos bytes
 * de marcado y evita meter una dependencia de cliente en una página que se
 * quiere instantánea.
 */
const ANCHO = 720;
const ALTO = 150;
const MARGEN = 26;
const EJE_Y = 112;
const RADIO = 4.5;
const PASO = 9.5;

export function Dispersion({
  valores,
  media,
  locale,
  textos: t,
}: {
  valores: readonly number[];
  media: number;
  locale: Locale;
  textos: TextosMarco;
}) {
  if (valores.length === 0) return null;

  /*
   * Dominio simétrico alrededor de cero. Si no lo fuera, una nube toda
   * negativa se dibujaría centrada y parecería equilibrada.
   */
  const extremo = Math.max(0.05, ...valores.map((v) => Math.abs(v)), Math.abs(media));
  const limite = Math.ceil(extremo * 100) / 100;
  const x = (v: number) => MARGEN + ((v + limite) / (2 * limite)) * (ANCHO - 2 * MARGEN);

  /*
   * Apilado en columnas en vez de dispersión aleatoria: con pocos datos, dos
   * puntos superpuestos se leen como uno solo y la muestra parece menor.
   */
  const COLUMNAS = 60;
  const pila = new Map<number, number>();
  const puntos = [...valores]
    .sort((a, b) => a - b)
    .map((v) => {
      const columna = Math.round(((v + limite) / (2 * limite)) * COLUMNAS);
      const altura = pila.get(columna) ?? 0;
      pila.set(columna, altura + 1);
      return { v, cx: x(v), cy: EJE_Y - RADIO - 2 - altura * PASO };
    });

  const marca = (v: number) => (
    <g>
      <line x1={x(v)} y1={22} x2={x(v)} y2={EJE_Y} stroke="var(--color-borde-fuerte)" strokeWidth="1" />
    </g>
  );

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${t.grafico.titulo}. ${t.grafico.media}: ${porcentaje(media, locale)}.`}
      >
        <defs>
          <linearGradient id="disp-mal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-negativo)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-negativo)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="disp-bien" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-positivo)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-positivo)" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/*
          Las dos mitades teñidas. El lado bueno y el malo se distinguían solo
          por el color de cada punto, y con la nube casi toda de un lado eso
          obliga a buscar la línea de cero para saber de qué lado se está.
        */}
        <rect x={MARGEN - 8} y={12} width={x(0) - MARGEN + 8} height={EJE_Y - 12} fill="url(#disp-mal)" />
        <rect
          x={x(0)}
          y={12}
          width={ANCHO - MARGEN + 8 - x(0)}
          height={EJE_Y - 12}
          fill="url(#disp-bien)"
        />

        {/* Cero: la referencia. Todo lo que está a su derecha batió al cierre. */}
        <line
          x1={x(0)}
          y1={16}
          x2={x(0)}
          y2={EJE_Y}
          stroke="var(--color-tenue)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.6"
        />
        {marca(media)}

        {puntos.map((p, i) => (
          <circle
            key={`${p.v}-${i}`}
            cx={p.cx}
            cy={p.cy}
            r={RADIO}
            fill={p.v >= 0 ? 'var(--color-positivo)' : 'var(--color-negativo)'}
            fillOpacity="0.9"
            /* Un borde del color del fondo: dos puntos pegados se siguen contando. */
            stroke="var(--color-superficie-alta)"
            strokeWidth="1"
          />
        ))}

        <line
          x1={MARGEN - 8}
          y1={EJE_Y}
          x2={ANCHO - MARGEN + 8}
          y2={EJE_Y}
          stroke="var(--color-borde)"
          strokeWidth="1.5"
        />

        {/* Media, etiquetada sobre el eje para que no se confunda con un pick. */}
        <g transform={`translate(${x(media)}, ${EJE_Y})`}>
          <path d="M0 0 L-5 9 L5 9 Z" fill="var(--color-acento)" />
          <text
            y="24"
            textAnchor="middle"
            fill="var(--color-acento)"
            fontSize="12"
            fontFamily="var(--font-mono)"
          >
            {t.grafico.media} {porcentaje(media, locale)}
          </text>
        </g>

        <text x={MARGEN - 8} y={EJE_Y + 24} fill="var(--color-apagado)" fontSize="11.5">
          {t.grafico.peor}
        </text>
        <text
          x={ANCHO - MARGEN + 8}
          y={EJE_Y + 24}
          textAnchor="end"
          fill="var(--color-apagado)"
          fontSize="11.5"
        >
          {t.grafico.mejor}
        </text>
      </svg>
      <figcaption className="mt-2 texto-ayuda">{t.grafico.pie}</figcaption>
    </figure>
  );
}
