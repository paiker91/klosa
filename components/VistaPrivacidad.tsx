import type { TextosPrivacidad } from '@/i18n/textos-privacidad';
import { ACTUALIZADO } from '@/i18n/textos-privacidad';

const REPO_CODIGO = 'https://github.com/paiker91/klosa';

/**
 * Política de privacidad.
 *
 * Columna estrecha y texto grande: es un documento para leer, no una pantalla
 * de datos. Y va indexable a propósito — una política escondida no cumple.
 */
export function VistaPrivacidad({ textos: t }: { textos: TextosPrivacidad }) {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="titular-degradado text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {t.h1}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-tinta">{t.entradilla}</p>
      <p className="mt-3 texto-ayuda">
        {t.actualizado} {ACTUALIZADO}
      </p>

      <div className="mt-12 space-y-5">
        {t.secciones.map((s) => (
          /*
            Cada apartado en su tarjeta. Una política de privacidad se recorre
            buscando UN apartado, no se lee de arriba abajo, y en una columna
            continua de párrafos encontrarlo cuesta.
          */
          <section key={s.titulo} className="tarjeta p-5 sm:p-6">
            <h2 className="text-xl font-semibold tracking-tight text-balance">{s.titulo}</h2>
            {s.parrafos.map((p) => (
              <p key={p.slice(0, 40)} className="mt-3 leading-relaxed text-tenue">
                {p}
              </p>
            ))}
            {s.lista && (
              <ul className="mt-3 space-y-2">
                {s.lista.map((li) => (
                  <li key={li.slice(0, 40)} className="flex gap-3 leading-relaxed text-tenue">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dato/70" />
                    {li}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="tarjeta mt-12 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t.contacto.titulo}</h2>
        <p className="mt-2 leading-relaxed text-tenue">{t.contacto.texto}</p>
        <p className="mt-5">
          <a
            href={`${REPO_CODIGO}/issues/new`}
            rel="noopener"
            className="inline-flex min-h-10 items-center rounded-xl bg-acento px-4 text-sm font-semibold text-superficie-alta shadow-[0_4px_12px_-6px_var(--color-acento)] transition-all hover:brightness-110"
          >
            {t.contacto.enlace}
          </a>
        </p>
      </section>
    </article>
  );
}
