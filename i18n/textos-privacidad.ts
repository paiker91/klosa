/**
 * Política de privacidad.
 *
 * Obligatoria desde que se guardan correos. Se escribió pensando en la LGPD
 * brasileña, pero el sitio se usa desde cualquier país, así que se sostiene
 * sobre el listón más alto de los dos: el RGPD europeo. Cumplir el estricto
 * cumple el otro; al revés, no.
 *
 * Está escrita para que se entienda, no para cubrirse. Un documento que nadie
 * puede leer cumple la letra y falla al propósito, y este proyecto se sostiene
 * entero sobre decir las cosas claras aunque incomoden.
 */
import type { Locale } from './config';

export interface Seccion {
  titulo: string;
  parrafos: string[];
  lista?: string[];
}

export interface TextosPrivacidad {
  meta: { titulo: string; descripcion: string };
  h1: string;
  entradilla: string;
  actualizado: string;
  secciones: Seccion[];
  contacto: { titulo: string; texto: string; enlace: string };
}

/** Cuándo se escribió. Si cambia el tratamiento, cambia también esta fecha. */
export const ACTUALIZADO = '2026-08-24';

const pt: TextosPrivacidad = {
  meta: {
    titulo: 'Privacidade — Klosa',
    descripcion:
      'O que a Klosa guarda, por quê, e como apagar tudo. Guardamos apenas e-mail e picks.',
  },
  h1: 'Privacidade',
  entradilla:
    'O resumo em uma frase: guardamos seu e-mail e os picks que você registrar. Nada mais. Sem nome, sem telefone, sem dados de pagamento, sem rastreamento.',
  actualizado: 'Atualizado em',
  secciones: [
    {
      titulo: 'Quem trata seus dados',
      parrafos: [
        'A Klosa é um projeto individual, não uma empresa. Quem responde pelo tratamento dos dados é a pessoa que mantém o projeto, e o contato está no fim desta página.',
        'A Klosa não é casa de apostas nem intermediária: não aceita apostas, não casa apostas e não administra dinheiro de jogo. É software de análise.',
      ],
    },
    {
      titulo: 'O que guardamos',
      parrafos: ['Só isto, e só de quem cria uma conta:'],
      lista: [
        'Seu e-mail, para poder entrar na conta e recuperá-la.',
        'Uma senha, guardada como hash irreversível pelo provedor de autenticação. Ninguém — nem eu — consegue lê-la.',
        'Os picks que você registrar: competição, jogo, lado, odd, stake e a nota que você escrever.',
      ],
    },
    {
      titulo: 'O que NÃO guardamos',
      parrafos: [
        'A calculadora funciona sem conta e sem enviar nada: os números que você digita ficam no seu navegador e não chegam a nenhum servidor.',
      ],
      lista: [
        'Nome, telefone, endereço ou documentos.',
        'Dados de pagamento. Não há cobrança de nada.',
        'Cookies de rastreamento, publicidade ou análise de audiência. Os únicos cookies são os da sua sessão: sem eles, entrar na conta seria impossível. Contamos visitas, sim, mas sem cookies e sem identificar ninguém — está explicado mais abaixo.',
      ],
    },
    {
      titulo: 'Para que usamos',
      parrafos: [
        'Seu e-mail serve para identificar sua conta e nada mais. Não enviamos newsletter nem promoções.',
        'Seus picks servem para calcular seu CLV e mostrá-los a você. São privados: não aparecem no registro público, que é de uma pessoa só, e o banco de dados impede tecnicamente que um usuário publique os seus.',
      ],
    },
    {
      titulo: 'Contagem de visitas',
      parrafos: [
        'Contamos quantas pessoas entram, para saber se isto serve para alguém. É a única medição que existe no site e não usa cookies: nada é guardado no seu navegador e não dá para seguir você de um site para outro.',
        'O que fica registrado é agregado e não identifica ninguém:',
      ],
      lista: [
        'Qual página foi vista e de onde veio o link.',
        'País, tipo de aparelho e navegador.',
        'Nada de endereço de IP guardado, nada de perfil, nada de publicidade.',
      ],
    },
    {
      titulo: 'Base legal',
      parrafos: [
        'O tratamento se apoia na execução do serviço que você pediu ao criar a conta — art. 7º, V da LGPD no Brasil, art. 6.1.b do GDPR na Europa. Sem e-mail não há como entrar; sem os picks não há o que medir.',
      ],
    },
    {
      titulo: 'Onde ficam',
      parrafos: [
        'Em um banco de dados da Supabase hospedado em São Paulo, Brasil.',
        'Se você está na União Europeia, isso é uma transferência internacional: o Brasil não tem decisão de adequação da UE. Dizemos isso porque é verdade e porque você tem direito a saber onde estão seus dados antes de criar a conta, não depois.',
        'O site roda na Vercel, que serve as páginas. O provedor de odds recebe consultas sobre jogos e mercados, nunca sobre pessoas: ele não sabe que você existe.',
      ],
    },
    {
      titulo: 'Por quanto tempo',
      parrafos: [
        'Enquanto a conta existir. Se você apagar a conta, tudo vai junto na mesma hora — picks, fechamentos e resultados — e não fica cópia nenhuma.',
      ],
    },
    {
      titulo: 'Seus direitos',
      parrafos: [
        'Tanto a LGPD quanto o GDPR garantem que você possa confirmar o tratamento, acessar, corrigir, apagar, levar seus dados embora e revogar o consentimento. Aqui valem para todo mundo, esteja onde estiver.',
        'O mais importante deles está implementado como um botão: em «Meus picks» você apaga a conta e todo o seu conteúdo, sem pedir nada a ninguém. Para os demais, escreva.',
      ],
    },
    {
      titulo: 'Uma coisa que não é privacidade, mas é honesto avisar',
      parrafos: [
        'Este site é para maiores de 18 anos. Aposta é atividade de risco e a maioria de quem aposta perde dinheiro. A Klosa existe para medir isso com honestidade, não para incentivá-lo. Se o jogo virou problema, procure ajuda.',
      ],
    },
  ],
  contacto: {
    titulo: 'Contato',
    texto:
      'Para exercer qualquer direito ou perguntar o que for, abra uma issue no repositório público do projeto. É um canal aberto e fica registrado.',
    enlace: 'Abrir uma issue no GitHub',
  },
};

