import { rgbToLab, labToHex, labToLch, deltaE, type Lab } from './oklab';
import { nameOf, familyOf, type HueFamily } from './names';

/** Uma cor dominante da foto, já nomeada e com o quanto ela ocupa do look. */
export interface PaletteColor {
  hex: string;
  /** Nome em português, ex.: "caramelo". */
  name: string;
  family: HueFamily;
  /** Fração do look ocupada por esta cor, 0..1. */
  share: number;
}

export interface ExtractOptions {
  /** Quantas cores devolver, no máximo. */
  max?: number;
  /** Quantos grupos o k-means procura antes de fundir e podar. */
  clusters?: number;
  /** Descarta cores que ocupem menos que isto do look (0..1). */
  minShare?: number;
}

interface Amostra {
  lab: Lab;
  peso: number;
}

/* Gerador pseudoaleatório com semente: a mesma foto sempre dá a mesma paleta. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ==========================================================================
   Separar a roupa do fundo
   ========================================================================== */

/** Espessura do anel amostrado como "provável fundo". */
const ANEL = 0.06;
/** Quanto uma cor precisa ocupar do anel para valer como cor de moldura. */
const MIN_MOLDURA = 0.2;
/** Distância até uma cor de moldura para um pixel da beirada virar semente. */
const TOL_SEMENTE = 0.06;
/**
 * Salto máximo entre pixels vizinhos para o fundo continuar se espalhando.
 *
 * Calibrado medindo o vazamento para dentro da roupa: até 0.018 o fundo é
 * coberto por inteiro e a figura fica intacta; de 0.025 em diante o
 * espalhamento atravessa a borda suavizada das peças e come metade do look.
 * Numa parede lisa a diferença entre pixels vizinhos é ~0.003, então há folga
 * de sobra — a margem existe para ruído de foto de celular.
 */
const TOL_VIZINHO = 0.018;

/**
 * Afastamento máximo entre um pixel e a semente de onde o fundo chegou nele.
 *
 * Só o critério local não basta: numa foto de tons próximos — moletom cinza
 * claro em parede cinza média, tricô lavanda em parede rosa-clara — a borda
 * suavizada da peça é uma escada de degraus pequenos, e o espalhamento sobe a
 * escada inteira. Em look pastel isso chegava a marcar 95% do quadro como
 * fundo. A trava global corta a escada: cada passo continua tendo de ser
 * pequeno, mas o resultado tem de continuar parecido com a parede.
 */
const TOL_SEMENTE_GLOBAL = 0.05;

/**
 * Marca os pixels de fundo por espalhamento a partir da moldura da foto.
 *
 * Esta é a parte que faz a paleta ser do look e não da parede. Numa foto de
 * corpo inteiro o fundo ocupa uns 70% do quadro, então sem separá-lo qualquer
 * contagem por área devolve a cor da parede.
 *
 * Duas tentativas mais simples falharam antes desta, e vale registrar por quê:
 *
 * - **Por semelhança com a cor da borda.** Parede com degradê ou vinheta cobre
 *   uma faixa de tons larga demais para casar com uma amostra só. O que
 *   sobrava era um lilás acinzentado no lugar do tricô lavanda: a média entre
 *   roupa e parede, uma cor que não existe na foto.
 * - **Por posição no quadro** (grupos que vivem nas beiradas). A vinheta
 *   escurece justamente as beiradas, então a parede clara do meio ficava
 *   "central" e sobrevivia com 70% da paleta.
 *
 * O espalhamento local resolve os dois: cada passo compara um pixel com o
 * *vizinho*, e num degradê a diferença entre vizinhos é quase zero — ele
 * atravessa a parede inteira. Já a borda de uma peça de roupa é um salto
 * grande em um ou dois pixels, e o espalhamento para ali.
 *
 * As sementes saem só das cores que dominam o anel externo. É o que impede que
 * um ombro encostando na lateral do quadro — comum em foto de corpo inteiro —
 * vire porta de entrada para o fundo comer a roupa toda.
 */
