import { ImageResponse } from 'next/og';

/**
 * Icono de pantalla de inicio en iOS y Android.
 *
 * El mismo dibujo que el favicon pero con aire alrededor: iOS le recorta las
 * esquinas por su cuenta y un trazo pegado al borde saldría comido. El
 * tráfico esperado es móvil, así que este icono se ve más que el favicon.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function IconoApple() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2a3157 0%, #171c33 100%)',
        }}
      >
        <svg width="128" height="128" viewBox="0 0 32 32">
          <path
            d="M7 22.5 L13 17 L18.5 19 L25.5 11"
            stroke="#3ce0d2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="11.5" cy="9.5" r="3" fill="#8fa0ff" />
        </svg>
      </div>
    ),
    size,
  );
}
