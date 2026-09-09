import { hexToLab, hexToLch, deltaE, type Lab } from './oklab';

/**
 * Dicionário de cores em português, com vocabulário de moda.
 *
 * Cada cor extraída de uma foto recebe o nome da entrada mais próxima em
 * OKLab. Por isso o dicionário é denso justamente onde roupa costuma morar
 * (neutros, terrosos, jeans, vinhos) e mais esparso em cores que quase nunca
 * aparecem num look. Um dicionário ralo faria tudo virar "marrom".
 */

/** Família de matiz — é por ela que o filtro "por cor" agrupa os posts. */
export type HueFamily =
  | 'branco'
  | 'cinza'
  | 'preto'
  | 'marrom'
  | 'vermelho'
  | 'laranja'
  | 'amarelo'
  | 'verde'
  | 'azul'
  | 'roxo'
  | 'rosa';

export const HUE_FAMILY_LABEL: Record<HueFamily, string> = {
  branco: 'Brancos',
  cinza: 'Cinzas',
  preto: 'Pretos',
  marrom: 'Marrons',
  vermelho: 'Vermelhos',
  laranja: 'Laranjas',
  amarelo: 'Amarelos',
  verde: 'Verdes',
  azul: 'Azuis',
  roxo: 'Roxos',
  rosa: 'Rosas',
};

/** Cor representativa de cada família, usada nos chips do filtro. */
export const HUE_FAMILY_SWATCH: Record<HueFamily, string> = {
  branco: '#F3EEE4',
  cinza: '#9A9A9A',
  preto: '#1A1A1C',
  marrom: '#7B5334',
  vermelho: '#C0122E',
  laranja: '#E8712A',
  amarelo: '#E9C21B',
  verde: '#3F7D4E',
  azul: '#2C5CA8',
  roxo: '#6B3FA0',
  rosa: '#E07AA4',
};

export const HUE_FAMILY_ORDER: HueFamily[] = [
  'preto',
  'cinza',
  'branco',
  'marrom',
  'vermelho',
  'rosa',
  'laranja',
  'amarelo',
  'verde',
  'azul',
  'roxo',
];

interface NamedColor {
  name: string;
  hex: string;
  family: HueFamily;
}