const es: TextosPrivacidad = {
  meta: {
    titulo: 'Privacidad — Klosa',
    descripcion: 'Qué guarda Klosa, por qué, y cómo borrarlo todo. Solo email y picks.',
  },
  h1: 'Privacidad',
  entradilla:
    'El resumen en una frase: guardamos tu email y los picks que registres. Nada más. Sin nombre, sin teléfono, sin datos de pago, sin seguimiento.',
  actualizado: 'Actualizado el',
  secciones: [
    {
      titulo: 'Quién trata tus datos',
      parrafos: [
        'Klosa es un proyecto individual, no una empresa. Responde del tratamiento la persona que lo mantiene, y el contacto está al final de esta página.',
        'Klosa no es casa de apuestas ni intermediaria: no acepta apuestas, no las casa y no gestiona dinero de juego. Es software de análisis.',
      ],
    },
    {
      titulo: 'Qué guardamos',
      parrafos: ['Solo esto, y solo de quien crea una cuenta:'],
      lista: [
        'Tu email, para poder entrar y recuperar la cuenta.',
        'Una contraseña, guardada como hash irreversible por el proveedor de autenticación. Nadie —yo tampoco— puede leerla.',
        'Los picks que registres: competición, partido, lado, cuota, stake y la nota que escribas.',
      ],
    },
    {
      titulo: 'Qué NO guardamos',
      parrafos: [
        'La calculadora funciona sin cuenta y sin enviar nada: los números que escribes se quedan en tu navegador y no llegan a ningún servidor.',
      ],
      lista: [
        'Nombre, teléfono, dirección ni documentos.',
        'Datos de pago. No se cobra nada.',
        'Cookies de seguimiento, publicidad o analítica. Las únicas cookies son las de tu sesión: sin ellas no se podría entrar. Sí contamos visitas, pero sin cookies y sin identificar a nadie — está explicado más abajo.',
      ],
    },
    {
      titulo: 'Para qué lo usamos',
      parrafos: [
        'Tu email identifica tu cuenta y nada más. No mandamos boletines ni promociones.',
        'Tus picks sirven para calcular tu CLV y enseñártelo. Son privados: no salen en el registro público, que es de una sola persona, y la base de datos impide técnicamente que un usuario publique los suyos.',
      ],
    },
    {
      titulo: 'Recuento de visitas',
      parrafos: [
        'Contamos cuánta gente entra, para saber si esto le sirve a alguien. Es la única medición que hay en el sitio y no usa cookies: no se guarda nada en tu navegador y no se te puede seguir de un sitio a otro.',
        'Lo que queda registrado es agregado y no identifica a nadie:',
      ],
      lista: [
        'Qué página se vio y de dónde venía el enlace.',
        'País, tipo de aparato y navegador.',
        'Ninguna dirección IP guardada, ningún perfil, ninguna publicidad.',
      ],
    },
    {
      titulo: 'Base legal',
      parrafos: [
        'El tratamiento se apoya en la ejecución del servicio que pediste al crear la cuenta — art. 7º V de la LGPD en Brasil, art. 6.1.b del RGPD en Europa. Sin email no hay forma de entrar; sin los picks no hay nada que medir.',
      ],
    },
    {
      titulo: 'Dónde están',
      parrafos: [
        'En una base de datos de Supabase alojada en São Paulo, Brasil.',
        'Si estás en la Unión Europea, eso es una transferencia internacional: Brasil no tiene decisión de adecuación de la UE. Lo decimos porque es verdad y porque tienes derecho a saber dónde están tus datos antes de crear la cuenta, no después.',
        'El sitio corre en Vercel, que sirve las páginas. El proveedor de cuotas recibe consultas sobre partidos y mercados, nunca sobre personas: no sabe que existes.',
      ],
    },
    {
      titulo: 'Cuánto tiempo',
      parrafos: [
        'Mientras exista la cuenta. Si la borras, se va todo con ella al momento —picks, cierres y resultados— y no queda copia.',
      ],
    },
    {
      titulo: 'Tus derechos',
      parrafos: [
        'Tanto la LGPD como el RGPD garantizan que puedas confirmar el tratamiento, acceder, corregir, borrar, llevarte tus datos y revocar el consentimiento. Aquí valen para todo el mundo, estés donde estés.',
        'El más importante está implementado como un botón: en «Mis picks» borras la cuenta y todo su contenido sin pedírselo a nadie. Para el resto, escribe.',
      ],
    },
    {
      titulo: 'Algo que no es privacidad, pero es honesto avisar',
      parrafos: [
        'Este sitio es para mayores de 18 años. Apostar es una actividad de riesgo y la mayoría de quien apuesta pierde dinero. Klosa existe para medir eso con honestidad, no para animarte a hacerlo. Si el juego se ha vuelto un problema, busca ayuda.',
      ],
    },
  ],
  contacto: {
    titulo: 'Contacto',
    texto:
      'Para ejercer cualquier derecho o preguntar lo que sea, abre una issue en el repositorio público del proyecto. Es un canal abierto y queda registrado.',
    enlace: 'Abrir una issue en GitHub',
  },
};

