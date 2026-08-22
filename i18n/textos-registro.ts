/**
 * Textos de la página del registro público.
 *
 * El tono importa tanto como los números. Esta página tiene que resultar
 * incómoda mientras la muestra sea pequeña: si suena a escaparate, deja de
 * ser un registro verificable y pasa a ser publicidad.
 */
import type { Locale } from './config';
import type { Veredicto } from '@/lib/clv';

export interface TextosRegistro {
  meta: { titulo: string; descripcion: string };
  h1: string;
  entradilla: string;
  vacio: { titulo: string; texto: string };
  etiquetas: {
    n: string;
    ventajaMedia: string;
    tasaAcierto: string;
    t: string;
    pendientes: string;
  };
  veredictos: Record<Veredicto, string> & { contra: string };
  tabla: {
    fecha: string;
    partido: string;
    lado: string;
    tomada: string;
    cierre: string;
    ventaja: string;
    esperando: string;
    invalido: string;
  };
  desglose: { titulo: string; aviso: string; grupo: string };
  verificar: { titulo: string; texto: string; enlacePicks: string; enlaceRepo: string };
  aviso: string;
}

const pt: TextosRegistro = {
  meta: {
    titulo: 'Registro de pronósticos — verificável no GitHub',
    descripcion:
      'Cada pick é anotado antes do jogo começar e a linha de fechamento é capturada depois por um provedor. Histórico completo, com CLV e significância estatística.',
  },
  h1: 'Registro de pronósticos',
  entradilla:
    'Cada pick abaixo foi anotado antes do jogo começar, e a linha de fechamento foi capturada depois por um provedor de odds — não por mim. Você não precisa acreditar em nada disso: pode conferir tudo no GitHub.',
  vacio: {
    titulo: 'Ainda não há nenhum pick',
    texto:
      'O registro está vazio. Quando houver picks, cada um aparecerá aqui com sua linha de fechamento e seu CLV — inclusive os ruins.',
  },
  etiquetas: {
    n: 'Picks com fechamento',
    ventajaMedia: 'Vantagem média',
    tasaAcierto: 'Batem o fechamento',
    t: 'Estatística t',
    pendientes: 'Aguardando fechamento',
  },
  veredictos: {
    muestra_insuficiente:
      'Amostra insuficiente. Com menos de 100 picks, nada disso prova nada — nem a favor nem contra. Não acredite ainda.',
    no_distinguible:
      'Não dá para distinguir de zero. Ainda não há evidência de vantagem, nem de que ela não exista.',
    significativo: 'Sinal estatisticamente significativo de vantagem sobre a linha de fechamento.',
    contra: 'Sinal estatisticamente significativo, mas contra: esses picks perdem valor.',
  },
  tabla: {
    fecha: 'Anotado em',
    partido: 'Jogo',
    lado: 'Lado',
    tomada: 'Odd pega',
    cierre: 'Fechamento',
    ventaja: 'Vantagem',
    esperando: 'aguardando',
    invalido: 'não passa na auditoria',
  },
  desglose: {
    titulo: 'Por esporte',
    aviso:
      'Um esporte pode estar perdendo valor enquanto o número geral parece bom. Mas cuidado: separar os dados também enfraquece cada conclusão, porque cada grupo fica com uma amostra menor.',
    grupo: 'Esporte',
  },
  verificar: {
    titulo: 'Como conferir por conta própria',
    texto:
      'O histórico de commits mostra quando cada pick foi anotado, e essa data quem recebeu o push foi o GitHub, não eu. O campo id é o hash do próprio conteúdo do pick: se alguma odd fosse alterada depois, o selo não bateria mais.',
    enlacePicks: 'Baixar picks.jsonl',
    enlaceRepo: 'Ver o repositório e o histórico',
  },
  aviso:
    'CLV positivo não garante lucro, e amostra pequena não diz nada. Isto é um registro, não uma promessa.',
};

