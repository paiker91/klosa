/**
 * Textos de la interfaz en los tres idiomas.
 *
 * Contenido real, no relleno: el bloque explicativo de debajo de la calculadora
 * es la mitad del motivo por el que la página existe (la otra mitad es calcular).
 */
import type { Locale } from './config';

export interface Textos {
  meta: { titulo: string; descripcion: string };
  h1: string;
  entradilla: string;
  campos: {
    cuotaTomada: string;
    cuotaTomadaAyuda: string;
    cierreTomado: string;
    cierreTomadoAyuda: string;
    cierreContrario: string;
    cierreContrarioAyuda: string;
    metodo: string;
    calcular: string;
    ejemplo: string;
    limpiar: string;
    /** Fútbol: hay que meter también el cierre del empate. */
    tresVias: string;
    cierreEmpate: string;
    cierreEmpateAyuda: string;
    /** Se ve mientras faltan campos: la calculadora no espera a un botón. */
    incompleto: string;
  };
  metodos: { multiplicativo: string; power: string; aditivo: string };
  resultado: {
    cogioValor: string;
    noCogioValor: string;
    ventaja: string;
    ventajaExplicacion: string;
    clvBruto: string;
    clvBrutoExplicacion: string;
    cuotaJusta: string;
    margen: string;
    supuesto: string;
  };
  /** Modo automático: nosotros ponemos la línea de cierre. */
  buscar: {
    pestana: string;
    intro: string;
    cobertura: string;
    deporte: string;
    partido: string;
    lado: string;
    elegir: string;
    cargando: string;
    sinPartidos: string;
    /** Lleva {fecha}. Se ve cuando la competición no ha jugado en 3 días. */
    proximo: string;
    sinCierre: string;
    sinCuota: string;
    fallo: string;
    /** Lleva {n} (casas) y {fecha}. */
    fuente: string;
    fechamento: string;
    incompleto: string;
  };
  errores: { titulo: string };
  contenido: Array<{ titulo: string; parrafos: string[] }>;
}

