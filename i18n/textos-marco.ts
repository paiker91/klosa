/**
 * Textos del marco: cabecera, pie y piezas visuales compartidas.
 *
 * Separados de `textos.ts` y `textos-registro.ts` porque no pertenecen a
 * ninguna página: se ven en todas, y mezclarlos obligaría a duplicarlos.
 */
import type { Locale } from './config';

export interface TextosMarco {
  nav: {
    calculadora: string;
    registro: string;
    cuenta: string;
    menu: string;
    idioma: string;
    publicar: string;
  };
  marca: { nombre: string; reclamo: string };
  pie: {
    descripcion: string;
    secciones: string;
    proyecto: string;
    codigo: string;
    registro: string;
    panel: string;
    legal: string;
    aviso: string;
  };
  /** Medidor de significancia: se usa igual en el CLV y en el yield. */
  medidor: {
    titulo: string;
    /** Lleva {n} y {total}. */
    progreso: string;
    listo: string;
  };
  /** Comparación visual de cuántas apuestas necesita cada métrica. */
  coste: {
    titulo: string;
    clv: string;
    yield: string;
    /** Lleva {veces}. */
    conclusion: string;
  };
  /** Nube de puntos de la ventaja pick a pick. */
  grafico: {
    titulo: string;
    peor: string;
    mejor: string;
    media: string;
    pie: string;
    vacio: string;
  };
  hero: {
    /** Píldora sobre el titular. */
    distintivo: string;
    verRegistro: string;
    comoFunciona: string;
  };
}

const pt: TextosMarco = {
  nav: {
    calculadora: 'Calculadora',
    registro: 'Registro',
    cuenta: 'Meus picks',
    menu: 'Menu',
    idioma: 'Idioma',
    publicar: 'Publicar pick',
  },
  marca: {
    nombre: 'Klosa',
    reclamo: 'Vantagem, não sorte',
  },
  pie: {
    descripcion:
      'Ferramentas de análise para apostadores. Medimos vantagem pelo CLV, porque o lucro leva milhares de apostas para dizer alguma coisa.',
    secciones: 'Seções',
    proyecto: 'Projeto',
    codigo: 'Código no GitHub',
    registro: 'Registro de picks',
    panel: 'Painel (privado)',
    legal: 'Aviso',
    aviso:
      'A Klosa não é casa de apostas nem intermediária: não aceitamos apostas nem administramos dinheiro. É software de análise. Nada aqui é promessa de lucro. Aposte com responsabilidade — se o jogo virou problema, procure ajuda.',
  },
  medidor: {
    titulo: 'Tamanho da amostra',
    progreso: '{n} de {total} necessárias',
    listo: 'Amostra suficiente para concluir algo',
  },
  coste: {
    titulo: 'Quantas apostas cada métrica precisa',
    clv: 'CLV',
    yield: 'Yield',
    conclusion: 'O yield precisa de cerca de {veces}× mais apostas para dizer o mesmo.',
  },
  grafico: {
    titulo: 'Vantagem pick a pick',
    peor: 'Abaixo do fechamento',
    mejor: 'Acima do fechamento',
    media: 'média',
    pie: 'Cada ponto é um pick. O que importa não é a média: é a largura da nuvem. Quanto mais espalhada, mais picks são necessários para distinguir vantagem de sorte.',
    vacio: 'Ainda não há nenhum pick com fechamento capturado. A nuvem aparece assim que os jogos terminarem.',
  },
  hero: {
    distintivo: 'Grátis · sem cadastro · nada sai do seu navegador',
    verRegistro: 'Ver o registro público',
    comoFunciona: 'Como funciona',
  },
};

const es: TextosMarco = {
  nav: {
    calculadora: 'Calculadora',
    registro: 'Registro',
    cuenta: 'Mis picks',
    menu: 'Menú',
    idioma: 'Idioma',
    publicar: 'Publicar pick',
  },
  marca: {
    nombre: 'Klosa',
    reclamo: 'Ventaja, no suerte',
  },
  pie: {
    descripcion:
      'Herramientas de análisis para apostantes. Medimos la ventaja por CLV, porque el beneficio necesita miles de apuestas para decir algo.',
    secciones: 'Secciones',
    proyecto: 'Proyecto',
    codigo: 'Código en GitHub',
    registro: 'Registro de picks',
    panel: 'Panel (privado)',
    legal: 'Aviso',
    aviso:
      'Klosa no es casa de apuestas ni intermediaria: no aceptamos apuestas ni gestionamos dinero. Es software de análisis. Nada de lo que hay aquí es una promesa de beneficio. Juega con responsabilidad — si el juego se ha vuelto un problema, busca ayuda.',
  },
  medidor: {
    titulo: 'Tamaño de la muestra',
    progreso: '{n} de {total} necesarias',
    listo: 'Muestra suficiente para concluir algo',
  },
  coste: {
    titulo: 'Cuántas apuestas necesita cada métrica',
    clv: 'CLV',
    yield: 'Yield',
    conclusion: 'El yield necesita unas {veces}× más apuestas para decir lo mismo.',
  },
  grafico: {
    titulo: 'Ventaja pick a pick',
    peor: 'Por debajo del cierre',
    mejor: 'Por encima del cierre',
    media: 'media',
    pie: 'Cada punto es un pick. Lo que importa no es la media: es lo ancha que sea la nube. Cuanto más dispersa, más picks hacen falta para distinguir ventaja de suerte.',
    vacio: 'Todavía no hay ningún pick con cierre capturado. La nube aparece en cuanto terminen los partidos.',
  },
  hero: {
    distintivo: 'Gratis · sin registro · nada sale de tu navegador',
    verRegistro: 'Ver el registro público',
    comoFunciona: 'Cómo funciona',
  },
};

const en: TextosMarco = {
  nav: {
    calculadora: 'Calculator',
    registro: 'Record',
    cuenta: 'My picks',
    menu: 'Menu',
    idioma: 'Language',
    publicar: 'Publish pick',
  },
  marca: {
    nombre: 'Klosa',
    reclamo: 'Edge, not luck',
  },
  pie: {
    descripcion:
      'Analysis tools for bettors. We measure edge with CLV, because profit takes thousands of bets to say anything.',
    secciones: 'Sections',
    proyecto: 'Project',
    codigo: 'Code on GitHub',
    registro: 'Pick record',
    panel: 'Panel (private)',
    legal: 'Disclaimer',
    aviso:
      'Klosa is not a bookmaker or an intermediary: we do not accept bets or handle money. It is analysis software. Nothing here is a promise of profit. Gamble responsibly — if betting has become a problem, seek help.',
  },
  medidor: {
    titulo: 'Sample size',
    progreso: '{n} of {total} needed',
    listo: 'Sample large enough to conclude something',
  },
  coste: {
    titulo: 'How many bets each metric needs',
    clv: 'CLV',
    yield: 'Yield',
    conclusion: 'Yield needs about {veces}× more bets to say the same thing.',
  },
  grafico: {
    titulo: 'Edge, pick by pick',
    peor: 'Below the close',
    mejor: 'Above the close',
    media: 'mean',
    pie: 'Each dot is one pick. What matters is not the mean: it is how wide the cloud is. The more spread out, the more picks are needed to tell edge from luck.',
    vacio: 'No picks with a captured close yet. The cloud appears once the games finish.',
  },
  hero: {
    distintivo: 'Free · no sign-up · nothing leaves your browser',
    verRegistro: 'See the public record',
    comoFunciona: 'How it works',
  },
};

export const TEXTOS_MARCO: Record<Locale, TextosMarco> = { pt, es, en };
