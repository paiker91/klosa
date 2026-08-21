# Klosa — Calculadora de CLV

Primer entregable del proyecto. Ver `CLAUDE.md` para el contexto y
`SPEC-01-calculadora-clv.md` para la especificación.

## Comandos

```bash
npm run dev                          # desarrollo
npm test                             # 55 tests de la lógica matemática
npm run build                        # tres páginas estáticas, una por idioma
npm run comprobar-indexacion -- <url>   # tras CADA despliegue a producción
```

## Rutas

| Ruta | Idioma |
|---|---|
| `/pt/calculadora-clv` | pt-BR (principal) |
| `/es/calculadora-clv` | es |
| `/en/clv-calculator` | en |

Con `hreflang` entre las tres, canonical por página e imagen de Open Graph
generada en el build para cada idioma.

## Estructura

| Ruta | Qué es |
|---|---|
| `lib/clv.ts` | De-vig, las dos métricas y la estadística agregada. Sin React ni red. |
| `lib/tabla.ts` | Lectura de lo pegado desde una hoja de cálculo. |
| `components/` | Interfaz. `ModoSimple` y `ModoAgregado` bajo un contenedor de pestañas. |
| `i18n/` | Configuración de idiomas y textos. |
| `app/[locale]/[slug]/` | La página, su metadata y su imagen de compartir. |
| `scripts/comprobar-indexacion.mjs` | Verifica que producción no bloquea la indexación. |

## Variables de entorno

`NEXT_PUBLIC_SITE_URL` — dominio de producción. **Obligatoria en el build.**
Sin ella, las URL absolutas de Open Graph se resuelven contra `localhost:3000`
y la imagen no carga al compartir el enlace.

## Decisiones que conviene no deshacer

**La librería no habla ningún idioma.** `agregar()` devuelve `veredicto` y
`signo`, nunca texto. La redacción vive en `i18n/textos-agregado.ts`, que es
donde está el argumento del producto y donde conviene poder revisarla.

**Dos parsers de número, distintos a propósito.** `parsearCuota` es estricto:
una cuota va entre 1,01 y 1000, jamás lleva separador de miles, y cualquier
espacio interior es un error. `parsearImporte` es permisivo porque un stake sí
puede llegar como `R$ 1.234,56`. Relajar el primero para que acepte lo del
segundo reintroduce un fallo que ya ocurrió: `"10\t1"` se convertía en `101` y
el parser fabricaba cuotas plausibles a partir de basura.

**No se emite ninguna cabecera `X-Robots-Tag` propia.** `headers()` de Next se
compila dentro de `routes-manifest.json` durante el build, así que una
condición mal evaluada hornea un `noindex` en producción sin dar síntomas —
que es justo el fallo del que se quería proteger. Vercel ya marca los preview
por su cuenta; cada página declara su `robots` explícito; y el script lo
verifica contra el despliegue real.

**Las cifras se atenúan cuando la muestra no da.** En el modo agregado, si hay
menos de 100 apuestas los números salen en gris y el veredicto va antes que
ellos. Enseñar un +18,7 % con el mismo peso visual que un resultado sólido es
la ilusión que este producto existe para desmontar.

## Pendiente

- Verificar el pegado con el portapapeles real de Excel y Google Sheets. Los
  tests reproducen fielmente sus formatos, pero reproducir no es pegar.
- Revisión manual de accesibilidad: foco visible y orden de tabulación en un
  dispositivo real, que es lo que ninguna herramienta automática comprueba.