const en: TextosPrivacidad = {
  meta: {
    titulo: 'Privacy — Klosa',
    descripcion: 'What Klosa stores, why, and how to delete it all. Only email and picks.',
  },
  h1: 'Privacy',
  entradilla:
    'The one-line summary: we store your email and the picks you log. Nothing else. No name, no phone, no payment details, no tracking.',
  actualizado: 'Last updated',
  secciones: [
    {
      titulo: 'Who handles your data',
      parrafos: [
        'Klosa is a one-person project, not a company. The person who maintains it is responsible for the processing, and the contact is at the bottom of this page.',
        'Klosa is not a bookmaker or an intermediary: it does not accept bets, match bets or handle gambling money. It is analysis software.',
      ],
    },
    {
      titulo: 'What we store',
      parrafos: ['Only this, and only for people who create an account:'],
      lista: [
        'Your email, so you can sign in and recover the account.',
        'A password, stored as an irreversible hash by the authentication provider. Nobody — including me — can read it.',
        'The picks you log: competition, game, side, odds, stake and any note you write.',
      ],
    },
    {
      titulo: 'What we do NOT store',
      parrafos: [
        'The calculator works without an account and without sending anything: the numbers you type stay in your browser and never reach a server.',
      ],
      lista: [
        'Name, phone, address or identity documents.',
        'Payment details. Nothing is charged.',
        'Tracking, advertising or analytics cookies. The only cookies are your session ones: without them signing in would be impossible. We do count visits, but without cookies and without identifying anyone — explained below.',
      ],
    },
    {
      titulo: 'What we use it for',
      parrafos: [
        'Your email identifies your account and nothing else. We send no newsletters and no promotions.',
        'Your picks are used to compute your CLV and show it to you. They are private: they never appear in the public record, which belongs to one person, and the database technically prevents a user from publishing theirs.',
      ],
    },
    {
      titulo: 'Visit counting',
      parrafos: [
        'We count how many people come in, to know whether this is useful to anyone. It is the only measurement on the site and it uses no cookies: nothing is stored in your browser and you cannot be followed from one site to another.',
        'What gets recorded is aggregated and identifies nobody:',
      ],
      lista: [
        'Which page was viewed and where the link came from.',
        'Country, device type and browser.',
        'No IP address stored, no profile, no advertising.',
      ],
    },
    {
      titulo: 'Legal basis',
      parrafos: [
        'Processing rests on performing the service you asked for when creating the account — art. 7 V of Brazil’s LGPD, art. 6(1)(b) of the EU GDPR. Without an email there is no way to sign in; without picks there is nothing to measure.',
      ],
    },
    {
      titulo: 'Where it lives',
      parrafos: [
        'In a Supabase database hosted in São Paulo, Brazil.',
        'If you are in the European Union, that is an international transfer: Brazil has no EU adequacy decision. We say so because it is true and because you have a right to know where your data sits before creating the account, not after.',
        'The site runs on Vercel, which serves the pages. The odds provider receives queries about games and markets, never about people: it does not know you exist.',
      ],
    },
    {
      titulo: 'For how long',
      parrafos: [
        'As long as the account exists. If you delete it, everything goes with it immediately — picks, closing lines and results — and no copy is kept.',
      ],
    },
    {
      titulo: 'Your rights',
      parrafos: [
        'Both Brazil’s LGPD and the EU GDPR guarantee you can confirm the processing, access, correct, delete, take your data with you and withdraw consent. Here they apply to everyone, wherever you are.',
        'The most important one is a button: in “My picks” you delete the account and everything in it without asking anyone. For the rest, get in touch.',
      ],
    },
    {
      titulo: 'Not privacy, but worth saying plainly',
      parrafos: [
        'This site is for people over 18. Betting is risky and most people who bet lose money. Klosa exists to measure that honestly, not to encourage it. If betting has become a problem, seek help.',
      ],
    },
  ],
  contacto: {
    titulo: 'Contact',
    texto:
      'To exercise any right, or to ask anything at all, open an issue on the project’s public repository. It is an open channel and it stays on the record.',
    enlace: 'Open an issue on GitHub',
  },
};

export const TEXTOS_PRIVACIDAD: Record<Locale, TextosPrivacidad> = { pt, es, en };
