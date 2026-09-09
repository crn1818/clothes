import { paletteStats, type PaletteColor } from './extract';
import { deltaE, hexToLab, labToHex, type Lab } from './oklab';
import { HUE_FAMILY_LABEL, familyOf, nameOf, type HueFamily } from './names';

/**
 * Classificação da paleta inteira de um look.
 *
 * As famílias de matiz (azuis, marrons...) respondem "que cor tem"; estas
 * respondem "que clima tem", que é o jeito como as pessoas de fato procuram
 * roupa — "quero um look terroso", não "quero um look #A2663C".
 */
export type PaletteFamily =
  | 'neutra'
  | 'terrosa'
  | 'pastel'
  | 'vibrante'
  | 'escura'
  | 'clara'
  | 'monocromatica'
  | 'quente'
  | 'fria'
  | 'contraste';

interface FamilyMeta {
  label: string;
  hint: string;
  /** Três cores só para desenhar o chip do filtro. */
  swatch: [string, string, string];
}

export const PALETTE_FAMILY_META: Record<PaletteFamily, FamilyMeta> = {
  neutra: {
    label: 'Neutra',
    hint: 'Pouca cor, muito tom — bege, cinza, off-white.',
    swatch: ['#E7DED0', '#B7ADA0', '#6E675F'],
  },
  terrosa: {
    label: 'Terrosa',
    hint: 'Barro, madeira e ferrugem.',
    swatch: ['#DCC9AF', '#B3613B', '#4C3122'],
  },
  pastel: {
    label: 'Pastel',
    hint: 'Cores lavadas, de baixa intensidade.',
    swatch: ['#F2D3D9', '#C4DAEB', '#A6DDC0'],
  },
  vibrante: {
    label: 'Vibrante',
    hint: 'Pelo menos uma cor gritando.',
    swatch: ['#E4368C', '#EFC31C', '#25439E'],
  },
  escura: {
    label: 'Escura',
    hint: 'Tudo em tom baixo.',
    swatch: ['#1F1F21', '#18243F', '#3D2A1D'],
  },
  clara: {
    label: 'Clara',
    hint: 'Tudo em tom alto.',
    swatch: ['#FFFFFF', '#F0E4CC', '#E9EEF1'],
  },
  monocromatica: {
    label: 'Monocromática',
    hint: 'Uma família de cor só, em variações.',
    swatch: ['#C4DAEB', '#4C6FA0', '#18243F'],
  },
  quente: {
    label: 'Quente',
    hint: 'Puxa para vermelho, laranja e amarelo.',
    swatch: ['#E8712A', '#C6A027', '#8C3A2E'],
  },
  fria: {
    label: 'Fria',
    hint: 'Puxa para azul, verde e roxo.',
    swatch: ['#9BB7D4', '#177F5F', '#25439E'],
  },
  contraste: {
    label: 'Alto contraste',
    hint: 'Claro e escuro brigando na mesma foto.',
    swatch: ['#FFFFFF', '#9B9B99', '#0F0F10'],
  },
};

export const PALETTE_FAMILY_ORDER: PaletteFamily[] = [
  'neutra',
  'terrosa',
  'pastel',
  'vibrante',
  'clara',
  'escura',
  'quente',
  'fria',
  'monocromatica',
  'contraste',
];

/**
 * Decide a que famílias uma paleta pertence. Um look pode ser terroso E
 * quente E escuro ao mesmo tempo — por isso devolve uma lista, e é por isso
 * que o filtro pode combinar chips.
 */
export function paletteFamilies(colors: PaletteColor[]): PaletteFamily[] {
  if (colors.length === 0) return [];

  const { avgL, avgC, maxC, spreadL, hueSpread, warmth, neutralShare } =
    paletteStats(colors);
  const out: PaletteFamily[] = [];

  // "Neutro" é quando quase todo o look é tom, não cor — e isso se mede pela
  // fatia neutra, não pela média: uma média baixa também sai de um look com
  // uma cor forte pequena no meio de muito bege.
  if (neutralShare > 0.72) out.push('neutra');

  const chromatic = avgC >= 0.04 || maxC >= 0.09;

  // Terroso é barro: quente E abafado. O teto de croma é o que separa
  // terracota de pink — sem ele, qualquer look quente e forte cai aqui.
  if (chromatic && warmth > 0.3 && maxC < 0.15 && avgL < 0.82) {
    const earthy = colors.filter(
      (c) => c.family === 'marrom' || c.family === 'laranja' || c.family === 'amarelo',
    );
    const earthShare = earthy.reduce((s, c) => s + c.share, 0);
    if (earthShare > 0.35) out.push('terrosa');
  }

  // Pastel se mede pela cor mais forte do look: existe cor, mas nenhuma grita.
  if (avgL > 0.72 && maxC >= 0.04 && maxC < 0.13) out.push('pastel');
  if (maxC > 0.155) out.push('vibrante');
  if (avgL > 0.78) out.push('clara');
  if (avgL < 0.38) out.push('escura');

  if (chromatic && warmth > 0.3 && !out.includes('terrosa')) out.push('quente');
  if (chromatic && warmth < -0.15) out.push('fria');

  if (hueSpread < 0.2 && chromatic) out.push('monocromatica');
  else if (!chromatic && spreadL < 0.3) out.push('monocromatica');

  if (spreadL > 0.55) out.push('contraste');

  // Nenhuma regra pegou: cai no clima mais próximo em vez de ficar sem etiqueta.
  if (out.length === 0) out.push(warmth >= 0 ? 'quente' : 'fria');

  return PALETTE_FAMILY_ORDER.filter((f) => out.includes(f)).slice(0, 3);
}

