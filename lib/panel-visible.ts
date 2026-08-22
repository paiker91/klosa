/**
 * Pista de "aquí hay panel", separada de la sesión de verdad.
 *
 * La página del registro es estática y se sirve cacheada desde el CDN, igual
 * para todo el mundo. Si tuviera que mirar la sesión en el servidor para
 * decidir si enseña el botón de publicar, dejaría de poder cachearse y cada
 * visita costaría una ejecución. Por eso el botón se decide en el navegador,
 * leyendo esta cookie.
 *
 * Y por eso esta cookie NO es una credencial y no protege nada: cualquiera
 * puede ponérsela a mano y ver el botón. Lo único que consigue con eso es
 * llegar a /panel, donde sigue habiendo una contraseña. Es una pista de
 * interfaz, no un permiso — mezclarlas sería el error clásico de dar por
 * segura una comprobación hecha en el cliente.
 */
export const COOKIE_VISIBLE = 'klosa_panel_a_la_vista';
