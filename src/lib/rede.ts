import { sb } from './supabase';
import { paletteFamilies, hueFamilies, describePalette } from './color/palettes';
import type { ProcessedPhoto } from './image';
import type {
  HueFamily,
  PaletteColor,
  PaletteFamily,
  Pin,
  PinCategory,
  Post,
  Profile,
} from './types';

/**
 * O Croma falando com o Supabase.
 *
 * Este arquivo é o gêmeo remoto do `idb.ts`: as mesmas operações, contra
 * Postgres em vez de IndexedDB. O `store.tsx` escolhe um dos dois e não sabe a
 * diferença — é por isso que as duas assinaturas foram mantidas iguais.
 *
 * A extração de paleta continua acontecendo no navegador de quem posta, antes
 * do upload. Processar imagem no servidor custaria uma função e um worker para
 * refazer um trabalho que a máquina de quem postou já fez de graça.
 */

const BUCKET = 'looks';

/* ---------- tipos das linhas ---------- */

interface LinhaPerfil {
  id: string;
  handle: string;
  nome: string;
  bio: string;
  cidade: string;
  avatar: string[] | null;
}

interface LinhaPost {
  id: string;
  author_id: string;
  caption: string;
  image_path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  cores: PaletteColor[];
  familias: string[];
  matizes: string[];
  descricao: string;
  created_at: string;
  curtidas: number;
}

interface LinhaPin {
  id: string;
  post_id: string;
  x: number;
  y: number;
  peca: string;
  categoria: string;
  marca: string;
  onde: string;
  preco: string;
  link: string;
}

/* ---------- conversões ---------- */

