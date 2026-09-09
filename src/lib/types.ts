import type { PaletteColor } from './color/extract';
import type { PaletteFamily } from './color/palettes';
import type { HueFamily } from './color/names';

export type { PaletteColor, PaletteFamily, HueFamily };

/** Categoria da peça etiquetada — vira o ícone dentro da bolinha na foto. */
export type PinCategory =
  | 'top'
  | 'calca'
  | 'vestido'
  | 'casaco'
  | 'calcado'
  | 'bolsa'
  | 'acessorio'
  | 'joia'
  | 'outro';

export const PIN_CATEGORY_LABEL: Record<PinCategory, string> = {
  top: 'Top / camisa',
  calca: 'Calça / short',
  vestido: 'Vestido / saia',
  casaco: 'Casaco',
  calcado: 'Calçado',
  bolsa: 'Bolsa',
  acessorio: 'Acessório',
  joia: 'Joia',
  outro: 'Outro',
};

export const PIN_CATEGORY_ICON: Record<PinCategory, string> = {
  top: '👕',
  calca: '👖',
  vestido: '👗',
  casaco: '🧥',
  calcado: '👟',
  bolsa: '👜',
  acessorio: '🧣',
  joia: '💍',
  outro: '✦',
};

/**
 * Uma peça marcada na foto.
 *
 * `x` e `y` são normalizados (0..1) em relação à imagem, não pixels: a mesma
 * marcação tem que cair no lugar certo no feed, no grid do perfil e na tela
 * cheia, que têm larguras diferentes.
 */
export interface Pin {
  id: string;
  x: number;
  y: number;
  peca: string;
  categoria: PinCategory;
  marca: string;
  /** Onde foi comprada: loja, brechó, cidade, site. */
  onde: string;
  preco: string;
  link: string;
}

export interface Profile {
  id: string;
  handle: string;
  nome: string;
  bio: string;
  /** Avatar é um degradê de duas cores — sem foto, sem upload, sem peso. */
  avatar: [string, string];
  cidade: string;
  demo?: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  createdAt: number;
  caption: string;
  /** Chave da imagem no IndexedDB — é o que vale no modo local. */
  imageId: string;
  /**
   * No modo rede, URLs públicas do storage. Quando presentes, valem no lugar
   * do `imageId`: não há nada para resolver, a `<img>` aponta direto.
   */
  urlFull?: string;
  urlThumb?: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  cores: PaletteColor[];
  familias: PaletteFamily[];
  matizes: HueFamily[];
  descricao: string;
  pins: Pin[];
  curtidas: number;
  curtiuEu: boolean;
  salvo: boolean;
  demo?: boolean;
}

/** Preferências de compressão — quem posta escolhe o equilíbrio. */
export type QualityPreset = 'alta' | 'equilibrada' | 'leve';

export interface Settings {
  quality: QualityPreset;
  tema: 'claro' | 'escuro' | 'sistema';
  mostrarPins: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'equilibrada',
  tema: 'sistema',
  mostrarPins: true,
};

export interface Filtro {
  familias: PaletteFamily[];
  matizes: HueFamily[];
  /** Só posts que têm pelo menos uma peça etiquetada. */
  soComPecas: boolean;
  busca: string;
}

export const FILTRO_VAZIO: Filtro = {
  familias: [],
  matizes: [],
  soComPecas: false,
  busca: '',
};

export function filtroAtivo(f: Filtro): boolean {
  return (
    f.familias.length > 0 || f.matizes.length > 0 || f.soComPecas || f.busca.trim().length > 0
  );
}

/** Acrescenta uma cor ao filtro sem duplicar — clicar duas vezes não some com ela. */
export function comMatiz(f: Filtro, matiz: HueFamily): Filtro {
  return f.matizes.includes(matiz) ? f : { ...f, matizes: [...f.matizes, matiz] };
}

export function comClima(f: Filtro, clima: PaletteFamily): Filtro {
  return f.familias.includes(clima) ? f : { ...f, familias: [...f.familias, clima] };
}

export function novoId(prefixo = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefixo}${rnd}`;
}
