import { redirect } from 'next/navigation';
import { LOCALE_POR_DEFECTO, urlCalculadora } from '@/i18n/config';

/** La raíz no tiene contenido propio: lleva al idioma principal. */
export default function Raiz() {
  redirect(urlCalculadora(LOCALE_POR_DEFECTO));
}