const pt: Textos = {
  meta: {
    titulo: 'Calculadora de CLV — você pegou valor ou não?',
    descripcion:
      'Calcule o Closing Line Value das suas apostas removendo a margem da casa. Descubra se você tem vantagem real ou apenas sorte. Grátis, sem cadastro.',
  },
  h1: 'Calculadora de CLV',
  entradilla:
    'Compare a odd que você pegou com a odd de fechamento, já sem a margem da casa. É a forma mais rápida de saber se você tem vantagem — o lucro leva milhares de apostas para dizer alguma coisa; o CLV, muito menos.',
  campos: {
    cuotaTomada: 'Odd que você pegou',
    cuotaTomadaAyuda: 'Aceita vírgula (1,90) e formato americano (+150).',
    cierreTomado: 'Odd de fechamento do seu lado',
    cierreTomadoAyuda: 'A odd final do mercado que você apostou.',
    cierreContrario: 'Odd de fechamento do outro lado',
    cierreContrarioAyuda: 'Serve para calcular a margem da casa e tirar ela do cálculo.',
    metodo: 'Método de remoção da margem',
    calcular: 'Calcular',
    ejemplo: 'Preencher com um exemplo',
    limpiar: 'Limpar',
    tresVias: 'Futebol (tem empate)',
    cierreEmpate: 'Odd de fechamento do empate',
    cierreEmpateAyuda: 'No futebol são três resultados. Sem o empate, a margem sai errada.',
    incompleto: 'Preencha as três odds e o resultado aparece aqui na hora.',
  },
  metodos: {
    multiplicativo: 'Multiplicativo (padrão)',
    power: 'Power (melhor para odds altas)',
    aditivo: 'Aditivo (comparação)',
  },
  resultado: {
    cogioValor: 'Você pegou valor',
    noCogioValor: 'Você não pegou valor',
    ventaja: 'Vantagem sobre o fechamento justo',
    ventajaExplicacion: 'Essa é a métrica que estima a vantagem real.',
    clvBruto: 'CLV bruto',
    clvBrutoExplicacion: 'Compara com a odd de fechamento sem tirar a margem. Exagera o resultado.',
    cuotaJusta: 'Odd justa de fechamento',
    margen: 'Margem da casa detectada',
    supuesto:
      'O cálculo assume que a linha de fechamento, sem a margem, é a melhor estimativa disponível da probabilidade real. É a premissa padrão do setor, mas é uma premissa.',
  },
  buscar: {
    pestana: 'A gente busca',
    intro:
      'Escolha o jogo e o lado, diga a odd que você pegou e nós buscamos a linha de fechamento. Você não precisa anotar nada nem procurar em lugar nenhum.',
    cobertura:
      'Brasileirão (A e B), Libertadores, Sul-Americana, as grandes ligas europeias, NBA, Euroliga e MLB. Jogos dos últimos 3 dias, mercado de resultado. O fechamento é a mediana das casas, não a melhor odd: a melhor de trinta casas bate o fechamento quase sempre e daria vantagem de mentira.',
    deporte: 'Competição',
    partido: 'Jogo',
    lado: 'Seu lado',
    elegir: 'Escolha…',
    cargando: 'Buscando…',
    sinPartidos: 'Nenhum jogo dessa competição começou nos últimos 3 dias.',
    proximo: 'A janela do provedor é de 3 dias e liga de futebol joga uma vez por semana. O próximo jogo é em {fecha}: depois que ele começar, o fechamento aparece aqui.',
    sinCierre:
      'Não achamos o fechamento desse jogo. Pode ser que ele tenha começado agora mesmo. Dá para usar a aba manual.',
    sinCuota:
      'A cota de consultas do provedor está reservada para o registro público. Tente mais tarde ou use a aba manual.',
    fallo: 'Não deu para falar com o provedor de odds agora. A aba manual continua funcionando.',
    fuente: 'mediana de {n} casas · {fecha}',
    fechamento: 'Fechamento encontrado',
    incompleto: 'Escolha um jogo e digite a odd que você pegou.',
  },
  errores: { titulo: 'Não foi possível calcular' },
  contenido: [
    {
      titulo: 'O que é CLV',
      parrafos: [
        'CLV significa Closing Line Value: a diferença entre a odd que você pegou e a odd na qual o mercado fechou. Se você aposta consistentemente acima da linha de fechamento, está encontrando preço antes do mercado.',
        'É o indicador mais próximo de uma medida de habilidade que existe nas apostas esportivas, e é justamente por isso que as casas usam ele para decidir quem limitar.',
      ],
    },
    {
      titulo: 'Por que o CLV importa mais que o lucro',
      parrafos: [
        'O lucro acumulado tem uma variância enorme. Um apostador sem nenhuma vantagem pode passar meses no positivo, e um com vantagem real pode passar meses no negativo. Para que o lucro diga alguma coisa com segurança, são necessárias milhares de apostas.',
        'O CLV precisa de muito menos, porque mede cada aposta contra uma referência objetiva em vez de contra o resultado. Você não precisa esperar o jogo terminar para saber se pegou preço.',
      ],
    },
    {
      titulo: 'O que é a margem e por que removê-la',
      parrafos: [
        'Se você somar as probabilidades implícitas dos dois lados de um mercado, o resultado passa de 100%. Esse excedente é a margem da casa. Num mercado 1,90 / 1,90, a soma dá 105,26%: a margem é de 5,26%.',
        'Comparar sua odd com a odd de fechamento sem remover a margem exagera o CLV, porque parte do que parece vantagem é apenas a comissão da casa. Por isso a calculadora remove a margem primeiro.',
      ],
    },
    {
      titulo: 'Quantas apostas são necessárias para concluir algo',
      parrafos: [
        'Mais do que você imagina. Com menos de 100 apostas, praticamente nenhum resultado é conclusivo, por maior que pareça. Um retorno de +18,7% em 58 apostas é ruído.',
        'No modo agregado, essa calculadora mostra o valor de t e diz claramente quando a amostra não permite concluir nada. Nenhuma outra calculadora do mercado faz isso, e é justamente a informação de que você mais precisa.',
      ],
    },
  ],
};