const DICTIONARY: NamedColor[] = [
  /* --- brancos e quase-brancos --- */
  { name: 'branco', hex: '#FFFFFF', family: 'branco' },
  { name: 'branco-neve', hex: '#F8F8F6', family: 'branco' },
  { name: 'off-white', hex: '#F2EDE4', family: 'branco' },
  { name: 'cru', hex: '#EBE2D2', family: 'branco' },
  { name: 'marfim', hex: '#F4EEDC', family: 'branco' },
  { name: 'creme', hex: '#F0E4CC', family: 'branco' },
  { name: 'gelo', hex: '#E9EEF1', family: 'branco' },
  { name: 'pérola', hex: '#E5E0D6', family: 'branco' },

  /* --- cinzas --- */
  { name: 'cinza-claro', hex: '#CFCFCE', family: 'cinza' },
  { name: 'cinza-perolado', hex: '#D6D3CC', family: 'cinza' },
  { name: 'prata', hex: '#BFC4C7', family: 'cinza' },
  { name: 'cinza', hex: '#9B9B99', family: 'cinza' },
  { name: 'cinza-mescla', hex: '#8C8B87', family: 'cinza' },
  { name: 'cinza-chuva', hex: '#6E7378', family: 'cinza' },
  { name: 'chumbo', hex: '#585C61', family: 'cinza' },
  { name: 'grafite', hex: '#3E4146', family: 'cinza' },

  /* --- pretos --- */
  { name: 'preto', hex: '#0F0F10', family: 'preto' },
  { name: 'preto-suave', hex: '#1F1F21', family: 'preto' },
  { name: 'carvão', hex: '#2C2C2F', family: 'preto' },
  { name: 'preto-tinta', hex: '#141A22', family: 'preto' },

  /* --- neutros quentes e terrosos claros --- */
  { name: 'areia', hex: '#E2D3BB', family: 'marrom' },
  { name: 'bege', hex: '#DCC9AF', family: 'marrom' },
  { name: 'champanhe', hex: '#E8D8BD', family: 'marrom' },
  { name: 'nude', hex: '#E1C2AC', family: 'marrom' },
  { name: 'aveia', hex: '#CFC0A8', family: 'marrom' },
  { name: 'trigo', hex: '#D6BE95', family: 'marrom' },
  { name: 'khaki', hex: '#B0A46C', family: 'marrom' },
  { name: 'taupe', hex: '#8E8175', family: 'marrom' },
  { name: 'camel', hex: '#B4884F', family: 'marrom' },
  { name: 'avelã', hex: '#A5805A', family: 'marrom' },

  /* --- marrons --- */
  { name: 'caramelo', hex: '#A2663C', family: 'marrom' },
  { name: 'canela', hex: '#A66E45', family: 'marrom' },
  { name: 'castanho', hex: '#7A5233', family: 'marrom' },
  { name: 'marrom', hex: '#6A4A31', family: 'marrom' },
  { name: 'tabaco', hex: '#875826', family: 'marrom' },
  { name: 'cacau', hex: '#59392C', family: 'marrom' },
  { name: 'chocolate', hex: '#4C3122', family: 'marrom' },
  { name: 'café', hex: '#3D2A1D', family: 'marrom' },
  { name: 'bronze', hex: '#A87440', family: 'marrom' },
  { name: 'cobre', hex: '#AE6A3B', family: 'marrom' },
  { name: 'oliva-escuro', hex: '#4A4529', family: 'marrom' },

  /* --- laranjas --- */
  { name: 'terracota', hex: '#B3613B', family: 'laranja' },
  { name: 'telha', hex: '#B45A38', family: 'laranja' },
  { name: 'ferrugem', hex: '#9A4A22', family: 'laranja' },
  { name: 'laranja', hex: '#E8712A', family: 'laranja' },
  { name: 'tangerina', hex: '#F08030', family: 'laranja' },
  { name: 'damasco', hex: '#E9A96F', family: 'laranja' },
  { name: 'pêssego', hex: '#F3C3A1', family: 'laranja' },
  { name: 'ocre', hex: '#BE882E', family: 'laranja' },

  /* --- amarelos --- */
  { name: 'mostarda', hex: '#C6A027', family: 'amarelo' },
  { name: 'dourado', hex: '#C7A44B', family: 'amarelo' },
  { name: 'amarelo', hex: '#EFC31C', family: 'amarelo' },
  { name: 'milho', hex: '#E6CF7A', family: 'amarelo' },
  { name: 'amarelo-manteiga', hex: '#EEDB9B', family: 'amarelo' },
  { name: 'limão', hex: '#E2E24C', family: 'amarelo' },

  /* --- verdes --- */
  { name: 'verde-limão', hex: '#A6C43E', family: 'verde' },
  { name: 'verde-abacate', hex: '#7E9A54', family: 'verde' },
  { name: 'verde-oliva', hex: '#6A6A24', family: 'verde' },
  { name: 'verde-militar', hex: '#4C5321', family: 'verde' },
  { name: 'verde-musgo', hex: '#59654F', family: 'verde' },
  { name: 'verde-sálvia', hex: '#9BAE88', family: 'verde' },
  { name: 'verde-menta', hex: '#A6DDC0', family: 'verde' },
  { name: 'verde-água', hex: '#9FD5CD', family: 'verde' },
  { name: 'verde', hex: '#2F8B57', family: 'verde' },
  { name: 'verde-esmeralda', hex: '#177F5F', family: 'verde' },
  { name: 'verde-garrafa', hex: '#14503C', family: 'verde' },

  /* --- azuis --- */
  { name: 'turquesa', hex: '#25A69F', family: 'azul' },
  { name: 'ciano', hex: '#31B2C7', family: 'azul' },
  { name: 'petróleo', hex: '#204C55', family: 'azul' },
  { name: 'azul-bebê', hex: '#C4DAEB', family: 'azul' },
  { name: 'azul-céu', hex: '#90BEE0', family: 'azul' },
  { name: 'azul-serenity', hex: '#9BB7D4', family: 'azul' },
  { name: 'jeans-claro', hex: '#8FA9C6', family: 'azul' },
  { name: 'jeans', hex: '#4C6FA0', family: 'azul' },
  { name: 'jeans-escuro', hex: '#314563', family: 'azul' },
  { name: 'azul', hex: '#2C5CA8', family: 'azul' },
  { name: 'azul-royal', hex: '#25439E', family: 'azul' },
  { name: 'azul-noite', hex: '#232C4C', family: 'azul' },
  { name: 'azul-marinho', hex: '#18243F', family: 'azul' },

  /* --- roxos --- */
  { name: 'lavanda', hex: '#C7BCE0', family: 'roxo' },
  { name: 'lilás', hex: '#B79CD4', family: 'roxo' },
  { name: 'malva', hex: '#AE8AA6', family: 'roxo' },
  { name: 'violeta', hex: '#7A46B3', family: 'roxo' },
  { name: 'roxo', hex: '#6A3FA0', family: 'roxo' },
  { name: 'uva', hex: '#4B2A63', family: 'roxo' },
  { name: 'ameixa', hex: '#5C2C4A', family: 'roxo' },

  /* --- rosas --- */
  { name: 'rosa-bebê', hex: '#F2D3D9', family: 'rosa' },
  { name: 'rosa-chá', hex: '#E4BEBF', family: 'rosa' },
  { name: 'rosa-antigo', hex: '#C68A93', family: 'rosa' },
  { name: 'rosa', hex: '#E47FA6', family: 'rosa' },
  { name: 'salmão', hex: '#EF9E86', family: 'rosa' },
  { name: 'coral', hex: '#EE6F5A', family: 'rosa' },
  { name: 'pink', hex: '#E4368C', family: 'rosa' },
  { name: 'fúcsia', hex: '#D0288A', family: 'rosa' },
  { name: 'magenta', hex: '#C0268C', family: 'rosa' },

  /* --- vermelhos --- */
  { name: 'vermelho', hex: '#C4102E', family: 'vermelho' },
  { name: 'vermelho-tomate', hex: '#D5432F', family: 'vermelho' },
  { name: 'cereja', hex: '#A31432', family: 'vermelho' },
  { name: 'terra-vermelha', hex: '#8C3A2E', family: 'vermelho' },
  { name: 'marsala', hex: '#7A3141', family: 'vermelho' },
  { name: 'vinho', hex: '#6C1226', family: 'vermelho' },
  { name: 'bordô', hex: '#59162A', family: 'vermelho' },
];

