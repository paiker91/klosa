import type { Locale } from '@/i18n/config';

const INTL: Record<Locale, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US' };

/** Con signo: en CLV y ventaja, saber si es positivo o negativo es el dato. */
export function porcentaje(valor: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(valor);
}

/** Sin signo: un margen o una tasa siempre son positivos y el `+` solo añade ruido. */
export function porcentajeSinSigno(valor: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function decimal(valor: number, locale: Locale, digitos = 3): string {
  return new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  }).format(valor);
}

export function entero(valor: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL[locale]).format(valor);
}