const es: Textos = {
  meta: {
    titulo: 'Calculadora de CLV — ¿cogiste valor o no?',
    descripcion:
      'Calcula el Closing Line Value de tus apuestas quitando el margen de la casa. Descubre si tienes ventaja real o solo suerte. Gratis, sin registro.',
  },
  h1: 'Calculadora de CLV',
  entradilla:
    'Compara la cuota que cogiste con la cuota de cierre, ya sin el margen de la casa. Es la forma más rápida de saber si tienes ventaja: el beneficio necesita miles de apuestas para decir algo; el CLV, muchísimas menos.',
  campos: {
    cuotaTomada: 'Cuota que cogiste',
    cuotaTomadaAyuda: 'Acepta coma (1,90) y formato americano (+150).',
    cierreTomado: 'Cuota de cierre de tu lado',
    cierreTomadoAyuda: 'La cuota final del mercado que apostaste.',
    cierreContrario: 'Cuota de cierre del otro lado',
    cierreContrarioAyuda: 'Hace falta para calcular el margen de la casa y quitarlo.',
    metodo: 'Método para quitar el margen',
    calcular: 'Calcular',
    ejemplo: 'Rellenar con un ejemplo',
    limpiar: 'Limpiar',
    tresVias: 'Fútbol (hay empate)',
    cierreEmpate: 'Cuota de cierre del empate',
    cierreEmpateAyuda: 'En fútbol son tres resultados. Sin el empate, el margen sale mal.',
    incompleto: 'Rellena las tres cuotas y el resultado aparece aquí al momento.',
  },
  metodos: {
    multiplicativo: 'Multiplicativo (por defecto)',
    power: 'Power (mejor con cuotas altas)',
    aditivo: 'Aditivo (comparación)',
  },
  resultado: {
    cogioValor: 'Cogiste valor',
    noCogioValor: 'No cogiste valor',
    ventaja: 'Ventaja sobre el cierre justo',
    ventajaExplicacion: 'Esta es la métrica que estima la ventaja real.',
    clvBruto: 'CLV bruto',
    clvBrutoExplicacion: 'Compara contra la cuota de cierre sin quitar el margen. Exagera el resultado.',
    cuotaJusta: 'Cuota justa de cierre',
    margen: 'Margen de la casa detectado',
    supuesto:
      'El cálculo asume que la línea de cierre, sin el margen, es la mejor estimación disponible de la probabilidad real. Es el supuesto estándar del sector, pero es un supuesto.',
  },
  buscar: {
    pestana: 'Lo buscamos',
    intro:
      'Elige el partido y el lado, di la cuota que cogiste y nosotros buscamos la línea de cierre. No tienes que apuntar nada ni buscarla en ningún sitio.',
    cobertura:
      'Brasileirão (A y B), Libertadores, Sudamericana, las grandes ligas europeas, NBA, Euroliga y MLB. Partidos de los últimos 3 días, mercado de resultado. El cierre es la mediana de las casas, no la mejor cuota: la mejor de treinta casas bate al cierre casi siempre y daría una ventaja de mentira.',
    deporte: 'Competición',
    partido: 'Partido',
    lado: 'Tu lado',
    elegir: 'Elige…',
    cargando: 'Buscando…',
    sinPartidos: 'No hay partidos de esa competición empezados en los últimos 3 días.',
    proximo: 'La ventana del proveedor es de 3 días y una liga de fútbol juega una vez por semana. El próximo partido es el {fecha}: en cuanto empiece, el cierre aparece aquí.',
    sinCierre:
      'No encontramos el cierre de ese partido. Puede que acabe de empezar. Puedes usar la pestaña manual.',
    sinCuota:
      'La cuota de consultas del proveedor está reservada para el registro público. Prueba más tarde o usa la pestaña manual.',
    fallo: 'No se ha podido hablar con el proveedor de cuotas ahora mismo. La pestaña manual sigue funcionando.',
    fuente: 'mediana de {n} casas · {fecha}',
    fechamento: 'Cierre encontrado',
    incompleto: 'Elige un partido y escribe la cuota que cogiste.',
  },
  errores: { titulo: 'No se ha podido calcular' },
  contenido: [
    {
      titulo: 'Qué es el CLV',
      parrafos: [
        'CLV son las siglas de Closing Line Value: la diferencia entre la cuota que cogiste y la cuota a la que cerró el mercado. Si apuestas de forma consistente por encima de la línea de cierre, estás encontrando precio antes que el mercado.',
        'Es lo más parecido a una medida de habilidad que existe en las apuestas deportivas, y por eso las casas lo usan precisamente para identificar a quién limitar.',
      ],
    },
    {
      titulo: 'Por qué el CLV importa más que el beneficio',
      parrafos: [
        'El beneficio acumulado tiene una varianza enorme. Un apostante sin ninguna ventaja puede pasar meses en positivo, y uno con ventaja real puede pasar meses en negativo. Para que el beneficio diga algo con seguridad hacen falta miles de apuestas.',
        'El CLV necesita muchísimas menos, porque mide cada apuesta contra una referencia objetiva en lugar de contra el resultado. No hace falta esperar a que termine el partido para saber si cogiste precio.',
      ],
    },
    {
      titulo: 'Qué es el margen y por qué hay que quitarlo',
      parrafos: [
        'Si sumas las probabilidades implícitas de los dos lados de un mercado, el resultado pasa del 100 %. Ese exceso es el margen de la casa. En un mercado 1,90 / 1,90 la suma da 105,26 %: el margen es del 5,26 %.',
        'Comparar tu cuota contra la de cierre sin quitar el margen exagera el CLV, porque parte de lo que parece ventaja es solo la comisión de la casa. Por eso la calculadora quita el margen primero.',
      ],
    },
    {
      titulo: 'Cuántas apuestas hacen falta para concluir algo',
      parrafos: [
        'Más de las que crees. Por debajo de 100 apuestas prácticamente ningún resultado es concluyente, por grande que parezca. Un +18,7 % en 58 apuestas es ruido.',
        'En el modo agregado, esta calculadora te da el valor de t y te dice claramente cuándo la muestra no permite concluir nada. Ninguna otra calculadora del mercado hace eso, y es justo el dato que más necesitas.',
      ],
    },
  ],
};

