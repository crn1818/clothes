import { describe, expect, it } from 'vitest';
import { extractPalette, paletteStats } from './extract';
import { hexToLch, hexToRgb, rgbToHex, rgbToLab, labToHex } from './oklab';
import { familyOf, nameOf } from './names';
import { describePalette, paletteFamilies, resumirPaletas } from './palettes';

/**
 * Testes do motor de cor.
 *
 * O alvo é uma regressão específica e cara: a paleta virar a cor da parede.
 * Isso quebrou três vezes durante a construção, cada vez de um jeito diferente
 * (peso central fraco demais, semelhança de cor não aguentando degradê,
 * critério espacial confundido pela vinheta), e nenhuma das três aparecia num
 * teste de tipo. Aparece aqui.
 */

/** Uma "foto" sintética: fundo tomando o quadro e uma peça de roupa no meio. */
function foto(opcoes: {
  largura?: number;
  altura?: number;
  fundo: string;
  /** Retângulos desenhados por cima, em coordenadas normalizadas. */
  pecas: { x0: number; y0: number; x1: number; y1: number; cor: string }[];
  /** Degradê vertical no fundo, em unidades de luminosidade OKLab. */
  degrade?: number;
  /** Escurecimento nas beiradas, como a vinheta de uma lente. */
  vinheta?: number;
}): ImageData {
  const w = opcoes.largura ?? 128;
  const h = opcoes.altura ?? 160;
  const data = new Uint8ClampedArray(w * h * 4);

  const fundoLch = hexToLch(opcoes.fundo);
  const degrade = opcoes.degrade ?? 0;
  const vinheta = opcoes.vinheta ?? 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / w;
      const fy = y / h;

      let cor = opcoes.fundo;
      for (const p of opcoes.pecas) {
        if (fx >= p.x0 && fx < p.x1 && fy >= p.y0 && fy < p.y1) cor = p.cor;
      }

      if (cor === opcoes.fundo && degrade !== 0) {
        const L = Math.max(0, Math.min(1, fundoLch.L + degrade * (0.5 - fy)));
        cor = labToHex({
          L,
          a: Math.cos((fundoLch.h * Math.PI) / 180) * fundoLch.C,
          b: Math.sin((fundoLch.h * Math.PI) / 180) * fundoLch.C,
        });
      }

      const { r, g, b } = hexToRgb(cor);
      let escala = 1;
      if (vinheta > 0) {
        const nx = (fx - 0.5) * 2;
        const ny = (fy - 0.5) * 2;
        escala = 1 - vinheta * Math.min(1, (nx * nx + ny * ny) / 2);
      }

      const i = (y * w + x) * 4;
      data[i] = r * escala;
      data[i + 1] = g * escala;
      data[i + 2] = b * escala;
      data[i + 3] = 255;
    }
  }

  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

/** Distância perceptual entre dois hexes, para as asserções. */
function distancia(a: string, b: string): number {
  const la = rgbToLab(hexToRgb(a));
  const lb = rgbToLab(hexToRgb(b));
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
}

