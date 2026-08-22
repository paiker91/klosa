/**
 * Cliente de Supabase para el servidor.
 *
 * La sesión viaja en cookies y hay que poder refrescarla, así que el cliente
 * necesita leerlas y escribirlas. En componentes de servidor escribir cookies
 * no está permitido: por eso el `set` traga el error y es el middleware quien
 * refresca de verdad.
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function clienteServidor() {
  const tarro = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_CLAVE as string,
    {
      cookies: {
        getAll: () => tarro.getAll(),
        setAll: (nuevas) => {
          try {
            for (const { name, value, options } of nuevas) tarro.set(name, value, options);
          } catch {
            // Componente de servidor: no se pueden escribir cookies aquí. El
            // middleware ya se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}

/** El usuario de la petición, o `null`. Verificado contra el servidor de auth. */
export async function usuarioActual() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