const en: Textos = {
  meta: {
    titulo: 'CLV Calculator — did you beat the closing line?',
    descripcion:
      'Calculate the Closing Line Value of your bets with the bookmaker margin removed. Find out whether you have a real edge or just variance. Free, no signup.',
  },
  h1: 'CLV Calculator',
  entradilla:
    'Compare the odds you took against the closing odds, with the bookmaker margin stripped out. It is the fastest way to know whether you have an edge: profit needs thousands of bets to mean anything, CLV needs far fewer.',
  campos: {
    cuotaTomada: 'Odds you took',
    cuotaTomadaAyuda: 'Accepts decimal (1.90) and American format (+150).',
    cierreTomado: 'Closing odds, your side',
    cierreTomadoAyuda: 'The final odds on the side you bet.',
    cierreContrario: 'Closing odds, other side',
    cierreContrarioAyuda: 'Needed to work out the margin and remove it.',
    metodo: 'Margin removal method',
    calcular: 'Calculate',
    ejemplo: 'Fill in an example',
    limpiar: 'Clear',
    tresVias: 'Football (has a draw)',
    cierreEmpate: 'Closing odds for the draw',
    cierreEmpateAyuda: 'Football has three outcomes. Without the draw the margin comes out wrong.',
    incompleto: 'Fill in the three odds and the result appears here straight away.',
  },
  metodos: {
    multiplicativo: 'Multiplicative (default)',
    power: 'Power (better at long odds)',
    aditivo: 'Additive (for comparison)',
  },
  resultado: {
    cogioValor: 'You beat the fair line',
    noCogioValor: 'You did not beat the fair line',
    ventaja: 'Edge over the fair closing line',
    ventajaExplicacion: 'This is the metric that estimates your real edge.',
    clvBruto: 'Raw CLV',
    clvBrutoExplicacion: 'Compares against the closing odds with the margin left in. It overstates the result.',
    cuotaJusta: 'Fair closing odds',
    margen: 'Detected bookmaker margin',
    supuesto:
      'The calculation assumes the closing line, once the margin is removed, is the best available estimate of the true probability. That is the standard assumption in the field, but it is an assumption.',
  },
  buscar: {
    pestana: 'We look it up',
    intro:
      'Pick the game and the side, tell us the odds you took and we fetch the closing line. You do not have to record anything or look it up anywhere.',
    cobertura:
      'Brasileirão (A and B), Libertadores, Sudamericana, the big European leagues, NBA, Euroleague and MLB. Games from the last 3 days, match result market. The close is the median across bookmakers, not the best price: the best of thirty books beats the close almost always and would hand you a fake edge.',
    deporte: 'Competition',
    partido: 'Game',
    lado: 'Your side',
    elegir: 'Choose…',
    cargando: 'Looking up…',
    sinPartidos: 'No games in that competition have started in the last 3 days.',
    proximo: 'The provider window is 3 days and a football league plays once a week. The next game is on {fecha}: once it starts, the close shows up here.',
    sinCierre:
      'We could not find the close for that game. It may have just started. You can use the manual tab.',
    sinCuota:
      'The provider request quota is reserved for the public record. Try later or use the manual tab.',
    fallo: 'We could not reach the odds provider right now. The manual tab still works.',
    fuente: 'median of {n} books · {fecha}',
    fechamento: 'Closing line found',
    incompleto: 'Pick a game and type the odds you took.',
  },
  errores: { titulo: 'Could not calculate' },
  contenido: [
    {
      titulo: 'What CLV is',
      parrafos: [
        'CLV stands for Closing Line Value: the gap between the odds you took and the odds the market closed at. If you consistently bet above the closing line, you are finding price before the market does.',
        'It is the closest thing to a measure of skill that exists in sports betting, which is exactly why bookmakers use it to decide who to limit.',
      ],
    },
    {
      titulo: 'Why CLV matters more than profit',
      parrafos: [
        'Cumulative profit has enormous variance. A bettor with no edge can spend months in profit, and one with a real edge can spend months down. For profit to tell you anything reliable you need thousands of bets.',
        'CLV needs far fewer, because it measures each bet against an objective reference rather than against the outcome. You do not have to wait for the game to finish to know whether you got a price.',
      ],
    },
    {
      titulo: 'What the margin is and why it has to go',
      parrafos: [
        'Add up the implied probabilities on both sides of a market and the total comes to more than 100%. That excess is the bookmaker margin. In a 1.90 / 1.90 market the total is 105.26%, so the margin is 5.26%.',
        'Comparing your odds against the closing odds without removing the margin overstates CLV, because part of what looks like edge is just the bookmaker commission. So the calculator strips it out first.',
      ],
    },
    {
      titulo: 'How many bets you need before concluding anything',
      parrafos: [
        'More than you think. Below 100 bets almost no result is conclusive, however large it looks. A +18.7% return over 58 bets is noise.',
        'In aggregate mode this calculator gives you the t value and tells you plainly when the sample does not support any conclusion. No other calculator does that, and it is the number you most need.',
      ],
    },
  ],
};

export const TEXTOS: Record<Locale, Textos> = { pt, es, en };
