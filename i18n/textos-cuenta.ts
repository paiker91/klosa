/**
 * Textos de cuenta y del tracker.
 *
 * El tono sigue siendo el del resto: nada de «empieza a ganar». Lo que se
 * ofrece es medir, y medir puede dar mal.
 */
import type { Locale } from './config';

export interface TextosCuenta {
  meta: { titulo: string; descripcion: string };
  entrar: {
    titulo: string;
    entradilla: string;
    pestanaEntrar: string;
    pestanaCrear: string;
    email: string;
    password: string;
    passwordAyuda: string;
    botonEntrar: string;
    botonCrear: string;
    confirmaEmail: string;
    yaTienes: string;
    privacidad: string;
  };
  errores: {
    credenciales: string;
    emailInvalido: string;
    passwordCorta: string;
    emailEnUso: string;
    generico: string;
  };
  panel: {
    titulo: string;
    entradilla: string;
    salir: string;
    vacio: string;
    anadir: string;
    competicion: string;
    partido: string;
    cuota: string;
    stake: string;
    nota: string;
    guardar: string;
    guardado: string;
    elegir: string;
    cargando: string;
    sinPartidos: string;
    /** Cabeceras de la tabla. */
    fecha: string;
    lado: string;
    cierre: string;
    ventaja: string;
    esperando: string;
    esperandoPartido: string;
    borrar: string;
    soloAntes: string;
    cuenta: string;
    borrarCuenta: string;
    borrarCuentaAviso: string;
  };
}

const pt: TextosCuenta = {
  meta: {
    titulo: 'Sua conta — Klosa',
    descripcion: 'Registre suas apostas e veja se você tem vantagem real ou apenas sorte.',
  },
  entrar: {
    titulo: 'Sua conta',
    entradilla:
      'Registre suas apostas antes do jogo começar. Nós buscamos a linha de fechamento depois e medimos sua vantagem. Guardamos só seu e-mail e seus picks — mais nada.',
    pestanaEntrar: 'Entrar',
    pestanaCrear: 'Criar conta',
    email: 'E-mail',
    password: 'Senha',
    passwordAyuda: 'Pelo menos 8 caracteres.',
    botonEntrar: 'Entrar',
    botonCrear: 'Criar conta',
    confirmaEmail:
      'Conta criada. Confira seu e-mail e clique no link de confirmação para poder entrar.',
    yaTienes: 'Se você já tem conta, use a aba Entrar.',
    privacidad:
      'Guardamos seu e-mail e seus picks. Nada de nome, telefone ou dados de pagamento. Você pode apagar a conta e tudo o que ela contém quando quiser.',
  },
  errores: {
    credenciales: 'E-mail ou senha incorretos.',
    emailInvalido: 'Esse e-mail não parece válido.',
    passwordCorta: 'A senha precisa de pelo menos 8 caracteres.',
    emailEnUso: 'Já existe uma conta com esse e-mail.',
    generico: 'Não deu para completar a operação. Tente de novo.',
  },
  panel: {
    titulo: 'Meus picks',
    entradilla:
      'Cada pick fica registrado com a hora, e o banco de dados não aceita nenhum anotado depois do jogo começar. Nem eu consigo mudar isso.',
    salir: 'Sair',
    vacio: 'Você ainda não registrou nenhum pick. Comece pelo formulário acima.',
    anadir: 'Registrar um pick',
    competicion: 'Competição',
    partido: 'Jogo e lado',
    cuota: 'Odd que você pegou',
    stake: 'Stake (unidades, opcional)',
    nota: 'Nota (opcional)',
    guardar: 'Registrar',
    guardado: 'Pick registrado.',
    elegir: 'Escolha…',
    cargando: 'Buscando…',
    sinPartidos: 'Nenhum jogo aberto nessa competição agora.',
    fecha: 'Anotado em',
    lado: 'Lado',
    cierre: 'Fechamento',
    ventaja: 'Vantagem',
    esperando: 'aguardando',
    esperandoPartido: 'jogo não começou',
    borrar: 'Apagar',
    soloAntes: 'Só dá para apagar antes do jogo começar.',
    cuenta: 'Conta',
    borrarCuenta: 'Apagar minha conta e todos os meus picks',
    borrarCuentaAviso: 'Isso apaga tudo e não tem volta.',
  },
};