describe('extractPalette — separação do fundo', () => {
  it('devolve a roupa, não a parede que ocupa o quadro', () => {
    // A parede cobre ~78% da imagem; a peça, ~22%. Por área, a parede ganha.
    const paleta = extractPalette(
      foto({
        fundo: '#E4D8C4',
        pecas: [{ x0: 0.33, y0: 0.12, x1: 0.67, y1: 0.85, cor: '#A2663C' }],
      }),
    );

    expect(paleta.length).toBeGreaterThan(0);
    expect(distancia(paleta[0].hex, '#A2663C')).toBeLessThan(0.05);
    // A parede não pode simplesmente reaparecer em segundo lugar.
    for (const cor of paleta) {
      expect(distancia(cor.hex, '#E4D8C4')).toBeGreaterThan(0.04);
    }
  });

  it('atravessa parede com degradê e vinheta', () => {
    // Foi exatamente esta combinação que derrubou as duas primeiras tentativas:
    // o degradê espalha o fundo por uma faixa larga de tons, e a vinheta faz a
    // beirada ficar mais escura que o miolo.
    const paleta = extractPalette(
      foto({
        fundo: '#E4D8C4',
        degrade: 0.09,
        vinheta: 0.17,
        pecas: [{ x0: 0.33, y0: 0.12, x1: 0.67, y1: 0.85, cor: '#A2663C' }],
      }),
    );

    expect(distancia(paleta[0].hex, '#A2663C')).toBeLessThan(0.06);
  });

  it('encontra várias peças e as ordena por presença', () => {
    const paleta = extractPalette(
      foto({
        fundo: '#E9EEF1',
        pecas: [
          { x0: 0.33, y0: 0.12, x1: 0.67, y1: 0.45, cor: '#F8F8F6' }, // camisa
          { x0: 0.33, y0: 0.45, x1: 0.67, y1: 0.9, cor: '#4C6FA0' }, // jeans
        ],
      }),
    );

    const nomes = paleta.map((c) => c.name);
    expect(nomes.some((n) => n.startsWith('jeans') || n.startsWith('azul'))).toBe(true);
    // O jeans ocupa mais área que a camisa e deve vir antes.
    const iJeans = paleta.findIndex((c) => c.family === 'azul');
    const iCamisa = paleta.findIndex((c) => c.family === 'branco');
    expect(iJeans).toBeGreaterThanOrEqual(0);
    if (iCamisa >= 0) expect(iJeans).toBeLessThan(iCamisa);
  });

  it('desiste da separação quando a roupa é da cor da parede', () => {
    // Camisa branca em parede branca: sem válvula de segurança isto devolveria
    // paleta vazia, que é pior do que devolver a cor do quadro.
    const paleta = extractPalette(
      foto({
        fundo: '#F4F2EE',
        pecas: [{ x0: 0.33, y0: 0.12, x1: 0.67, y1: 0.85, cor: '#F6F4F0' }],
      }),
    );

    expect(paleta.length).toBeGreaterThan(0);
    expect(paleta[0].family).toBe('branco');
  });

  it('as fatias somam 100%', () => {
    const paleta = extractPalette(
      foto({
        fundo: '#E4D8C4',
        pecas: [
          { x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.5, cor: '#6C1226' },
          { x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.9, cor: '#1F1F21' },
        ],
      }),
    );

    const soma = paleta.reduce((s, c) => s + c.share, 0);
    expect(soma).toBeCloseTo(1, 5);
  });

  it('é determinístico — a mesma foto dá a mesma paleta', () => {
    const imagem = () =>
      foto({
        fundo: '#D5D8C6',
        pecas: [{ x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.8, cor: '#4C5321' }],
      });

    expect(extractPalette(imagem())).toEqual(extractPalette(imagem()));
  });

  it('separa duas cores que caem no mesmo nome do dicionário', () => {
    const paleta = extractPalette(
      foto({
        fundo: '#E9EEF1',
        pecas: [
          { x0: 0.3, y0: 0.12, x1: 0.7, y1: 0.5, cor: '#4C6FA0' },
          { x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.9, cor: '#3D5C88' },
        ],
      }),
    );

    const nomes = paleta.map((c) => c.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe('nomes de cor', () => {
  it('nomeia cores de moda em português', () => {
    expect(nameOf('#A2663C').name).toBe('caramelo');
    expect(nameOf('#0F0F10').name).toBe('preto');
    expect(nameOf('#6C1226').name).toBe('vinho');
    expect(nameOf('#4C6FA0').name).toBe('jeans');
  });

  it('trata cor sem croma como neutro, seja qual for o matiz', () => {
    expect(familyOf('#FAFAFA')).toBe('branco');
    expect(familyOf('#9B9B99')).toBe('cinza');
    expect(familyOf('#141416')).toBe('preto');
  });

  it('põe marrom no lugar de laranja quando o tom é abafado', () => {
    expect(familyOf('#6A4A31')).toBe('marrom');
    expect(familyOf('#E8712A')).toBe('laranja');
  });

  it('põe jeans em azul, não em roxo', () => {
    // O ângulo de matiz do OKLCh não é o do HSL: jeans fica em h=259, e um
    // limite herdado do HSL mandava isso para "Roxos".
    expect(familyOf('#4C6FA0')).toBe('azul');
    expect(familyOf('#6A3FA0')).toBe('roxo');
  });

  it('o nome e a família nunca se contradizem na tela', () => {
    // Um chip escrito "rosa-chá" listado sob "Marrons" parece defeito — e é.
    const paleta = extractPalette(
      foto({
        fundo: '#DCE4E0',
        pecas: [{ x0: 0.3, y0: 0.15, x1: 0.7, y1: 0.85, cor: '#E4BEBF' }],
      }),
    );

    const rosa = paleta.find((c) => c.name.startsWith('rosa'));
    expect(rosa).toBeDefined();
    expect(rosa!.family).toBe('rosa');
  });
});

describe('classificação da paleta', () => {
  const cores = (lista: [string, number][]) =>
    lista.map(([hex, share]) => ({
      hex,
      share,
      name: nameOf(hex).name,
      family: familyOf(hex),
    }));

  it('reconhece uma paleta terrosa', () => {
    const familias = paletteFamilies(
      cores([
        ['#A2663C', 0.4],
        ['#4C3122', 0.3],
        ['#DCC9AF', 0.3],
      ]),
    );
    expect(familias).toContain('terrosa');
  });

  it('não chama de terrosa um look quente e berrante', () => {
    // Amarelo + pink é quente e tem marrom nenhum: era o caso que passava
    // como "terrosa" antes do teto de croma.
    const familias = paletteFamilies(
      cores([
        ['#EFC31C', 0.4],
        ['#E4368C', 0.35],
        ['#C4DAEB', 0.25],
      ]),
    );
    expect(familias).toContain('vibrante');
    expect(familias).not.toContain('terrosa');
  });

  it('reconhece neutro pela fatia sem cor, não pela média', () => {
    expect(
      paletteFamilies(
        cores([
          ['#9B9B99', 0.5],
          ['#3E4146', 0.3],
          ['#CFCFCE', 0.2],
        ]),
      ),
    ).toContain('neutra');

    // Uma cor forte pequena no meio de muito neutro derruba a média de croma,
    // mas o look não é neutro.
    expect(
      paletteFamilies(
        cores([
          ['#E4368C', 0.45],
          ['#CFCFCE', 0.3],
          ['#9B9B99', 0.25],
        ]),
      ),
    ).not.toContain('neutra');
  });

  it('reconhece escuro e alto contraste', () => {
    expect(
      paletteFamilies(
        cores([
          ['#0F0F10', 0.6],
          ['#2C2C2F', 0.4],
        ]),
      ),
    ).toContain('escura');

    expect(
      paletteFamilies(
        cores([
          ['#FFFFFF', 0.5],
          ['#0F0F10', 0.5],
        ]),
      ),
    ).toContain('contraste');
  });

  it('escreve uma frase legível, sem "e" repetido', () => {
    const frase = describePalette(
      cores([
        ['#A2663C', 0.4],
        ['#4C3122', 0.25],
        ['#DCC9AF', 0.2],
        ['#1F1F21', 0.1],
        ['#E9EEF1', 0.05],
      ]),
    );

    expect(frase).toMatch(/^Paleta /);
    // A lista de cores usa vírgula e um "e" só no fim — não "X e Y e mais 2".
    expect(frase).toContain('com chocolate, bege e mais 2.');
  });
});

describe('resumirPaletas', () => {
  it('funde cores parecidas de looks diferentes', () => {
    const resumo = resumirPaletas([
      [{ hex: '#A2663C', share: 1, name: 'caramelo', family: 'marrom' }],
      [{ hex: '#A4683E', share: 1, name: 'caramelo', family: 'marrom' }],
      [{ hex: '#1F1F21', share: 1, name: 'preto-suave', family: 'preto' }],
    ]);

    expect(resumo).toHaveLength(2);
    expect(resumo[0].family).toBe('marrom');
    expect(resumo[0].share).toBeCloseTo(2 / 3, 2);
  });
});

describe('conversões OKLab', () => {
  it('vai e volta sem perder a cor', () => {
    for (const hex of ['#A2663C', '#0F0F10', '#FFFFFF', '#4C6FA0', '#E4368C']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
      expect(labToHex(rgbToLab(hexToRgb(hex)))).toBe(hex);
    }
  });

  it('mede croma e luminosidade de forma coerente', () => {
    expect(hexToLch('#FFFFFF').L).toBeGreaterThan(0.95);
    expect(hexToLch('#000000').L).toBeLessThan(0.05);
    expect(hexToLch('#9B9B99').C).toBeLessThan(0.02);
    expect(hexToLch('#E4368C').C).toBeGreaterThan(0.15);
  });

  it('paletteStats separa quente de frio', () => {
    const quente = paletteStats([
      { hex: '#E8712A', share: 1, name: 'laranja', family: 'laranja' },
    ]);
    const frio = paletteStats([
      { hex: '#2C5CA8', share: 1, name: 'azul', family: 'azul' },
    ]);

    expect(quente.warmth).toBeGreaterThan(0.5);
    expect(frio.warmth).toBeLessThan(-0.2);
  });
});
