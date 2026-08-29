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
  /**
   * Qué es exactamente este registro.
   *
   * Sin esto, un lector supone que las cuotas son las que se pagaron con
   * dinero propio. No lo son, y en un producto cuyo único activo es la
   * credibilidad esa suposición no puede quedar en el aire.
   */
  naturaleza: { titulo: string; texto: string };
  /**
   * Cabecera de cifras.
   *
   * La página abría con dos párrafos y una caja de texto: había que leer para
   * saber qué dice el registro. Estas cuatro cifras lo dicen de un vistazo, y
   * el veredicto va con ellas para que nunca se lean sueltas.
   */
  vistazo: { titulo: string; picks: string; resueltos: string };
  /**
   * El listón que hay que superar para que la ventaja sea positiva.
   *
   * `ventaja ≈ CLV − margen`, comprobado sobre datos reales: con un CLV de
   * +1,01 % y un margen del 1,56 %, la ventaja salía −0,53 %. Sin decirlo, un
   * número negativo se lee como suspenso cuando en realidad dice «te faltan
   * 0,55 puntos», que es información accionable y muy distinta.
   *
   * Lleva {margen} y {clv}.
   */
  liston: { texto: string; alcanzado: string };
  vacio: { titulo: string; texto: string };
  noDisponible: { titulo: string; texto: string };
  etiquetas: {
    n: string;
    clvBruto: string;
    margen: string;
    ventajaMedia: string;
    tasaAcierto: string;
    t: string;
    pendientes: string;
  };
  veredictos: Record<Veredicto, string> & {
    contra: string;
    temprano_favor: string;
    temprano_contra: string;
  };
  /** Qué significa cada cifra, para quien no vive de esto. */
  ayudas: {
    n: string;
    clvBruto: string;
    ventajaMedia: string;
    tasaAcierto: string;
    t: string;
    margen: string;
  };
  /** Las dos preguntas, explicadas antes de los números. */
  dosPreguntas: { titulo: string; bruto: string; ventaja: string; conclusion: string };
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
    /** El cierre sin el margen. Es el número contra el que se mide la ventaja. */
    justa: string;
    /** Precio contra precio, la resta que hace el ojo al mirar la fila. */
    bruto: string;
    ventaja: string;
    esperando: string;
    /**
     * Distinto de `esperando`. La línea se movió y el lado apostado no está en
     * el cierre, así que no hay CLV que calcular — ni ahora ni nunca.
     */
    sinCierre: string;
    /** Cómo se dedujo un cierre cuya línea exacta no sobrevivió. */
    interpolado: string;
    extrapolado: string;
    cota: string;
    invalido: string;
    /** El sello no se puede recalcular. No es lo mismo que estar roto. */
    selloIlegible: string;
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
    /**
     * Veredicto propio, no el del CLV. El del CLV habla de 100 picks, y
     * aplicado al yield insinuaría que con 100 apuestas resueltas ya diría
     * algo — exactamente lo contrario de lo que este bloque demuestra.
     */
    veredictos: Record<Veredicto, string> & {
      contra: string;
      temprano_favor: string;
      temprano_contra: string;
    };
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
  naturaleza: {
    titulo: 'O que este registro mede',
    texto:
      'Mede a qualidade do pick, não as minhas apostas. A odd guardada é a melhor referência do mercado no momento de publicar, e não necessariamente o que eu paguei: da Espanha não tenho acesso a todas as casas, e você não tem acesso às mesmas que eu. O que dá para comparar entre países é o lado escolhido e o preço a que estava — e é isso que está aqui. A vantagem se mede contra o mercado mais afiado do fechamento, hoje Betfair e Matchbook, com margens de cerca de 0,7 %.',
  },
  vistazo: {
    titulo: 'De relance',
    picks: 'picks com fechamento',
    resueltos: 'já liquidados',
  },
  liston: {
    texto:
      'Para a vantagem virar positiva, seu CLV precisa passar da margem média dos seus mercados: {margen}. Você está em {clv}.',
    alcanzado:
      'Seu CLV ({clv}) já passa da margem média dos seus mercados ({margen}): por isso a vantagem é positiva.',
  },
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
    clvBruto: 'CLV',
    margen: 'Margem média',
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
    temprano_favor:
      'Amostra curta, mas o sinal já é forte e a favor. Não é conclusão ainda — com poucos picks a estatística é frágil e apostas do mesmo dia não são totalmente independentes.',
    temprano_contra:
      'Amostra curta, mas o sinal já é forte e CONTRA. Com esses números, esses picks estão perdendo valor de forma difícil de explicar por azar.',
  },
  ayudas: {
    n: 'Picks cujo fechamento o provedor já capturou. Só esses entram nas contas.',
    clvBruto:
      'Sua odd contra a odd de fechamento, preço contra preço. A margem está nas duas e se cancela: o que sobra é se você pegou preço melhor do que o mercado acabou dando.',
    margen:
      'O que as casas cobram, em média, nos mercados em que você apostou. É exatamente a distância entre as duas métricas de cima.',
    ventajaMedia:
      'Quanto melhor (ou pior) foi sua odd em relação ao preço justo do fechamento, já sem a margem da casa. Zero é pagar o preço certo.',
    tasaAcierto:
      'Quantos picks pegaram um preço melhor que o justo. Não é quantos ganharam: é quantos valiam a pena.',
    t: 'Quantos desvios a média está de zero. Acima de 1,96 ou abaixo de -1,96 é difícil de explicar por acaso.',
  },
  dosPreguntas: {
    titulo: 'Duas perguntas que não são a mesma',
    bruto:
      'Peguei preço melhor do que o de fechamento? Compara dois preços reais. A margem está nos dois e se cancela, então isto mede timing e escolha de casa.',
    ventaja:
      'Essa aposta tinha valor esperado positivo? Compara seu preço com o preço justo. A margem entra inteira, e por isso empurra todo mundo para baixo por igual.',
    conclusion:
      'Para ganhar dinheiro não basta bater o fechamento: é preciso batê-lo por mais do que a margem.',
  },
  tabla: {
    resultado: 'Resultado',
    /*
     * «ganha»/«perdida», no «green»/«red».
     *
     * La jerga brasileña es auténtica y un apostante de São Paulo la entiende
     * sin pensar, pero convivía con «anulada» en portugués en la misma
     * columna: ya era una columna en dos idiomas. Y a quien no es brasileño
     * —el resto del mundo, que es a quien apunta esto ahora— dos palabras en
     * inglés donde esperaba un resultado le hacen dudar de si el pick está
     * liquidado. Esa duda ya costó una revisión entera del pipeline para
     * acabar descubriendo que no había nada roto.
     */
    ganada: 'ganha',
    perdida: 'perdida',
    anulada: 'anulada',
    fecha: 'Anotado em',
    partido: 'Jogo',
    lado: 'Lado',
    tomada: 'Odd pega',
    cierre: 'Fechamento',
    justa: 'Odd justa',
    bruto: 'CLV',
    ventaja: 'Vantagem',
    esperando: 'aguardando',
    sinCierre: 'linha moveu, sem fechamento',
    interpolado: 'linha moveu: preço interpolado entre as vizinhas',
    extrapolado: 'linha moveu: preço extrapolado das vizinhas',
    cota: 'linha moveu: CLV medido por baixo',
    invalido: 'não passa na auditoria',
    selloIlegible: 'selo antigo, não verificável',
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
    veredictos: {
      muestra_insuficiente:
        'Amostra pequena demais para o yield. E mesmo com muitos mais picks ele continuaria dizendo pouco: é a métrica mais barulhenta que existe neste mercado.',
      no_distinguible:
        'Este yield não se distingue de zero. Não é lucro comprovado nem prejuízo comprovado: é ruído até que a amostra diga o contrário.',
      significativo:
        'Yield estatisticamente significativo. Raro, e ainda assim não é promessa de nada: veja também o CLV.',
      contra:
        'Estatisticamente significativo, mas negativo: com esta amostra, estes picks perdem dinheiro.',
      temprano_favor:
        'Amostra curta, mas o yield já se separa de zero. Não conclua ainda: o yield é a métrica mais barulhenta que existe e precisa de muito mais apostas.',
      temprano_contra:
        'Amostra curta, mas o yield já se separa de zero, e para baixo.',
    },
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
  naturaleza: {
    titulo: 'Qué mide este registro',
    texto:
      'Mide la calidad del pick, no mis apuestas. La cuota guardada es la mejor referencia del mercado en el momento de publicar, y no necesariamente lo que yo pagué: desde España no tengo acceso a todas las casas, y tú no tienes acceso a las mismas que yo. Lo que sí se puede comparar entre países es el lado elegido y el precio al que estaba — y eso es lo que hay aquí. La ventaja se mide contra el mercado más afilado del cierre, hoy Betfair y Matchbook, con márgenes en torno al 0,7 %.',
  },
  vistazo: {
    titulo: 'De un vistazo',
    picks: 'picks con cierre',
    resueltos: 'ya liquidados',
  },
  liston: {
    texto:
      'Para que la ventaja se ponga en positivo, tu CLV tiene que superar el margen medio de tus mercados: {margen}. Vas por {clv}.',
    alcanzado:
      'Tu CLV ({clv}) ya supera el margen medio de tus mercados ({margen}): por eso la ventaja es positiva.',
  },
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
    clvBruto: 'CLV',
    margen: 'Margen medio',
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
    temprano_favor:
      'Muestra corta, pero la señal ya es fuerte y a favor. Todavía no es conclusión — con pocos picks el estadístico es frágil y las apuestas del mismo día no son del todo independientes.',
    temprano_contra:
      'Muestra corta, pero la señal ya es fuerte y EN CONTRA. Con estos números, estos picks están perdiendo valor de una forma difícil de explicar por mala suerte.',
  },
  ayudas: {
    n: 'Picks cuyo cierre ya capturó el proveedor. Solo esos entran en las cuentas.',
    clvBruto:
      'Tu cuota contra la de cierre, precio contra precio. El margen está en las dos y se cancela: lo que queda es si cogiste mejor precio del que acabó dando el mercado.',
    margen:
      'Lo que cobran las casas, de media, en los mercados donde apostaste. Es exactamente la distancia entre las dos métricas de arriba.',
    ventajaMedia:
      'Cuánto mejor (o peor) fue tu cuota que el precio justo del cierre, ya sin el margen de la casa. Cero es pagar el precio correcto.',
    tasaAcierto:
      'Cuántos picks cogieron un precio mejor que el justo. No es cuántos ganaron: es cuántos valían la pena.',
    t: 'Cuántas desviaciones está la media de cero. Por encima de 1,96 o por debajo de -1,96 es difícil de explicar por azar.',
  },
  dosPreguntas: {
    titulo: 'Dos preguntas que no son la misma',
    bruto:
      '¿Cogí mejor precio que el de cierre? Compara dos precios reales. El margen está en los dos y se cancela, así que esto mide el momento y la elección de casa.',
    ventaja:
      '¿Esta apuesta tenía valor esperado positivo? Compara tu precio con el precio justo. El margen entra entero, y por eso empuja a todo el mundo hacia abajo por igual.',
    conclusion:
      'Para ganar dinero no basta con batir el cierre: hay que batirlo por más que el margen.',
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
    justa: 'Cuota justa',
    bruto: 'CLV',
    ventaja: 'Ventaja',
    esperando: 'esperando',
    sinCierre: 'línea movida, sin cierre',
    interpolado: 'línea movida: precio interpolado entre las vecinas',
    extrapolado: 'línea movida: precio extrapolado de las vecinas',
    cota: 'línea movida: CLV medido por lo bajo',
    invalido: 'no pasa la auditoría',
    selloIlegible: 'sello antiguo, no verificable',
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
    veredictos: {
      muestra_insuficiente:
        'Muestra demasiado pequeña para el yield. Y con muchos más picks seguiría diciendo poco: es la métrica más ruidosa que existe en este mercado.',
      no_distinguible:
        'Este yield no se distingue de cero. No es beneficio demostrado ni pérdida demostrada: es ruido hasta que la muestra diga otra cosa.',
      significativo:
        'Yield estadísticamente significativo. Es raro, y aun así no promete nada: mira también el CLV.',
      contra:
        'Estadísticamente significativo, pero negativo: con esta muestra, estos picks pierden dinero.',
      temprano_favor:
        'Muestra corta, pero el yield ya se separa de cero. No concluyas todavía: el yield es la métrica más ruidosa que existe y necesita muchas más apuestas.',
      temprano_contra:
        'Muestra corta, pero el yield ya se separa de cero, y hacia abajo.',
    },
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
  naturaleza: {
    titulo: 'What this record measures',
    texto:
      'It measures pick quality, not my bets. The odds stored are the best market reference at the moment of publishing, not necessarily what I paid: from Spain I cannot reach every book, and you cannot reach the same ones I can. What does compare across countries is the side chosen and the price it was at — and that is what is here. Edge is measured against the sharpest closing market, today Betfair and Matchbook, with margins around 0.7 %.',
  },
  vistazo: {
    titulo: 'At a glance',
    picks: 'picks with a close',
    resueltos: 'already settled',
  },
  liston: {
    texto:
      'For the edge to turn positive, your CLV has to clear the average margin of your markets: {margen}. You are at {clv}.',
    alcanzado:
      'Your CLV ({clv}) already clears the average margin of your markets ({margen}) — that is why the edge is positive.',
  },
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
    clvBruto: 'CLV',
    margen: 'Average margin',
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
    temprano_favor:
      'Short sample, but the signal is already strong and in your favour. Not a conclusion yet — with few picks the statistic is fragile and bets from the same day are not fully independent.',
    temprano_contra:
      'Short sample, but the signal is already strong and AGAINST. On these numbers, these picks are losing value in a way that is hard to explain by bad luck.',
  },
  ayudas: {
    n: 'Picks whose closing line the provider has already captured. Only those count.',
    clvBruto:
      'Your odds against the closing odds, price versus price. The margin is in both and cancels out: what is left is whether you got a better price than the market ended up giving.',
    margen:
      'What the books charge, on average, in the markets you bet. It is exactly the distance between the two metrics above.',
    ventajaMedia:
      'How much better (or worse) your odds were than the fair closing price, with the margin removed. Zero means paying the right price.',
    tasaAcierto:
      'How many picks got a better price than fair. Not how many won: how many were worth taking.',
    t: 'How many deviations the mean is from zero. Above 1.96 or below -1.96 is hard to explain by chance.',
  },
  dosPreguntas: {
    titulo: 'Two questions that are not the same',
    bruto:
      'Did I get a better price than the close? It compares two real prices. The margin is in both and cancels, so this measures timing and choice of book.',
    ventaja:
      'Did this bet have positive expected value? It compares your price to the fair price. The margin enters in full, which is why it pushes everyone down equally.',
    conclusion:
      'To make money it is not enough to beat the close: you have to beat it by more than the margin.',
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
    justa: 'Fair odds',
    bruto: 'CLV',
    ventaja: 'Edge',
    esperando: 'awaiting',
    sinCierre: 'line moved, no close',
    interpolado: 'line moved: price interpolated between neighbours',
    extrapolado: 'line moved: price extrapolated from neighbours',
    cota: 'line moved: CLV measured as a floor',
    invalido: 'fails audit',
    selloIlegible: 'old seal, not verifiable',
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
    veredictos: {
      muestra_insuficiente:
        'Sample far too small for a yield. And with many more picks it would still say little: it is the noisiest metric in this market.',
      no_distinguible:
        'This yield is not distinguishable from zero. It is neither proven profit nor proven loss: it is noise until the sample says otherwise.',
      significativo:
        'Statistically significant yield. That is rare, and it still promises nothing: look at the CLV too.',
      contra:
        'Statistically significant, but negative: on this sample, these picks lose money.',
      temprano_favor:
        'Short sample, but the yield already separates from zero. Do not conclude yet: yield is the noisiest metric there is and needs far more bets.',
      temprano_contra: 'Short sample, but the yield already separates from zero, and downwards.',
    },
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