/** Famílias de matiz presentes, ordenadas por quanto ocupam do look. */
export function hueFamilies(colors: PaletteColor[]): HueFamily[] {
  const totals = new Map<HueFamily, number>();
  for (const c of colors) totals.set(c.family, (totals.get(c.family) ?? 0) + c.share);
  return [...totals.entries()]
    .filter(([, share]) => share >= 0.12)
    .sort((a, b) => b[1] - a[1])
    .map(([family]) => family);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function listar(itens: string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * A frase que aparece ao lado da foto assim que a paleta sai.
 *
 * É o "descreva as cores para mim" do app: ninguém quer ler seis códigos hex,
 * quer ler "paleta terrosa e quente".
 */
export function describePalette(colors: PaletteColor[]): string {
  if (colors.length === 0) return 'Ainda sem paleta.';

  const familias = paletteFamilies(colors);
  const clima = listar(
    familias.map((f) => PALETTE_FAMILY_META[f].label.toLowerCase()),
  );

  const dominante = colors[0];

  if (colors.length === 1) {
    return `Look inteiro em ${dominante.name} — paleta ${clima}.`;
  }

  const restantes = colors.slice(1, 3).map((c) => c.name);
  const sobra = colors.length - 3;
  const cauda = listar([...restantes, ...(sobra > 0 ? [`mais ${sobra}`] : [])]);

  return `Paleta ${clima}: ${dominante.name} domina (${pct(dominante.share)}), com ${cauda}.`;
}

/** Resumo curto para o cabeçalho de um post no feed. */
export function shortDescription(colors: PaletteColor[]): string {
  if (colors.length === 0) return '';
  const familias = paletteFamilies(colors);
  const clima = familias.map((f) => PALETTE_FAMILY_META[f].label).join(' · ');
  return clima;
}

/**
 * Funde as paletas de vários looks numa só — "a paleta de quem você é".
 *
 * Não é a média das cores (isso daria um cinza-lama), e sim um agrupamento:
 * cores que o olho leria como a mesma somam presença, e sobram as que a pessoa
 * realmente repete.
 */
export function resumirPaletas(listas: PaletteColor[][], max = 6): PaletteColor[] {
  const grupos: { lab: Lab; peso: number }[] = [];

  for (const lista of listas) {
    for (const cor of lista) {
      const lab = hexToLab(cor.hex);
      const perto = grupos.find((g) => deltaE(g.lab, lab) < 0.085);
      if (perto) {
        const total = perto.peso + cor.share;
        perto.lab = {
          L: (perto.lab.L * perto.peso + lab.L * cor.share) / total,
          a: (perto.lab.a * perto.peso + lab.a * cor.share) / total,
          b: (perto.lab.b * perto.peso + lab.b * cor.share) / total,
        };
        perto.peso = total;
      } else {
        grupos.push({ lab, peso: cor.share });
      }
    }
  }

  const principais = grupos.sort((a, b) => b.peso - a.peso).slice(0, max);
  const total = principais.reduce((s, g) => s + g.peso, 0) || 1;

  return principais.map((g) => {
    const hex = labToHex(g.lab);
    return { hex, name: nameOf(hex).name, family: familyOf(hex), share: g.peso / total };
  });
}

/** Texto alternativo da imagem, para quem usa leitor de tela. */
export function altTextFor(colors: PaletteColor[], caption: string): string {
  const base = caption.trim() || 'Look do dia';
  if (colors.length === 0) return base;
  const nomes = listar(colors.slice(0, 3).map((c) => c.name));
  return `${base}. Cores predominantes: ${nomes}.`;
}

export { HUE_FAMILY_LABEL };
