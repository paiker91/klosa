/**
 * Refresco de la sesión.
 *
 * Los tokens de acceso caducan pronto y solo se pueden renovar escribiendo
 * cookies, cosa que un componente de servidor no puede hacer. Sin este paso la
 * sesión se caería sola a los pocos minutos y el usuario tendría que volver a
 * entrar constantemente.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_CLAVE;
  // Sin configuración no hay sesión que refrescar, pero el sitio público sigue
  // funcionando entero: la calculadora y el registro no necesitan cuenta.
  if (!url || !clave) return respuesta;

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll: () => peticion.cookies.getAll(),
      setAll: (nuevas) => {
        for (const { name, value } of nuevas) peticion.cookies.set(name, value);
        respuesta = NextResponse.next({ request: peticion });
        for (const { name, value, options } of nuevas) respuesta.cookies.set(name, value, options);
      },
    },
  });

  await supabase.auth.getUser();
  return respuesta;
}

export const config = {
  /*
   * Fuera lo estático y las imágenes: refrescar la sesión en cada icono sería
   * gastar ejecución para nada.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