interface Entry extends NamedColor {
  lab: Lab;
}

const ENTRIES: Entry[] = DICTIONARY.map((c) => ({ ...c, lab: hexToLab(c.hex) }));

export interface ColorName {
  name: string;
  family: HueFamily;
  /** Distância até a entrada do dicionário — quanto menor, mais exato o nome. */
  distance: number;
}

/**
 * Nome mais próximo para um hex.
 *
 * A luminosidade entra com peso maior que os eixos de matiz porque errar o
 * tom (bege x marrom) incomoda muito mais do que errar a temperatura.
 */
export function nameOf(hex: string): ColorName {
  const lab = hexToLab(hex);
  let best = ENTRIES[0];
  let bestD = Infinity;

  for (const e of ENTRIES) {
    const dL = (lab.L - e.lab.L) * 1.35;
    const da = lab.a - e.lab.a;
    const db = lab.b - e.lab.b;
    const d = Math.sqrt(dL * dL + da * da + db * db);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }

  return { name: best.name, family: best.family, distance: bestD };
}

/**
 * Família de matiz de um hex, decidida pela geometria em OKLCh e não pelo
 * dicionário: cores muito dessaturadas viram preto/cinza/branco independente
 * do nome que tenham recebido.
 */
/*
 * Fronteiras de matiz em OKLCh, medidas e não estimadas.
 *
 * O ângulo de matiz do OKLCh não bate com o do HSL, e chutar os limites pelo
 * hábito do HSL põe cor no balde errado de um jeito que ninguém percebe
 * lendo o código — só usando o filtro. Uma versão anterior mandava jeans
 * (h=259) para "Roxos" e laranja vivo (h=47) para "Amarelos".
 *
 * Âncoras conferidas:
 *   vinho 14 · vermelho 22 · coral 31 · terracota 45 · laranja 47
 *   marrom 59 · camel 72 · bege 76 · mostarda 90 · amarelo 92
 *   verde-limão 121 · verde 155 · ciano 211 · jeans 259 · azul 259
 *   roxo 301 · magenta 346 · pink 356
 */
export function familyOf(hex: string): HueFamily {
  const { L, C, h } = hexToLch(hex);

  if (C < 0.035) {
    if (L < 0.28) return 'preto';
    if (L > 0.86) return 'branco';
    return 'cinza';
  }

  // Faixa quente e abafada: é marrom, não laranja nem amarelo. O teto de croma
  // é o que separa camel (0.09) de laranja (0.17) na mesma vizinhança de matiz.
  if (h >= 35 && h < 105 && C < 0.115 && L < 0.86) return 'marrom';

  if (h >= 330 || h < 8) return 'rosa';
  if (h < 35) return 'vermelho';
  if (h < 68) return 'laranja';
  if (h < 105) return 'amarelo';
  if (h < 180) return 'verde';
  if (h < 285) return 'azul';
  return 'roxo';
}

/** Distância perceptual entre dois hexes — usada para fundir cores parecidas. */
export function hexDistance(a: string, b: string): number {
  return deltaE(hexToLab(a), hexToLab(b));
}
