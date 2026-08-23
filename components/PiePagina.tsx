import Link from 'next/link';
import { urlCalculadora, urlPrivacidad, urlRegistro, type Locale } from '@/i18n/config';
import type { TextosMarco } from '@/i18n/textos-marco';
import { Marca } from './Marca';

const REPO_CODIGO = 'https://github.com/paiker91/klosa';

/**
 * Pie. Lleva el aviso legal completo, y va aquí a propósito: en la cabecera
 * sería ruido, pero escondido del todo dejaría al producto sin decir lo que
 * no es. «No somos casa de apuestas» es una afirmación que toca hacer.
 */
export function PiePagina({
  locale,
  textos: t,
  urlRepoPicks,
}: {
  locale: Locale;
  textos: TextosMarco;
  urlRepoPicks: string;
}) {
  const enlace = 'text-tenue transition-colors hover:text-tinta';

  return (
    <footer className="mt-24 border-t border-borde bg-superficie/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Marca nombre={t.marca.nombre} reclamo={t.marca.reclamo} conReclamo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-tenue">{t.pie.descripcion}</p>
          </div>

          <nav aria-label={t.pie.secciones}>
            <h2 className="etiqueta-dato">{t.pie.secciones}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={urlCalculadora(locale)} className={enlace}>
                  {t.nav.calculadora}
                </Link>
              </li>
              <li>
                <Link href={urlRegistro(locale)} className={enlace}>
                  {t.nav.registro}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.pie.proyecto}>
            <h2 className="etiqueta-dato">{t.pie.proyecto}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={REPO_CODIGO} className={enlace} rel="noopener">
                  {t.pie.codigo}
                </a>
              </li>
              <li>
                <a href={urlRepoPicks} className={enlace} rel="noopener">
                  {t.pie.registro}
                </a>
              </li>
              {/*
                La puerta del panel. Va aquí y no escondida: sin un enlace hay
                que saberse la URL de memoria, y una herramienta a la que no se
                puede entrar desde el propio sitio no existe. La página es
                noindex y la entrada tiene freno a la fuerza bruta.
              */}
              <li>
                <Link href="/panel" className={enlace} rel="nofollow">
                  {t.pie.panel}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-borde pt-6">
          <h2 className="etiqueta-dato">{t.pie.legal}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-apagado">{t.pie.aviso}</p>
          <p className="mt-3">
            <Link href={urlPrivacidad(locale)} className={`text-xs ${enlace}`}>
              {t.pie.privacidad}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
