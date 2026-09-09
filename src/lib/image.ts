import type { QualityPreset } from './types';

/**
 * Pipeline de foto.
 *
 * O objetivo aqui é que a foto postada continue parecendo a foto tirada. Três
 * decisões carregam isso:
 *
 * 1. **Redução em etapas.** Passar de 4032px para 1800px num único `drawImage`
 *    joga fora 80% dos pixels sem olhar para eles, e tecido com trama fina
 *    (tricô, linho, jeans) vira ruído. Reduzir pela metade de cada vez faz o
 *    navegador tirar média dos pixels em cada passo.
 * 2. **WebP com qualidade alta.** Um WebP a 0.92 fica visivelmente melhor que
 *    um JPEG do mesmo tamanho em arquivo, e é onde estão as bordas de roupa.
 * 3. **Blob no IndexedDB, não base64 no localStorage.** Base64 infla 33%, e o
 *    localStorage estoura em ~5 MB — três fotos e acabou.
 */

interface QualitySpec {
  /** Maior lado da imagem guardada, em pixels. */
  longEdge: number;
  quality: number;
  label: string;
  hint: string;
}

export const QUALITY_SPECS: Record<QualityPreset, QualitySpec> = {
  alta: {
    longEdge: 2400,
    quality: 0.94,
    label: 'Alta',
    hint: 'Até 2400px. Guarda a trama do tecido; arquivos maiores.',
  },
  equilibrada: {
    longEdge: 1800,
    quality: 0.9,
    label: 'Equilibrada',
    hint: 'Até 1800px. Nítida em tela cheia sem pesar.',
  },
  leve: {
    longEdge: 1280,
    quality: 0.84,
    label: 'Leve',
    hint: 'Até 1280px. Para quando o armazenamento estiver apertado.',
  },
};

const THUMB_EDGE = 560;
const THUMB_QUALITY = 0.8;

export interface ProcessedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  /** Tamanho do arquivo original, para mostrar o quanto foi economizado. */
  originalBytes: number;
  /** Versão minúscula usada pelo extrator de paleta. */
  analysis: ImageData;
}

let webpSupport: boolean | null = null;

function supportsWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/**
 * Decodifica o arquivo já com a orientação do EXIF aplicada.
 *
 * Sem `imageOrientation: 'from-image'` toda foto de celular na vertical entra
 * deitada — o sensor grava na horizontal e marca a rotação só nos metadados,
 * que o canvas ignora.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Safari antigo não aceita a opção; tenta sem ela antes de desistir.
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error(
        'Não consegui abrir essa imagem. Formatos aceitos: JPG, PNG, WebP, AVIF ou GIF.',
      );
    }
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** Reduz pela metade a cada passo até chegar perto do alvo (ver comentário do topo). */
function downscale(source: CanvasImageSource, sw: number, sh: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(sw, sh));
  const targetW = Math.max(1, Math.round(sw * scale));
  const targetH = Math.max(1, Math.round(sh * scale));

  let curW = sw;
  let curH = sh;
  let canvas = makeCanvas(curW, curH);
  ctxOf(canvas).drawImage(source, 0, 0, curW, curH);

  while (curW > targetW * 2 && curH > targetH * 2) {
    const nextW = Math.max(targetW, Math.round(curW / 2));
    const nextH = Math.max(targetH, Math.round(curH / 2));
    const next = makeCanvas(nextW, nextH);
    ctxOf(next).drawImage(canvas, 0, 0, nextW, nextH);
    canvas = next;
    curW = nextW;
    curH = nextH;
  }

  if (curW !== targetW || curH !== targetH) {
    const final = makeCanvas(targetW, targetH);
    ctxOf(final).drawImage(canvas, 0, 0, targetW, targetH);
    canvas = final;
  }

  return { canvas, width: targetW, height: targetH };
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao codificar a imagem.'))),
      mime,
      quality,
    );
  });
}

export async function processPhoto(
  file: File | Blob,
  preset: QualityPreset = 'equilibrada',
): Promise<ProcessedPhoto> {
  const spec = QUALITY_SPECS[preset];
  const bitmap = await decode(file);
  const mime = supportsWebP() ? 'image/webp' : 'image/jpeg';

  try {
    const main = downscale(bitmap, bitmap.width, bitmap.height, spec.longEdge);
    const full = await toBlob(main.canvas, mime, spec.quality);

    const small = downscale(main.canvas, main.width, main.height, THUMB_EDGE);
    const thumb = await toBlob(small.canvas, mime, THUMB_QUALITY);

    // A análise sai da versão já reduzida: mesmos pixels que o usuário vai ver.
    const tiny = downscale(small.canvas, small.width, small.height, 160);
    const analysis = ctxOf(tiny.canvas).getImageData(0, 0, tiny.width, tiny.height);

    return {
      full,
      thumb,
      width: main.width,
      height: main.height,
      mime,
      bytes: full.size,
      originalBytes: file.size,
      analysis,
    };
  } finally {
    bitmap.close?.();
  }
}

/** Roda o extrator numa imagem já guardada (ex.: reprocessar um post antigo). */
export async function analysisFromBlob(blob: Blob): Promise<ImageData> {
  const bitmap = await decode(blob);
  try {
    const tiny = downscale(bitmap, bitmap.width, bitmap.height, 160);
    return ctxOf(tiny.canvas).getImageData(0, 0, tiny.width, tiny.height);
  } finally {
    bitmap.close?.();
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatMegapixels(w: number, h: number): string {
  const mp = (w * h) / 1_000_000;
  return mp >= 1 ? `${mp.toFixed(1)} MP` : `${Math.round(mp * 1000)} KP`;
}