function marcarFundo(w: number, h: number, labs: Lab[], opaco: Uint8Array): Uint8Array {
  const fundo = new Uint8Array(w * h);
  const faixa = Math.max(1, Math.round(Math.min(w, h) * ANEL));

  const anel: Amostra[] = [];
  for (let y = 0; y < h; y++) {
    const naFaixaY = y < faixa || y >= h - faixa;
    for (let x = 0; x < w; x++) {
      if (!naFaixaY && x >= faixa && x < w - faixa) continue;
      const i = y * w + x;
      if (opaco[i]) anel.push({ lab: labs[i], peso: 1 });
    }
  }
  if (anel.length < 24) return fundo;

  const grupos = kmeans(anel, 3, 8);
  const totalAnel = grupos.reduce((s, g) => s + g.peso, 0) || 1;
  const molduras = grupos
    .filter((g) => g.peso >= totalAnel * MIN_MOLDURA)
    .map((g) => g.lab);
  if (molduras.length === 0) return fundo;

  const perto = (lab: Lab, limite: number) =>
    molduras.some((m) => deltaE(lab, m) < limite);

  const fila: number[] = [];
  /* Cor da semente que alcançou cada pixel, para a trava global. */
  const semente: (Lab | undefined)[] = new Array(w * h);

  for (let y = 0; y < h; y++) {
    const naBeirada = y < 2 || y >= h - 2;
    for (let x = 0; x < w; x++) {
      if (!naBeirada && x >= 2 && x < w - 2) continue;
      const i = y * w + x;
      if (fundo[i]) continue;
      // Pixel transparente é fundo por definição (PNG recortado).
      if (!opaco[i] || perto(labs[i], TOL_SEMENTE)) {
        fundo[i] = 1;
        semente[i] = labs[i];
        fila.push(i);
      }
    }
  }

  // Largura em fila, com ponteiro: `shift()` num array grande é O(n).
  for (let p = 0; p < fila.length; p++) {
    const i = fila[p];
    const x = i % w;
    const y = (i / w) | 0;
    const atual = labs[i];
    const origem = semente[i] ?? atual;

    const visitar = (j: number) => {
      if (fundo[j]) return;
      if (
        !opaco[j] ||
        (deltaE(labs[j], atual) < TOL_VIZINHO &&
          deltaE(labs[j], origem) < TOL_SEMENTE_GLOBAL)
      ) {
        fundo[j] = 1;
        semente[j] = origem;
        fila.push(j);
      }
    };

    if (x > 0) visitar(i - 1);
    if (x < w - 1) visitar(i + 1);
    if (y > 0) visitar(i - w);
    if (y < h - 1) visitar(i + w);
  }

  return fundo;
}

/* ==========================================================================
   Agrupamento das cores
   ========================================================================== */

/** Inicialização k-means++ — espalha os centros iniciais em vez de sorteá-los. */
function semearCentros(amostras: Amostra[], k: number, rand: () => number): Lab[] {
  const centros: Lab[] = [amostras[Math.floor(rand() * amostras.length)].lab];
  const d2 = new Float64Array(amostras.length).fill(Infinity);

  while (centros.length < k) {
    const ultimo = centros[centros.length - 1];
    let total = 0;

    for (let i = 0; i < amostras.length; i++) {
      const d = deltaE(amostras[i].lab, ultimo);
      const sq = d * d * amostras[i].peso;
      if (sq < d2[i]) d2[i] = sq;
      total += d2[i];
    }

    if (total <= 0) break;

    let alvo = rand() * total;
    let escolhido = amostras.length - 1;
    for (let i = 0; i < amostras.length; i++) {
      alvo -= d2[i];
      if (alvo <= 0) {
        escolhido = i;
        break;
      }
    }
    centros.push(amostras[escolhido].lab);
  }

  return centros;
}

interface Grupo {
  lab: Lab;
  peso: number;
}

function kmeans(amostras: Amostra[], k: number, iteracoes: number): Grupo[] {
  const rand = mulberry32(0x5eed);
  let centros = semearCentros(amostras, Math.min(k, amostras.length), rand);
  const atribuicao = new Int32Array(amostras.length).fill(-1);

  for (let it = 0; it < iteracoes; it++) {
    let mudou = false;

    for (let i = 0; i < amostras.length; i++) {
      let melhor = 0;
      let melhorD = Infinity;
      for (let c = 0; c < centros.length; c++) {
        const d = deltaE(amostras[i].lab, centros[c]);
        if (d < melhorD) {
          melhorD = d;
          melhor = c;
        }
      }
      if (atribuicao[i] !== melhor) {
        atribuicao[i] = melhor;
        mudou = true;
      }
    }

    const somaL = new Float64Array(centros.length);
    const somaA = new Float64Array(centros.length);
    const somaB = new Float64Array(centros.length);
    const somaP = new Float64Array(centros.length);

    for (let i = 0; i < amostras.length; i++) {
      const c = atribuicao[i];
      const p = amostras[i].peso;
      somaL[c] += amostras[i].lab.L * p;
      somaA[c] += amostras[i].lab.a * p;
      somaB[c] += amostras[i].lab.b * p;
      somaP[c] += p;
    }

    centros = centros.map((antigo, c) =>
      somaP[c] > 0
        ? { L: somaL[c] / somaP[c], a: somaA[c] / somaP[c], b: somaB[c] / somaP[c] }
        : antigo,
    );

    if (!mudou && it > 0) break;
  }

  const pesos = new Float64Array(centros.length);
  for (let i = 0; i < amostras.length; i++) pesos[atribuicao[i]] += amostras[i].peso;

  return centros.map((lab, c) => ({ lab, peso: pesos[c] })).filter((g) => g.peso > 0);
}

