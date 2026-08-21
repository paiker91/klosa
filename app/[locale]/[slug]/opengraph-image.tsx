import { ImageResponse } from 'next/og';
import { LOCALES, RUTAS, esLocale, paginaDe } from '@/i18n/config';
import { TEXTOS } from '@/i18n/textos';
import { TEXTOS_REGISTRO } from '@/i18n/textos-registro';

/**
 * Imagen de vista previa al compartir.
 *
 * No es decoración: el plan de captación es que la calculadora circule por
 * Telegram y Reddit, y ahí el enlace se ve como su tarjeta. Un enlace sin
 * imagen ocupa un tercio y se ignora.
 *
 * Se genera en el build, una por idioma. Sin fuentes remotas ni assets: la
 * tipografía por defecto de ImageResponse basta y no añade dependencias.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Klosa · Calculadora de CLV';

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    (['calculadora', 'registro'] as const).map((p) => ({ locale, slug: RUTAS[p][locale] })),
  );
}

export default async function Imagen({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const idioma = esLocale(locale) ? locale : 'pt';
  const pagina = paginaDe(idioma, slug) ?? 'calculadora';
  const t = pagina === 'registro' ? TEXTOS_REGISTRO[idioma] : TEXTOS[idioma];
  // Primera frase de la descripción: la completa es demasiado larga para 630 px.
  const claim = `${t.meta.descripcion.split('. ')[0] ?? ''}.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0f1115',
          color: '#e9eaec',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: '#9aa1ad' }}>
          KLOSA
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 86, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            {t.h1}
          </div>
          <div style={{ marginTop: 28, fontSize: 34, color: '#9aa1ad', lineHeight: 1.35 }}>
            {claim}
          </div>
        </div>

        {/*
          El ejemplo que recorre toda la página: un mercado 1,90 / 1,90 tiene
          una línea justa de 2,00 y esconde un 5,26 % de margen.

          El margen va en gris y sin signo a propósito. Es la comisión de la
          casa —dinero que pierde el apostante— y pintarlo de verde con un `+`
          lo haría parecer una ganancia. En un producto cuyo argumento es no
          engañar con los números, ese descuido sería el peor posible.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30 }}>
          <div style={{ display: 'flex', color: '#5b8def' }}>1,90 / 1,90</div>
          <div style={{ display: 'flex', color: '#3a4150' }}>→</div>
          <div style={{ display: 'flex', color: '#e9eaec' }}>2,00</div>
          <div style={{ display: 'flex', color: '#5c6270', marginLeft: 14 }}>
            margem 5,26%
          </div>
        </div>
      </div>
    ),
    size,
  );
}
