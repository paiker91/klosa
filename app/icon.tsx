import { ImageResponse } from 'next/og';

/**
 * Favicon, generado desde código.
 *
 * Es el mismo símbolo de la marca (components/Marca.tsx): la línea del
 * mercado subiendo hacia el cierre y, por encima de ella, el punto de la
 * cuota que se cogió antes. Generarlo aquí en vez de guardar un PNG evita el
 * clásico icono desincronizado cuando la marca cambie.
 *
 * Hasta ahora no había NINGUNO: la pestaña enseñaba el globo genérico del
 * navegador, que es la señal más visible de sitio a medio hacer.
 *
 * Fondo oscuro a propósito aunque el tema sea claro: un favicon claro
 * desaparece contra la barra de pestañas clara, que es donde vive.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icono() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          borderRadius: 7,
          background: 'linear-gradient(135deg, #2a3157 0%, #171c33 100%)',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
          <path
            d="M7 22.5 L13 17 L18.5 19 L25.5 11"
            stroke="#3ce0d2"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="11.5" cy="9.5" r="3.5" fill="#8fa0ff" />
        </svg>
      </div>
    ),
    size,
  );
}