/** Funde grupos que o olho leria como a mesma cor. */
function fundir(grupos: Grupo[], limite: number): Grupo[] {
  const out: Grupo[] = [];

  for (const g of [...grupos].sort((a, b) => b.peso - a.peso)) {
    const perto = out.find((o) => deltaE(o.lab, g.lab) < limite);
    if (perto) {
      const total = perto.peso + g.peso;
      perto.lab = {
        L: (perto.lab.L * perto.peso + g.lab.L * g.peso) / total,
        a: (perto.lab.a * perto.peso + g.lab.a * g.peso) / total,
        b: (perto.lab.b * perto.peso + g.lab.b * g.peso) / total,
      };
      perto.peso = total;
    } else {
      out.push({ ...g });
    }
  }

  return out;
}

/* ==========================================================================
   Entrada pública
   ========================================================================== */

/**
 * Extrai a paleta de uma foto.
 *
 * Recebe a imagem já reduzida (a de exibição tem milhões de pixels e não
 * mudaria o resultado). Devolve as cores dominantes ordenadas por presença,
 * cada uma com nome em português.
 */
export function extractPalette(data: ImageData, options: ExtractOptions = {}): PaletteColor[] {
  const max = options.max ?? 5;
  const k = options.clusters ?? 8;
  const minShare = options.minShare ?? 0.03;

  const { width: w, height: h, data: px } = data;
  const total = w * h;
  if (total === 0) return [];

  const labs: Lab[] = new Array(total);
  const opaco = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    opaco[i] = px[o + 3] >= 128 ? 1 : 0;
    labs[i] = rgbToLab({ r: px[o], g: px[o + 1], b: px[o + 2] });
  }

  const fundo = marcarFundo(w, h, labs, opaco);

  /* Peso por posição, leve: entre duas peças igualmente grandes, a do centro
     do quadro é a que a foto está mostrando. */
  const pesoDe = (i: number) => {
    const nx = ((i % w) / w - 0.5) * 2;
    const ny = (((i / w) | 0) / h - 0.5) * 2;
    return 0.7 + 0.6 * Math.exp(-1.4 * (nx * nx + ny * ny * 0.75));
  };

  const roupa: Amostra[] = [];
  const tudo: Amostra[] = [];
  for (let i = 0; i < total; i++) {
    if (!opaco[i]) continue;
    const amostra = { lab: labs[i], peso: pesoDe(i) };
    tudo.push(amostra);
    if (!fundo[i]) roupa.push(amostra);
  }

  if (tudo.length === 0) return [];

  /* Válvula de segurança para o caso extremo: look da exata cor da parede, ou
     foto que é quase toda fundo. O limite é baixo de propósito — mesmo um
     recorte pobre da roupa descreve o look melhor do que a parede inteira. */
  const amostras = roupa.length > tudo.length * 0.06 ? roupa : tudo;

  const grupos = fundir(kmeans(amostras, k, 14), 0.058);
  const somaGrupos = grupos.reduce((s, g) => s + g.peso, 0) || 1;

  const mantidos = grupos
    .map((g) => ({ ...g, share: g.peso / somaGrupos }))
    .filter((g) => g.share >= minShare)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);

  // Renormaliza para que as cores mostradas somem 100%.
  const soma = mantidos.reduce((s, g) => s + g.share, 0) || 1;

  return desambiguar(
    mantidos.map((g) => {
      const hex = labToHex(g.lab);
      const achado = nameOf(hex);
      return {
        hex,
        name: achado.name,
        family: familiaDe(hex, achado),
        share: g.share / soma,
        L: labToLch(g.lab).L,
      };
    }),
  );
}

