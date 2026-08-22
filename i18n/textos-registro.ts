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
  noDisponible: { titulo: string; texto: string };
  etiquetas: {
    n: string;
    ventajaMedia: string;
    tasaAcierto: string;
    t: string;
    pendientes: string;
  };
  veredictos: Record<Veredicto, string> & { contra: string };
  tabla: {
    resultado: string;
    ganada: string;
    perdida: string;
    anulada: string;
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
  resultados: {
    titulo: string;
    entradilla: string;
    resueltas: string;
    yield: string;
    cuotaMedia: string;
    acierto: string;
    beneficio: string;
    /** Lleva {n} (apuestas que harían falta) y {clv} (las que necesita el CLV). */
    necesarias: string;
    sinDato: string;
    vacio: string;
  };
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
  noDisponible: {
    titulo: 'Não foi possível ler o registro',
    texto:
      'Os dados não puderam ser baixados do GitHub agora. Isso NÃO quer dizer que o registro esteja vazio — quer dizer que não deu para lê-lo. Você pode conferir direto no repositório.',
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
    resultado: 'Resultado',
    ganada: 'green',
    perdida: 'red',
    anulada: 'anulada',
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
  resultados: {
    titulo: 'Yield, odd média e acerto',
    entradilla:
      'Estes são os números que todo mundo pede. Estão aqui, mas com a mesma régua do resto: sem contexto de significância, um yield não diz nada.',
    resueltas: 'Apostas resolvidas',
    yield: 'Yield',
    cuotaMedia: 'Odd média',
    acierto: 'Acerto',
    beneficio: 'Lucro (unidades)',
    necesarias:
      'Com a variação observada nestes próprios dados, seriam necessárias cerca de {n} apostas para que um yield deste tamanho fosse estatisticamente significativo. O CLV chega lá com {clv}. É por isso que esta ferramenta mede CLV.',
    sinDato:
      'Ainda não dá para estimar quantas apostas fariam falta: o yield está perto demais de zero.',
    vacio:
      'Nenhuma aposta resolvida ainda. Quando os jogos terminarem, o placar final é capturado por um provedor e aparece aqui.',
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
  noDisponible: {
    titulo: 'No se ha podido leer el registro',
    texto:
      'Los datos no se han podido descargar de GitHub ahora mismo. Eso NO significa que el registro esté vacío: significa que no se ha podido leer. Puedes comprobarlo directamente en el repositorio.',
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
    resultado: 'Resultado',
    ganada: 'ganada',
    perdida: 'perdida',
    anulada: 'anulada',
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
  resultados: {
    titulo: 'Yield, cuota media y acierto',
    entradilla:
      'Estos son los números que pide todo el mundo. Están aquí, pero con la misma vara que el resto: sin contexto de significancia, un yield no dice nada.',
    resueltas: 'Apuestas resueltas',
    yield: 'Yield',
    cuotaMedia: 'Cuota media',
    acierto: 'Acierto',
    beneficio: 'Beneficio (unidades)',
    necesarias:
      'Con la variación observada en estos mismos datos, harían falta unas {n} apuestas para que un yield de este tamaño fuera estadísticamente significativo. El CLV llega ahí con {clv}. Por eso esta herramienta mide CLV.',
    sinDato:
      'Todavía no se puede estimar cuántas apuestas harían falta: el yield está demasiado cerca de cero.',
    vacio:
      'Aún no hay ninguna apuesta resuelta. Cuando terminen los partidos, el marcador final lo captura un proveedor y aparece aquí.',
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
  noDisponible: {
    titulo: 'Could not read the record',
    texto:
      'The data could not be downloaded from GitHub right now. That does NOT mean the record is empty — it means it could not be read. You can check it directly in the repository.',
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
    resultado: 'Result',
    ganada: 'won',
    perdida: 'lost',
    anulada: 'void',
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
  resultados: {
    titulo: 'Yield, average odds and hit rate',
    entradilla:
      'These are the numbers everyone asks for. They are here, held to the same standard as the rest: without a significance context, a yield says nothing.',
    resueltas: 'Settled bets',
    yield: 'Yield',
    cuotaMedia: 'Average odds',
    acierto: 'Hit rate',
    beneficio: 'Profit (units)',
    necesarias:
      'With the variation observed in this very data, it would take around {n} bets for a yield of this size to be statistically significant. CLV gets there with {clv}. That is why this tool measures CLV.',
    sinDato:
      'It is not yet possible to estimate how many bets would be needed: the yield is too close to zero.',
    vacio:
      'No settled bets yet. Once the games finish, the final score is captured by a provider and shows up here.',
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