function urlPublica(caminho: string): string {
  return sb().storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

function paraPerfil(l: LinhaPerfil): Profile {
  const [a, b] = l.avatar ?? [];
  return {
    id: l.id,
    handle: l.handle,
    nome: l.nome,
    bio: l.bio ?? '',
    cidade: l.cidade ?? '',
    avatar: [a ?? '#C97F4E', b ?? '#5E7C8B'],
  };
}

function paraPin(l: LinhaPin): Pin {
  return {
    id: l.id,
    x: l.x,
    y: l.y,
    peca: l.peca,
    categoria: l.categoria as PinCategory,
    marca: l.marca ?? '',
    onde: l.onde ?? '',
    preco: l.preco ?? '',
    link: l.link ?? '',
  };
}

function paraPost(
  l: LinhaPost,
  pins: Pin[],
  curtidos: Set<string>,
  salvos: Set<string>,
): Post {
  return {
    id: l.id,
    authorId: l.author_id,
    createdAt: new Date(l.created_at).getTime(),
    caption: l.caption ?? '',
    imageId: l.id,
    urlFull: urlPublica(l.image_path),
    urlThumb: urlPublica(l.thumb_path),
    width: l.width,
    height: l.height,
    bytes: l.bytes,
    mime: l.mime,
    cores: l.cores ?? [],
    familias: (l.familias ?? []) as PaletteFamily[],
    matizes: (l.matizes ?? []) as HueFamily[],
    descricao: l.descricao ?? '',
    pins,
    curtidas: l.curtidas ?? 0,
    curtiuEu: curtidos.has(l.id),
    salvo: salvos.has(l.id),
  };
}

/* ---------- leitura ---------- */

export async function carregarTudo(meuId: string): Promise<{
  eu: Profile | null;
  perfis: Profile[];
  posts: Post[];
}> {
  const db = sb();

  // Tudo de uma vez: quatro idas ao servidor em série deixariam a abertura do
  // app visivelmente lenta, e nenhuma depende do resultado da outra.
  const [perfisRes, postsRes, pinsRes, curtidasRes, salvosRes] = await Promise.all([
    db.from('profiles').select('id, handle, nome, bio, cidade, avatar'),
    db.from('feed').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('pins').select('*'),
    db.from('curtidas').select('post_id').eq('user_id', meuId),
    db.from('salvos').select('post_id').eq('user_id', meuId),
  ]);

  const erro =
    perfisRes.error ?? postsRes.error ?? pinsRes.error ?? curtidasRes.error ?? salvosRes.error;
  if (erro) throw new Error(erro.message);

  const perfis = ((perfisRes.data ?? []) as LinhaPerfil[]).map(paraPerfil);
  const curtidos = new Set((curtidasRes.data ?? []).map((r) => r.post_id as string));
  const guardados = new Set((salvosRes.data ?? []).map((r) => r.post_id as string));

  const pinsPorPost = new Map<string, Pin[]>();
  for (const l of (pinsRes.data ?? []) as LinhaPin[]) {
    const lista = pinsPorPost.get(l.post_id);
    if (lista) lista.push(paraPin(l));
    else pinsPorPost.set(l.post_id, [paraPin(l)]);
  }

  const posts = ((postsRes.data ?? []) as LinhaPost[]).map((l) =>
    paraPost(l, pinsPorPost.get(l.id) ?? [], curtidos, guardados),
  );

  return { eu: perfis.find((p) => p.id === meuId) ?? null, perfis, posts };
}

/* ---------- escrita ---------- */

function extensao(mime: string): string {
  return mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
}

export async function publicarPost(input: {
  meuId: string;
  foto: ProcessedPhoto;
  cores: PaletteColor[];
  caption: string;
  pins: Pin[];
}): Promise<Post> {
  const db = sb();
  const { meuId, foto, cores, caption, pins } = input;

  const postId = crypto.randomUUID();
  const ext = extensao(foto.mime);
  // O prefixo com o id de quem posta não é organização: é o que a política de
  // storage no schema.sql exige para deixar o upload passar.
  const caminhoFull = `${meuId}/${postId}.${ext}`;
  const caminhoThumb = `${meuId}/${postId}-thumb.${ext}`;

  const enviar = async (caminho: string, blob: Blob) => {
    const { error } = await db.storage
      .from(BUCKET)
      .upload(caminho, blob, { contentType: foto.mime, upsert: false });
    if (error) throw new Error(`Falha ao enviar a foto: ${error.message}`);
  };

  await enviar(caminhoFull, foto.full);
  await enviar(caminhoThumb, foto.thumb);

  const familias = paletteFamilies(cores);
  const matizes = hueFamilies(cores);
  const descricao = describePalette(cores);

  const { data, error } = await db
    .from('posts')
    .insert({
      id: postId,
      author_id: meuId,
      caption: caption.trim(),
      image_path: caminhoFull,
      thumb_path: caminhoThumb,
      width: foto.width,
      height: foto.height,
      bytes: foto.bytes,
      mime: foto.mime,
      cores,
      familias,
      matizes,
      descricao,
    })
    .select()
    .single();

  if (error) {
    // Post sem linha no banco é foto órfã ocupando espaço para sempre.
    await db.storage.from(BUCKET).remove([caminhoFull, caminhoThumb]);
    throw new Error(`Falha ao publicar: ${error.message}`);
  }

  if (pins.length > 0) {
    const { error: erroPins } = await db.from('pins').insert(
      pins.map((p) => ({
        post_id: postId,
        x: p.x,
        y: p.y,
        peca: p.peca,
        categoria: p.categoria,
        marca: p.marca,
        onde: p.onde,
        preco: p.preco,
        link: p.link,
      })),
    );
    if (erroPins) throw new Error(`O look foi publicado, mas as peças não: ${erroPins.message}`);
  }

  const linha = data as LinhaPost;
  return paraPost({ ...linha, curtidas: 0 }, pins, new Set(), new Set());
}

export async function alternarCurtida(postId: string, meuId: string, curtir: boolean) {
  const db = sb();
  const { error } = curtir
    ? await db.from('curtidas').insert({ post_id: postId, user_id: meuId })
    : await db.from('curtidas').delete().eq('post_id', postId).eq('user_id', meuId);
  if (error) throw new Error(error.message);
}

export async function alternarSalvo(postId: string, meuId: string, salvar: boolean) {
  const db = sb();
  const { error } = salvar
    ? await db.from('salvos').insert({ post_id: postId, user_id: meuId })
    : await db.from('salvos').delete().eq('post_id', postId).eq('user_id', meuId);
  if (error) throw new Error(error.message);
}

export async function apagarPost(post: Post, meuId: string) {
  const db = sb();
  const ext = extensao(post.mime);

  const { error } = await db.from('posts').delete().eq('id', post.id);
  if (error) throw new Error(error.message);

  // As linhas de `pins` somem por cascade; os arquivos não têm cascade.
  await db.storage
    .from(BUCKET)
    .remove([`${meuId}/${post.id}.${ext}`, `${meuId}/${post.id}-thumb.${ext}`]);
}

export async function salvarPerfil(meuId: string, p: Partial<Profile>) {
  const { error } = await sb()
    .from('profiles')
    .update({
      nome: p.nome,
      handle: p.handle,
      bio: p.bio,
      cidade: p.cidade,
      avatar: p.avatar,
    })
    .eq('id', meuId);

  if (error) {
    if (error.code === '23505') throw new Error('Esse nome de usuário já está em uso.');
    throw new Error(error.message);
  }
}