/** Acima disto, o nome do dicionário é um chute e a geometria decide. */
const NOME_CONFIAVEL = 0.07;

/**
 * A família da cor, conciliando dicionário e geometria.
 *
 * As duas aparecem juntas na tela — o chip diz "rosa-chá" e o filtro diz
 * "Rosas" —, então discordarem é um defeito visível: um look listado como
 * rosa-chá caindo em "Marrons" parece bug, e é. Quando o nome é um acerto
 * próximo, ele manda; quando é um chute, a geometria em OKLCh decide, que é o
 * critério que não depende de o dicionário ter aquela cor.
 */
function familiaDe(hex: string, achado: { family: HueFamily; distance: number }): HueFamily {
  return achado.distance < NOME_CONFIAVEL ? achado.family : familyOf(hex);
}

/**
 * Separa cores que caíram no mesmo nome do dicionário.
 *
 * Duas faixas distintas de um jeans desbotado são duas cores de verdade, mas o
 * vizinho mais próximo no dicionário é "jeans" para as duas — e uma paleta que
 * lista "jeans 23%, jeans 21%" parece defeito, não leitura. O desempate é por
 * luminosidade, que é justamente o que separa as duas aos olhos de quem olha.
 */
function desambiguar(cores: (PaletteColor & { L: number })[]): PaletteColor[] {
  const porNome = new Map<string, (PaletteColor & { L: number })[]>();
  for (const c of cores) {
    const lista = porNome.get(c.name);
    if (lista) lista.push(c);
    else porNome.set(c.name, [c]);
  }

  for (const grupo of porNome.values()) {
    if (grupo.length < 2) continue;
    const ordenado = [...grupo].sort((a, b) => b.L - a.L);
    ordenado[0].name = `${ordenado[0].name} claro`;
    ordenado[ordenado.length - 1].name = `${ordenado[ordenado.length - 1].name} escuro`;
  }

  return cores.map(({ hex, name, family, share }) => ({ hex, name, family, share }));
}

/** Métricas em OKLCh de uma paleta, ponderadas pela presença de cada cor. */
export function paletteStats(colors: PaletteColor[]) {
  if (colors.length === 0) {
    return {
      avgL: 0.5,
      avgC: 0,
      maxC: 0,
      spreadL: 0,
      hueSpread: 0,
      warmth: 0,
      neutralShare: 1,
    };
  }

  const lch = colors.map((c) => ({ ...labToLch(rgbToLab(hexOf(c.hex))), share: c.share }));

  const avgL = lch.reduce((s, c) => s + c.L * c.share, 0);
  const avgC = lch.reduce((s, c) => s + c.C * c.share, 0);
  const maxC = Math.max(...lch.map((c) => c.C));
  const spreadL = Math.max(...lch.map((c) => c.L)) - Math.min(...lch.map((c) => c.L));

  // Quanto do look é cor de verdade e quanto é tom. Uma média de croma baixa
  // pode vir de "tudo sem cor" ou de "uma cor forte pequena perdida em muito
  // neutro"; essa fração distingue os dois casos.
  const neutralShare = lch.filter((c) => c.C < 0.04).reduce((s, c) => s + c.share, 0);

  // Só cores com croma real entram na conta de matiz; cinza não tem matiz útil.
  const chromatic = lch.filter((c) => c.C > 0.04);
  let hueSpread = 0;
  let warmth = 0;

  if (chromatic.length > 0) {
    let x = 0;
    let y = 0;
    let wsum = 0;
    for (const c of chromatic) {
      const rad = (c.h * Math.PI) / 180;
      const w = c.share * c.C;
      x += Math.cos(rad) * w;
      y += Math.sin(rad) * w;
      wsum += w;
    }
    // Vetor resultante curto = matizes espalhados; longo = tudo na mesma faixa.
    const resultante = wsum > 0 ? Math.hypot(x, y) / wsum : 0;
    hueSpread = 1 - resultante;

    let meanH = (Math.atan2(y, x) * 180) / Math.PI;
    if (meanH < 0) meanH += 360;
    // Quente perto de 60° (laranja/amarelo), frio perto de 240° (azul).
    warmth = Math.cos(((meanH - 60) * Math.PI) / 180);
  }

  return { avgL, avgC, maxC, spreadL, hueSpread, warmth, neutralShare };
}

function hexOf(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