const es: TextosCuenta = {
  meta: {
    titulo: 'Tu cuenta — Klosa',
    descripcion: 'Registra tus apuestas y comprueba si tienes ventaja real o solo suerte.',
  },
  entrar: {
    titulo: 'Tu cuenta',
    entradilla:
      'Registra tus apuestas antes de que empiece el partido. Nosotros buscamos la línea de cierre después y medimos tu ventaja. Guardamos solo tu email y tus picks — nada más.',
    pestanaEntrar: 'Entrar',
    pestanaCrear: 'Crear cuenta',
    email: 'Email',
    password: 'Contraseña',
    passwordAyuda: 'Al menos 8 caracteres.',
    botonEntrar: 'Entrar',
    botonCrear: 'Crear cuenta',
    confirmaEmail:
      'Cuenta creada. Mira tu correo y pulsa el enlace de confirmación para poder entrar.',
    yaTienes: 'Si ya tienes cuenta, usa la pestaña Entrar.',
    privacidad:
      'Guardamos tu email y tus picks. Nada de nombre, teléfono ni datos de pago. Puedes borrar la cuenta y todo lo que contiene cuando quieras.',
  },
  errores: {
    credenciales: 'Email o contraseña incorrectos.',
    emailInvalido: 'Ese email no parece válido.',
    passwordCorta: 'La contraseña necesita al menos 8 caracteres.',
    emailEnUso: 'Ya existe una cuenta con ese email.',
    generico: 'No se ha podido completar la operación. Inténtalo otra vez.',
  },
  panel: {
    titulo: 'Mis picks',
    entradilla:
      'Cada pick queda registrado con su hora, y la base de datos no acepta ninguno anotado después de que empiece el partido. Ni yo puedo cambiar eso.',
    salir: 'Salir',
    vacio: 'Todavía no has registrado ningún pick. Empieza por el formulario de arriba.',
    anadir: 'Registrar un pick',
    competicion: 'Competición',
    partido: 'Partido y lado',
    cuota: 'Cuota que cogiste',
    stake: 'Stake (unidades, opcional)',
    nota: 'Nota (opcional)',
    guardar: 'Registrar',
    guardado: 'Pick registrado.',
    elegir: 'Elige…',
    cargando: 'Buscando…',
    sinPartidos: 'No hay partidos abiertos de esa competición ahora.',
    fecha: 'Anotado el',
    lado: 'Lado',
    cierre: 'Cierre',
    ventaja: 'Ventaja',
    esperando: 'esperando',
    esperandoPartido: 'no ha empezado',
    borrar: 'Borrar',
    soloAntes: 'Solo se puede borrar antes de que empiece el partido.',
    cuenta: 'Cuenta',
    borrarCuenta: 'Borrar mi cuenta y todos mis picks',
    borrarCuentaAviso: 'Esto lo borra todo y no tiene vuelta atrás.',
  },
};

const en: TextosCuenta = {
  meta: {
    titulo: 'Your account — Klosa',
    descripcion: 'Log your bets and find out whether you have a real edge or just luck.',
  },
  entrar: {
    titulo: 'Your account',
    entradilla:
      'Log your bets before the game starts. We fetch the closing line afterwards and measure your edge. We store only your email and your picks — nothing else.',
    pestanaEntrar: 'Sign in',
    pestanaCrear: 'Create account',
    email: 'Email',
    password: 'Password',
    passwordAyuda: 'At least 8 characters.',
    botonEntrar: 'Sign in',
    botonCrear: 'Create account',
    confirmaEmail: 'Account created. Check your email and click the confirmation link to sign in.',
    yaTienes: 'Already have an account? Use the Sign in tab.',
    privacidad:
      'We store your email and your picks. No name, no phone, no payment details. You can delete your account and everything in it whenever you want.',
  },
  errores: {
    credenciales: 'Wrong email or password.',
    emailInvalido: 'That email does not look valid.',
    passwordCorta: 'The password needs at least 8 characters.',
    emailEnUso: 'An account with that email already exists.',
    generico: 'Could not complete the operation. Try again.',
  },
  panel: {
    titulo: 'My picks',
    entradilla:
      'Every pick is stored with its timestamp, and the database refuses any logged after the game started. Not even I can change that.',
    salir: 'Sign out',
    vacio: 'You have not logged any picks yet. Start with the form above.',
    anadir: 'Log a pick',
    competicion: 'Competition',
    partido: 'Game and side',
    cuota: 'Odds you took',
    stake: 'Stake (units, optional)',
    nota: 'Note (optional)',
    guardar: 'Log it',
    guardado: 'Pick logged.',
    elegir: 'Choose…',
    cargando: 'Loading…',
    sinPartidos: 'No open games in that competition right now.',
    fecha: 'Logged',
    lado: 'Side',
    cierre: 'Close',
    ventaja: 'Edge',
    esperando: 'awaiting',
    esperandoPartido: 'not started',
    borrar: 'Delete',
    soloAntes: 'Can only be deleted before the game starts.',
    cuenta: 'Account',
    borrarCuenta: 'Delete my account and all my picks',
    borrarCuentaAviso: 'This deletes everything and cannot be undone.',
  },
};

export const TEXTOS_CUENTA: Record<Locale, TextosCuenta> = { pt, es, en };
