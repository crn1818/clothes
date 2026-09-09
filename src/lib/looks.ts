import { shiftL } from './color/oklab';
import type { PinCategory } from './types';

/**
 * Gerador dos looks de exemplo.
 *
 * O feed precisa nascer com conteúdo — um app social vazio não se explica. Em
 * vez de fotos falsas de banco de imagem, cada look de exemplo é um croqui
 * desenhado em SVG e depois **rasterizado e passado pelo mesmo pipeline das
 * fotos de verdade**: mesma redução, mesma compressão, mesmo extrator de
 * paleta. Então as paletas que aparecem no feed são saída real do motor de
 * cor, não valores digitados à mão — se o extrator regredir, o feed de exemplo
 * quebra junto, o que é exatamente o que se quer de um dado de teste.
 *
 * Os degradês sutis em cada peça são de propósito: pano real não é chapado, e
 * uma imagem chapada faria o k-means parecer melhor do que é.
 */

export interface LookPin {
  x: number;
  y: number;
  peca: string;
  categoria: PinCategory;
  marca: string;
  onde: string;
  preco: string;
  link: string;
}

export interface LookSpec {
  id: string;
  autor: string;
  caption: string;
  diasAtras: number;
  curtidas: number;
  silhueta: 'calca' | 'vestido';
  parede: string;
  chao: string;
  pele: string;
  cabelo: string;
  top: string;
  baixo: string;
  sapato: string;
  casaco?: string;
  bolsa?: string;
  echarpe?: string;
  pins: LookPin[];
}

const W = 800;
const H = 1000;

function grad(id: string, hex: string, delta = 0.07): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${shiftL(hex, delta)}"/>
      <stop offset="1" stop-color="${shiftL(hex, -delta)}"/>
    </linearGradient>`;
}

/** Croqui de um look em SVG, pronto para virar pixels. */
export function lookSvg(s: LookSpec): string {
  const casaco = s.casaco
    ? `<path d="M 296 240 L 266 264 L 252 566 L 322 578 L 338 300 L 342 246 Q 318 234 296 240 Z" fill="url(#gCasaco)"/>
       <path d="M 504 240 L 534 264 L 548 566 L 478 578 L 462 300 L 458 246 Q 482 234 504 240 Z" fill="url(#gCasaco)"/>`
    : '';

  const bolsa = s.bolsa
    ? `<path d="M 474 306 Q 566 386 570 470" fill="none" stroke="${shiftL(s.bolsa, -0.09)}" stroke-width="11" stroke-linecap="round"/>
       <rect x="518" y="458" width="106" height="92" rx="12" fill="url(#gBolsa)"/>
       <rect x="518" y="458" width="106" height="20" rx="9" fill="${shiftL(s.bolsa, -0.07)}"/>`
    : '';

  const echarpe = s.echarpe
    ? `<path d="M 354 234 Q 400 270 446 234 L 456 264 Q 400 300 344 264 Z" fill="url(#gEcharpe)"/>`
    : '';

  const baixo =
    s.silhueta === 'vestido'
      ? `<path d="M 320 452 L 480 452 L 524 726 Q 400 756 276 726 Z" fill="url(#gBaixo)"/>`
      : `<path d="M 322 492 L 478 492 L 470 700 L 452 860 L 410 860 L 400 638 L 390 860 L 348 860 L 330 700 Z" fill="url(#gBaixo)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${grad('gParede', s.parede, 0.045)}
    ${grad('gChao', s.chao, 0.05)}
    ${grad('gTop', s.top)}
    ${grad('gBaixo', s.baixo)}
    ${grad('gSapato', s.sapato, 0.06)}
    ${s.casaco ? grad('gCasaco', s.casaco, 0.08) : ''}
    ${s.bolsa ? grad('gBolsa', s.bolsa, 0.06) : ''}
    ${s.echarpe ? grad('gEcharpe', s.echarpe, 0.06) : ''}
    <radialGradient id="vinheta" cx="0.5" cy="0.42" r="0.78">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.17"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#gParede)"/>
  <rect y="762" width="${W}" height="238" fill="url(#gChao)"/>
  <ellipse cx="400" cy="902" rx="152" ry="24" fill="#000000" opacity="0.13"/>

  <!-- pernas e braços ficam sob a roupa -->
  <path d="M 336 470 L 380 470 L 372 858 L 342 858 Z" fill="${s.pele}"/>
  <path d="M 420 470 L 464 470 L 458 858 L 428 858 Z" fill="${s.pele}"/>
  <rect x="378" y="186" width="44" height="64" fill="${shiftL(s.pele, -0.04)}"/>

  ${baixo}

  <!-- calçado -->
  <path d="M 344 852 L 398 852 L 398 884 Q 398 900 380 900 L 336 900 Q 328 890 336 876 Z" fill="url(#gSapato)"/>
  <path d="M 402 852 L 456 852 L 464 876 Q 472 890 464 900 L 420 900 Q 402 900 402 884 Z" fill="url(#gSapato)"/>

  <!-- top -->
  <path d="M 300 244 L 342 224 Q 400 248 458 224 L 500 244 L 520 342 L 486 358 L 478 500 L 322 500 L 314 358 L 280 342 Z" fill="url(#gTop)"/>
  <path d="M 288 346 Q 300 432 306 512 L 336 508 Q 328 424 318 350 Z" fill="${s.pele}"/>
  <path d="M 512 346 Q 500 432 494 512 L 464 508 Q 472 424 482 350 Z" fill="${s.pele}"/>
  <circle cx="321" cy="524" r="15" fill="${s.pele}"/>
  <circle cx="479" cy="524" r="15" fill="${s.pele}"/>

  ${casaco}
  ${echarpe}

  <!-- cabeça -->
  <circle cx="400" cy="150" r="54" fill="${s.pele}"/>
  <path d="M 346 150 Q 342 82 400 82 Q 458 82 454 150 Q 452 116 428 106 Q 400 130 364 112 Q 350 122 346 150 Z" fill="${s.cabelo}"/>

  ${bolsa}

  <rect width="${W}" height="${H}" fill="url(#vinheta)"/>
