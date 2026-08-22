/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la clave publicable, que es pública a propósito: no da acceso a nada por
 * sí sola. Lo que decide qué puede ver cada uno son las políticas de fila de
 * la base de datos, no esta clave — por eso el aislamiento se escribió allí y
 * no aquí.
 */
import { createBrowserClient } from '@supabase/ssr';

export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_CLAVE as string,
  );
}