const es: TextosRegistro = {
  meta: {
    titulo: 'Registro de pronósticos — verificable en GitHub',
    descripcion:
      'Cada pick se anota antes de que empiece el partido y la línea de cierre la captura después un proveedor. Histórico completo, con CLV y significancia estadística.',
  },
  h1: 'Registro de pronósticos',
  entradilla:
    'Cada pick de abajo se anotó antes de que empezara el partido, y la línea de cierre la capturó después un proveedor de cuotas, no yo. No hace falta que te fíes de nada de esto: puedes comprobarlo todo en GitHub.',
  vacio: {
    titulo: 'Todavía no hay ningún pick',
    texto:
      'El registro está vacío. Cuando haya picks, cada uno aparecerá aquí con su línea de cierre y su CLV — también los malos.',
  },
  etiquetas: {
    n: 'Picks con cierre',
    ventajaMedia: 'Ventaja media',
    tasaAcierto: 'Baten el cierre',
    t: 'Estadístico t',
    pendientes: 'Esperando cierre',
  },
  veredictos: {
    muestra_insuficiente:
      'Muestra insuficiente. Con menos de 100 picks esto no prueba nada, ni a favor ni en contra. Todavía no te lo creas.',
    no_distinguible:
      'No se distingue de cero. Aún no hay evidencia de ventaja, ni de que no la haya.',
    significativo: 'Señal estadísticamente significativa de ventaja sobre la línea de cierre.',
    contra: 'Señal estadísticamente significativa, pero en contra: estos picks pierden valor.',
  },
  tabla: {
    fecha: 'Anotado el',
    partido: 'Partido',
    lado: 'Lado',
    tomada: 'Cuota cogida',
    cierre: 'Cierre',
    ventaja: 'Ventaja',
    esperando: 'esperando',
    invalido: 'no pasa la auditoría',
  },
  desglose: {
    titulo: 'Por deporte',
    aviso:
      'Un deporte puede estar perdiendo valor mientras el número global parece bueno. Pero ojo: separar los datos también debilita cada conclusión, porque cada grupo se queda con una muestra menor.',
    grupo: 'Deporte',
  },
  verificar: {
    titulo: 'Cómo comprobarlo por tu cuenta',
    texto:
      'El historial de commits muestra cuándo se anotó cada pick, y esa fecha la registró GitHub al recibir el push, no yo. El campo id es el hash del propio contenido del pick: si se cambiara una cuota después, el sello dejaría de cuadrar.',
    enlacePicks: 'Descargar picks.jsonl',
    enlaceRepo: 'Ver el repositorio y el historial',
  },
  aviso:
    'Un CLV positivo no garantiza beneficio, y una muestra pequeña no dice nada. Esto es un registro, no una promesa.',
};

const en: TextosRegistro = {
  meta: {
    titulo: 'Pick record — verifiable on GitHub',
    descripcion:
      'Every pick is logged before the game starts and the closing line is captured afterwards by an odds provider. Full history, with CLV and statistical significance.',
  },
  h1: 'Pick record',
  entradilla:
    'Every pick below was logged before the game started, and the closing line was captured afterwards by an odds provider, not by me. You do not have to take any of it on trust: you can check all of it on GitHub.',
  vacio: {
    titulo: 'No picks yet',
    texto:
      'The record is empty. Once there are picks, each one will appear here with its closing line and its CLV — including the bad ones.',
  },
  etiquetas: {
    n: 'Picks with a close',
    ventajaMedia: 'Mean edge',
    tasaAcierto: 'Beat the close',
    t: 't statistic',
    pendientes: 'Awaiting close',
  },
  veredictos: {
    muestra_insuficiente:
      'Sample too small. Below 100 picks this proves nothing, for or against. Do not believe it yet.',
    no_distinguible:
      'Not distinguishable from zero. No evidence of an edge yet, nor of its absence.',
    significativo: 'Statistically significant signal of an edge over the closing line.',
    contra: 'Statistically significant, but against: these picks lose value.',
  },
  tabla: {
    fecha: 'Logged',
    partido: 'Game',
    lado: 'Side',
    tomada: 'Odds taken',
    cierre: 'Close',
    ventaja: 'Edge',
    esperando: 'awaiting',
    invalido: 'fails audit',
  },
  desglose: {
    titulo: 'By sport',
    aviso:
      'One sport can be losing value while the overall number looks fine. But be careful: splitting the data also weakens every conclusion, because each group is left with a smaller sample.',
    grupo: 'Sport',
  },
  verificar: {
    titulo: 'How to check for yourself',
    texto:
      'The commit history shows when each pick was logged, and that date was recorded by GitHub when it received the push, not by me. The id field is a hash of the pick’s own contents: if any odds were changed later, the seal would no longer match.',
    enlacePicks: 'Download picks.jsonl',
    enlaceRepo: 'See the repository and its history',
  },
  aviso:
    'A positive CLV does not guarantee profit, and a small sample says nothing. This is a record, not a promise.',
};

export const TEXTOS_REGISTRO: Record<Locale, TextosRegistro> = { pt, es, en };