</svg>`;
}

/**
 * Rasteriza o croqui e devolve um PNG — daqui em diante ele é tratado como
 * qualquer foto enviada pelo usuário.
 */
export function svgToPngBlob(svg: string, width = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();

    img.onload = () => {
      try {
        const height = Math.round((width * H) / W);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D indisponível.');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Falha ao rasterizar o look.'))),
          'image/png',
        );
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar o croqui.'));
    };

    img.src = url;
  });
}

export const LOOKS: LookSpec[] = [
  {
    id: 'look-terroso',
    autor: 'u-lia',
    caption: 'Sábado de feira. Tudo o que eu queria era não decidir nada.',
    diasAtras: 0,
    curtidas: 148,
    silhueta: 'calca',
    parede: '#E4D8C4',
    chao: '#C9B79C',
    pele: '#C79268',
    cabelo: '#2B1E18',
    top: '#F2EDE4',
    baixo: '#4C3122',
    sapato: '#E7DECC',
    casaco: '#A2663C',
    bolsa: '#B3613B',
    pins: [
      {
        x: 0.335,
        y: 0.42,
        peca: 'Trench encurtado',
        categoria: 'casaco',
        marca: 'Brechó Garimpo',
        onde: 'Cidade Baixa, Porto Alegre',
        preco: 'R$ 120',
        link: '',
      },
      {
        x: 0.5,
        y: 0.31,
        peca: 'Camisa de linho',
        categoria: 'top',
        marca: 'Renner',
        onde: 'Loja física',
        preco: 'R$ 159',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Calça alfaiataria café',
        categoria: 'calca',
        marca: 'Zara',
        onde: 'Site',
        preco: 'R$ 299',
        link: '',
      },
      {
        x: 0.715,
        y: 0.505,
        peca: 'Bolsa de couro',
        categoria: 'bolsa',
        marca: 'Feira da Redenção',
        onde: 'Banca do seu Nilson',
        preco: 'R$ 90',
        link: '',
      },
    ],
  },
  {
    id: 'look-preto',
    autor: 'u-rafa',
    caption: 'Preto no preto porque hoje eu não tenho energia pra combinar nada.',
    diasAtras: 1,
    curtidas: 231,
    silhueta: 'calca',
    parede: '#D8D5CE',
    chao: '#B4B1AA',
    pele: '#6E4A34',
    cabelo: '#14100E',
    top: '#1F1F21',
    baixo: '#0F0F10',
    sapato: '#2C2C2F',
    casaco: '#26262A',
    pins: [
      {
        x: 0.335,
        y: 0.42,
        peca: 'Blazer oversized',
        categoria: 'casaco',
        marca: 'Herança Brechó',
        onde: 'Instagram',
        preco: 'R$ 180',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Calça wide leg',
        categoria: 'calca',
        marca: 'C&A',
        onde: 'Shopping',
        preco: 'R$ 139',
        link: '',
      },
      {
        x: 0.47,
        y: 0.875,
        peca: 'Coturno',
        categoria: 'calcado',
        marca: 'Dr. Martens',
        onde: 'Herdei da minha irmã',
        preco: '—',
        link: '',
      },
    ],
  },
  {
    id: 'look-jeans',
    autor: 'u-dani',
    caption: 'A fórmula que nunca falha: branco em cima, jeans embaixo.',
    diasAtras: 2,
    curtidas: 96,
    silhueta: 'calca',
    parede: '#E9EEF1',
    chao: '#C9D2D8',
    pele: '#E8C4A0',
    cabelo: '#7A5334',
    top: '#F8F8F6',
    baixo: '#4C6FA0',
    sapato: '#EFEFEC',
    bolsa: '#314563',
    pins: [
      {
        x: 0.5,
        y: 0.3,
        peca: 'Camisa branca',
        categoria: 'top',
        marca: 'Uniqlo',
        onde: 'Trouxe de viagem',
        preco: 'US$ 30',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Jeans reto',
        categoria: 'calca',
        marca: 'Levi’s 501',
        onde: 'Brechó online',
        preco: 'R$ 160',
        link: '',
      },
      {
        x: 0.715,
        y: 0.505,
        peca: 'Bolsa jeans escuro',
        categoria: 'bolsa',
        marca: 'Feita por mim',
        onde: 'Sobra de uma calça velha',
        preco: 'R$ 0',
        link: '',
      },
    ],
  },
  {
    id: 'look-militar',
    autor: 'u-rafa',
    caption: 'Verde em cima de verde. Descobri que funciona.',
    diasAtras: 3,
    curtidas: 74,
    silhueta: 'calca',
    parede: '#D5D8C6',
    chao: '#AFB49C',
    pele: '#8A5E3E',
    cabelo: '#1B1512',
    top: '#CFC0A8',
    baixo: '#B0A46C',
    sapato: '#1F1F21',
    casaco: '#4C5321',
    pins: [
      {
        x: 0.335,
        y: 0.42,
        peca: 'Parka militar',
        categoria: 'casaco',
        marca: 'Surplus do exército',
        onde: 'Loja de camping da Voluntários',
        preco: 'R$ 210',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Cargo khaki',
        categoria: 'calca',
        marca: 'Hering',
        onde: 'Outlet',
        preco: 'R$ 119',
        link: '',
      },
    ],
  },
  {
    id: 'look-pastel',
    autor: 'u-lia',
    caption: 'Domingo lento, cores lavadas.',
    diasAtras: 4,
    curtidas: 189,
    silhueta: 'vestido',
    parede: '#F2E7EA',
    chao: '#DFD0D4',
    pele: '#E8C4A0',
    cabelo: '#4A3226',
    top: '#C7BCE0',
    baixo: '#E4BEBF',
    sapato: '#F4F1EC',
    echarpe: '#A6DDC0',
    pins: [
      {
        x: 0.5,
        y: 0.32,
        peca: 'Tricô lavanda',
        categoria: 'top',
        marca: 'Feito pela minha vó',
        onde: 'Sala dela, inverno passado',
        preco: '—',
        link: '',
      },
      {
        x: 0.5,
        y: 0.6,
        peca: 'Saia midi rosa-chá',
        categoria: 'vestido',
        marca: 'Shein',
        onde: 'Site',
        preco: 'R$ 62',
        link: '',
      },
      {
        x: 0.5,
        y: 0.255,
        peca: 'Lenço de seda',
        categoria: 'acessorio',
        marca: 'Brechó da Lima e Silva',
        onde: 'Porto Alegre',
        preco: 'R$ 25',
        link: '',
      },
    ],
  },
  {
    id: 'look-vinho',
    autor: 'u-dani',
    caption: 'Vinho com camel. A dupla que eu defendo com a vida.',
    diasAtras: 5,
    curtidas: 312,
    silhueta: 'vestido',
    parede: '#EFE9DC',
    chao: '#D3CBB8',
    pele: '#C79268',
    cabelo: '#2B1E18',
    top: '#6C1226',
    baixo: '#59162A',
    sapato: '#4C3122',
    casaco: '#B4884F',
    bolsa: '#7A3141',
    pins: [
      {
        x: 0.335,
        y: 0.42,
        peca: 'Casaco de lã camel',
        categoria: 'casaco',
        marca: 'Brechó Garimpo',
        onde: 'Cidade Baixa, Porto Alegre',
        preco: 'R$ 240',
        link: '',
      },
      {
        x: 0.5,
        y: 0.55,
        peca: 'Vestido vinho',
        categoria: 'vestido',
        marca: 'Farm',
        onde: 'Presente de aniversário',
        preco: '—',
        link: '',
      },
      {
        x: 0.47,
        y: 0.875,
        peca: 'Bota de cano curto',
        categoria: 'calcado',
        marca: 'Arezzo',
        onde: 'Black friday de 2023',
        preco: 'R$ 320',
        link: '',
      },
    ],
  },
  {
    id: 'look-vibrante',
    autor: 'u-theo',
    caption: 'Testando se coragem combina com pink.',
    diasAtras: 6,
    curtidas: 405,
    silhueta: 'calca',
    parede: '#C4DAEB',
    chao: '#A3BDD2',
    pele: '#4E3327',
    cabelo: '#12100E',
    top: '#E4368C',
    baixo: '#EFC31C',
    sapato: '#F8F8F6',
    pins: [
      {
        x: 0.5,
        y: 0.3,
        peca: 'Camiseta pink',
        categoria: 'top',
        marca: 'Marca de amigo',
        onde: 'Feira de rua da Redenção',
        preco: 'R$ 70',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Calça amarela',
        categoria: 'calca',
        marca: 'Achado de brechó',
        onde: 'Bazar do bairro',
        preco: 'R$ 45',
        link: '',
      },
      {
        x: 0.47,
        y: 0.875,
        peca: 'Tênis branco',
        categoria: 'calcado',
        marca: 'Adidas Samba',
        onde: 'Site',
        preco: 'R$ 599',
        link: '',
      },
    ],
  },
  {
    id: 'look-cinza',
    autor: 'u-theo',
    caption: 'Dia de chuva pede escala de cinza.',
    diasAtras: 8,
    curtidas: 58,
    silhueta: 'calca',
    parede: '#9FA3A8',
    chao: '#7C8085',
    pele: '#E8C4A0',
    cabelo: '#3E4146',
    top: '#B7B7B4',
    baixo: '#3E4146',
    sapato: '#BFC4C7',
    pins: [
      {
        x: 0.5,
        y: 0.31,
        peca: 'Moletom cinza',
        categoria: 'top',
        marca: 'Do meu pai, anos 90',
        onde: 'Armário dele',
        preco: '—',
        link: '',
      },
      {
        x: 0.45,
        y: 0.63,
        peca: 'Calça grafite',
        categoria: 'calca',
        marca: 'Riachuelo',
        onde: 'Shopping',
        preco: 'R$ 99',
        link: '',
      },
    ],
  },
  {
    id: 'look-petroleo',
    autor: 'u-lia',
    caption: 'Azul petróleo é o meu preto quando eu quero variar.',
    diasAtras: 11,
    curtidas: 127,
    silhueta: 'calca',
    parede: '#F0E4CC',
    chao: '#D6C6A8',
    pele: '#8A5E3E',
    cabelo: '#1B1512',
    top: '#204C55',
    baixo: '#18243F',
    sapato: '#6A4A31',
    echarpe: '#C6A027',
    pins: [
      {
        x: 0.5,
        y: 0.31,
        peca: 'Camisa petróleo',
        categoria: 'top',
        marca: 'Brechó online',
        onde: 'Enjoei',
        preco: 'R$ 55',
        link: '',
      },
      {
        x: 0.5,
        y: 0.255,
        peca: 'Echarpe mostarda',
        categoria: 'acessorio',
        marca: 'Tricô da feira',
        onde: 'Feira do Bom Fim',
        preco: 'R$ 40',
        link: '',
      },
      {
        x: 0.47,
        y: 0.875,
        peca: 'Mocassim marrom',
        categoria: 'calcado',
        marca: 'Sapataria do centro',
        onde: 'Rua da Praia',
        preco: 'R$ 180',
        link: '',
      },
    ],
  },
];

export const PERFIS_EXEMPLO = [
  {
    id: 'u-lia',
    handle: 'lia.terrosa',
    nome: 'Lia Vasconcelos',
    bio: 'Bege é uma cor e eu defendo isso.',
    avatar: ['#A2663C', '#E2D3BB'] as [string, string],
    cidade: 'Porto Alegre',
  },
  {
    id: 'u-rafa',
    handle: 'rafa.preto',
    nome: 'Rafa Andrade',
    bio: 'Guarda-roupa cápsula, cabeça bagunçada.',
    avatar: ['#1F1F21', '#585C61'] as [string, string],
    cidade: 'São Paulo',
  },
  {
    id: 'u-dani',
    handle: 'danivestiu',
    nome: 'Dani Prado',
    bio: 'Brechó é esporte.',
    avatar: ['#4C6FA0', '#C4DAEB'] as [string, string],
    cidade: 'Belo Horizonte',
  },
  {
    id: 'u-theo',
    handle: 'theo.cor',
    nome: 'Theo Miranda',
    bio: 'Se não doer nos olhos, não é look.',
    avatar: ['#E4368C', '#EFC31C'] as [string, string],
    cidade: 'Recife',
  },
];
