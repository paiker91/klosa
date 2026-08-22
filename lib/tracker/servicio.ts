/**
 * Cliente de Supabase con clave de servicio, solo para procesos.
 *
 * Esta clave se salta las políticas de fila, así que NO puede aparecer nunca
 * en nada que llegue al navegador. Vive en el trabajo programado, que corre en
 * GitHub Actions, y en ningún otro sitio.
 *
 * Es exactamente la razón por la que las tablas de cierres y resultados no
 * tienen política de escritura: nadie que no sea este proceso puede poner una
 * línea de cierre. Que un usuario pudiera escribir la suya vaciaría de sentido
 * al producto entero.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function clienteDeServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_KEY;
  // Sin configuración, el trabajo sigue haciendo su parte del registro
  // público. Es mejor que reventar entero por una pieza que falta.
  if (!url || !clave) return null;

  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
