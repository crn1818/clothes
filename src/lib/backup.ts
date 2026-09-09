import * as idb from './idb';
import type { Post, Profile } from './types';

/**
 * Exportar e restaurar tudo o que está neste navegador.
 *
 * O modo local é confortável até o dia em que alguém limpa os dados do site e
 * descobre que "guardado no navegador" não é o mesmo que "guardado". Este
 * arquivo é a saída: um `.json` único com perfil, looks, paletas, etiquetas e
 * as fotos embutidas.
 *
 * As fotos vão em base64, que infla ~33%. É o preço de um arquivo só, que a
 * pessoa consegue mandar para si mesma por e-mail ou jogar no Drive sem
 * precisar de programa nenhum para abrir. Um .zip seria menor e exigiria uma
 * biblioteca; para um backup que se faz de vez em quando, não compensa.
 */

const VERSAO = 1;

interface FotoExportada {
  full: string;
  thumb: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

interface PostExportado {
  post: Post;
  foto: FotoExportada | null;
}

export interface ResultadoImport {
  importados: number;
  ignorados: number;
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const url = String(leitor.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    leitor.onerror = () => reject(leitor.error ?? new Error('Falha ao ler a foto.'));
    leitor.readAsDataURL(blob);
  });
}

function base64ParaBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar cedo demais cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportarTudo(): Promise<void> {
  const [perfil, perfis, posts] = await Promise.all([
    idb.getKV<Profile>('eu'),
    idb.allProfiles(),
    idb.allPosts(),
  ]);

  /* O arquivo é montado em pedaços, não como uma string só: com dezenas de
     fotos, o JSON inteiro em memória de uma vez derruba a aba. */
  const partes: BlobPart[] = [
    `{"formato":"croma-backup","versao":${VERSAO},`,
    `"criadoEm":"${new Date().toISOString()}",`,
    `"perfil":${JSON.stringify(perfil ?? null)},`,
    `"perfis":${JSON.stringify(perfis)},`,
    '"posts":[',
  ];

  let primeiro = true;
  for (const post of posts) {
    const imagem = await idb.getImage(post.imageId);
    const item: PostExportado = {
      post,
      foto: imagem
        ? {
            full: await blobParaBase64(imagem.full),
            thumb: await blobParaBase64(imagem.thumb),
            mime: imagem.mime,
            width: imagem.width,
            height: imagem.height,
            bytes: imagem.bytes,
          }
        : null,
    };

    if (!primeiro) partes.push(',');
    partes.push(JSON.stringify(item));
    primeiro = false;
  }

  partes.push(']}');

  const data = new Date().toISOString().slice(0, 10);
  baixar(new Blob(partes, { type: 'application/json' }), `croma-${data}.json`);
}

export async function importarDe(arquivo: File): Promise<ResultadoImport> {
  let dados: {
    formato?: string;
    versao?: number;
    perfil?: Profile | null;
    perfis?: Profile[];
    posts?: PostExportado[];
  };

  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('Esse arquivo não é um backup válido do Croma.');
  }

  if (dados.formato !== 'croma-backup') {
    throw new Error('Esse arquivo não é um backup do Croma.');
  }
  if ((dados.versao ?? 0) > VERSAO) {
    throw new Error('Esse backup veio de uma versão mais nova do Croma.');
  }

  const existentes = new Set((await idb.allPosts()).map((p) => p.id));

  for (const perfil of dados.perfis ?? []) {
    await idb.putProfile(perfil);
  }

  let importados = 0;
  let ignorados = 0;

  for (const item of dados.posts ?? []) {
    if (!item?.post?.id) continue;

    // Restaurar por cima do que já existe apagaria curtidas e salvos de looks
    // que a pessoa continuou usando depois do backup.
    if (existentes.has(item.post.id)) {
      ignorados++;
      continue;
    }

    if (item.foto) {
      await idb.putImage({
        id: item.post.imageId,
        full: base64ParaBlob(item.foto.full, item.foto.mime),
        thumb: base64ParaBlob(item.foto.thumb, item.foto.mime),
        width: item.foto.width,
        height: item.foto.height,
        mime: item.foto.mime,
        bytes: item.foto.bytes,
      });
    }

    await idb.putPost(item.post);
    importados++;
  }

  return { importados, ignorados };
}
