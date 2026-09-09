import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as idb from './idb';
import * as rede from './rede';
import { clienteAtual, iniciarCliente, modoRede } from './supabase';
import { processPhoto, type ProcessedPhoto } from './image';
import { extractPalette } from './color/extract';
import { paletteFamilies, hueFamilies, describePalette } from './color/palettes';
import { LOOKS, PERFIS_EXEMPLO, lookSvg, svgToPngBlob } from './looks';
import {
  DEFAULT_SETTINGS,
  FILTRO_VAZIO,
  novoId,
  type Filtro,
  type PaletteColor,
  type Pin,
  type Post,
  type Profile,
  type Settings,
} from './types';

const KV_EU = 'eu';
const KV_SETTINGS = 'settings';
const KV_SEEDED = 'exemplos-v1';

export type Modo = 'local' | 'rede';

interface CriarPostInput {
  foto: ProcessedPhoto;
  cores: PaletteColor[];
  caption: string;
  pins: Pin[];
}

interface Estado {
  pronto: boolean;
  erro: string | null;
  progresso: string | null;
  /** 'rede' quando há um projeto Supabase configurado. */
  modo: Modo;
  /** Em rede, null significa "ninguém logado" — o app mostra a tela de entrada. */
  sessaoId: string | null;
  eu: Profile | null;
  perfis: Profile[];
  posts: Post[];
  settings: Settings;
  filtro: Filtro;
}

interface Acoes {
  publicar: (input: CriarPostInput) => Promise<string>;
  curtir: (id: string) => void;
  salvarPost: (id: string) => void;
  apagarPost: (id: string) => Promise<void>;
  setFiltro: (f: Filtro | ((atual: Filtro) => Filtro)) => void;
  limparFiltro: () => void;
  setSettings: (s: Partial<Settings>) => void;
  atualizarPerfil: (p: Partial<Profile>) => Promise<void>;
  removerExemplos: () => Promise<void>;
  recriarExemplos: () => Promise<void>;
  apagarTudo: () => Promise<void>;
  sair: () => Promise<void>;
  /** Relê o IndexedDB — usado depois de restaurar um backup. */
  recarregarLocal: () => Promise<void>;
  perfilDe: (id: string) => Profile | undefined;
}

const Ctx = createContext<(Estado & Acoes) | null>(null);

export function useCroma() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCroma precisa estar dentro de <CromaProvider>.');
  return ctx;
}

function perfilPadrao(): Profile {
  return {
    id: 'eu',
    handle: 'voce',
    nome: 'Você',
    bio: 'Meu arquivo de looks.',
    avatar: ['#C97F4E', '#5E7C8B'],
    cidade: '',
  };
}

/** Monta o registro de post a partir da foto processada e da paleta. */
function montarPost(
  id: string,
  authorId: string,
  foto: Pick<ProcessedPhoto, 'width' | 'height' | 'bytes' | 'mime'>,
  cores: PaletteColor[],
  caption: string,
  pins: Pin[],
  extras: Partial<Post> = {},
): Post {
  return {
    id,
    authorId,
    createdAt: Date.now(),
    caption,
    imageId: id,
    width: foto.width,
    height: foto.height,
    bytes: foto.bytes,
    mime: foto.mime,
    cores,
    familias: paletteFamilies(cores),
    matizes: hueFamilies(cores),
    descricao: describePalette(cores),
    pins,
    curtidas: 0,
    curtiuEu: false,
    salvo: false,
    ...extras,
  };
}

/**
 * O seed é caro e assíncrono, e o StrictMode monta o provider duas vezes.
 *
 * Guardar a *promessa* em vez de um booleano é o que faz a segunda montagem
 * esperar pela primeira em vez de seguir em frente e ler o banco ainda vazio —
 * era assim que o feed nascia sem nenhum look mesmo com tudo gravado.
 */
let semeadura: Promise<Post[]> | null = null;

export function CromaProvider({ children }: { children: ReactNode }) {
  const modo: Modo = modoRede() ? 'rede' : 'local';

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [eu, setEu] = useState<Profile | null>(null);
  const [perfis, setPerfis] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [filtro, setFiltroState] = useState<Filtro>(FILTRO_VAZIO);

  /* Preferências de aparência e qualidade são do aparelho, não da conta —
     ficam no IndexedDB local nos dois modos. */
  const carregarSettings = useCallback(async () => {
    const salvas = await idb.getKV<Settings>(KV_SETTINGS).catch(() => undefined);
    setSettingsState({ ...DEFAULT_SETTINGS, ...(salvas ?? {}) });
  }, []);

  /* ---------- modo local ---------- */

  const semear = useCallback((forcar = false): Promise<Post[]> => {
    if (!forcar && semeadura) return semeadura;

    const trabalho = (async () => {
      for (const p of PERFIS_EXEMPLO) {
        await idb.putProfile({ ...p, demo: true });
      }

      const criados: Post[] = [];
      for (let i = 0; i < LOOKS.length; i++) {
        const look = LOOKS[i];
        setProgresso(`Revelando os looks de exemplo… ${i + 1}/${LOOKS.length}`);

        const png = await svgToPngBlob(lookSvg(look));
        const foto = await processPhoto(png, 'equilibrada');
        const cores = extractPalette(foto.analysis);

        await idb.putImage({
          id: look.id,
          full: foto.full,
          thumb: foto.thumb,
          width: foto.width,
          height: foto.height,
          mime: foto.mime,
          bytes: foto.bytes,
        });

        const post = montarPost(
          look.id,
          look.autor,
          foto,
          cores,
          look.caption,
          look.pins.map((p) => ({ ...p, id: novoId('pin-') })),
          {
            createdAt: Date.now() - look.diasAtras * 86_400_000 - i * 3_600_000,
            curtidas: look.curtidas,
            demo: true,
          },
        );

        await idb.putPost(post);
        criados.push(post);
      }

      await idb.setKV(KV_SEEDED, true);
      return criados;
    })().finally(() => setProgresso(null));

    semeadura = trabalho;
    return trabalho;
  }, []);

  const carregarLocal = useCallback(async () => {
    void idb.requestPersistence();

    const [euSalvo, jaSemeado] = await Promise.all([
      idb.getKV<Profile>(KV_EU),
      idb.getKV<boolean>(KV_SEEDED),
    ]);

    const meuPerfil = euSalvo ?? perfilPadrao();
    if (!euSalvo) await idb.setKV(KV_EU, meuPerfil);

    if (!jaSemeado) await semear();

    const [todosPerfis, todosPosts] = await Promise.all([
      idb.allProfiles(),
      idb.allPosts(),
    ]);

    setEu(meuPerfil);
    setPerfis(todosPerfis);
    setPosts(todosPosts.sort((a, b) => b.createdAt - a.createdAt));
  }, [semear]);

  /* ---------- modo rede ---------- */

  const carregarRede = useCallback(async (userId: string) => {
    const dados = await rede.carregarTudo(userId);
    setEu(dados.eu);
    setPerfis(dados.perfis);
    setPosts(dados.posts);
  }, []);

  /* ---------- carga inicial ---------- */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        await carregarSettings();

        if (modo === 'local') {
          await carregarLocal();
          if (!cancelado) setPronto(true);
          return;
        }

        const cliente = await iniciarCliente();
        if (!cliente) throw new Error('Modo rede configurado mas sem cliente.');

        const { data } = await cliente.auth.getSession();
        const id = data.session?.user.id ?? null;
        if (cancelado) return;

        setSessaoId(id);
        if (id) await carregarRede(id);
        if (!cancelado) setPronto(true);
      } catch (e) {
        if (cancelado) return;
        setErro(
          e instanceof Error
            ? e.message
            : 'Não consegui carregar. Confira a conexão e as credenciais.',
        );
        setPronto(true);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [modo, carregarSettings, carregarLocal, carregarRede]);

  /* Entrar e sair recarregam o feed inteiro: o que se vê depende de quem é. */
  useEffect(() => {
    if (modo !== 'rede') return;
    const cliente = clienteAtual();
    if (!cliente) return;

    const { data } = cliente.auth.onAuthStateChange((_evento, sessao) => {
      const id = sessao?.user.id ?? null;
      setSessaoId((anterior) => {
        if (anterior === id) return anterior;
        if (id) {
          void carregarRede(id).catch((e: unknown) =>
            setErro(e instanceof Error ? e.message : 'Falha ao carregar o feed.'),
          );
        } else {
          setEu(null);
          setPerfis([]);
          setPosts([]);
        }
        return id;
      });
    });

    return () => data.subscription.unsubscribe();
  }, [modo, carregarRede]);

  /* ---------- ações ---------- */

  const publicar = useCallback(
    async ({ foto, cores, caption, pins }: CriarPostInput) => {
      if (modo === 'rede') {
        if (!sessaoId) throw new Error('Entre na sua conta para publicar.');
        const post = await rede.publicarPost({ meuId: sessaoId, foto, cores, caption, pins });
        setPosts((atual) => [post, ...atual]);
        return post.id;
      }

      if (!eu) throw new Error('Perfil ainda carregando.');
      const id = novoId('post-');

      await idb.putImage({
        id,
        full: foto.full,
        thumb: foto.thumb,
        width: foto.width,
        height: foto.height,
        mime: foto.mime,
        bytes: foto.bytes,
      });

      const post = montarPost(id, eu.id, foto, cores, caption.trim(), pins);
      await idb.putPost(post);
      setPosts((atual) => [post, ...atual]);
      return id;
    },
    [modo, sessaoId, eu],
  );

  /**
   * Curtir e salvar mudam a tela na hora e só depois avisam o servidor.
   * Esperar a ida e volta para pintar um coração faria o app parecer travado;
   * se der erro, o estado volta ao que era.
   */
  const alternar = useCallback(
    (id: string, campo: 'curtiuEu' | 'salvo') => {
      let anterior: Post | undefined;

      setPosts((atual) =>
        atual.map((p) => {
          if (p.id !== id) return p;
          anterior = p;
          const ligado = !p[campo];
          return {
            ...p,
            [campo]: ligado,
            ...(campo === 'curtiuEu'
              ? { curtidas: Math.max(0, p.curtidas + (ligado ? 1 : -1)) }
              : {}),
          };
        }),
      );

      if (!anterior) return;
      const ligado = !anterior[campo];
      const reverter = (e: unknown) => {
        setPosts((atual) => atual.map((p) => (p.id === id ? anterior! : p)));
        setErro(e instanceof Error ? e.message : 'Não consegui salvar essa ação.');
      };

      if (modo === 'rede') {
        if (!sessaoId) return;
        const chamada =
          campo === 'curtiuEu'
            ? rede.alternarCurtida(id, sessaoId, ligado)
            : rede.alternarSalvo(id, sessaoId, ligado);
        void chamada.catch(reverter);
      } else {
        const atualizado: Post = {
          ...anterior,
          [campo]: ligado,
          ...(campo === 'curtiuEu'
            ? { curtidas: Math.max(0, anterior.curtidas + (ligado ? 1 : -1)) }
            : {}),
        };
        void idb.putPost(atualizado).catch(reverter);
      }
    },
    [modo, sessaoId],
  );

  const curtir = useCallback((id: string) => alternar(id, 'curtiuEu'), [alternar]);
  const salvarPost = useCallback((id: string) => alternar(id, 'salvo'), [alternar]);

  const apagarPost = useCallback(
    async (id: string) => {
      const alvo = posts.find((p) => p.id === id);
      if (!alvo) return;

      if (modo === 'rede') {
        if (!sessaoId) return;
        await rede.apagarPost(alvo, sessaoId);
      } else {
        await Promise.all([idb.deletePost(id), idb.deleteImage(id)]);
      }
      setPosts((atual) => atual.filter((p) => p.id !== id));
    },
    [modo, sessaoId, posts],
  );

  const setFiltro = useCallback((f: Filtro | ((atual: Filtro) => Filtro)) => {
    setFiltroState((atual) => (typeof f === 'function' ? f(atual) : f));
  }, []);

  const limparFiltro = useCallback(() => setFiltroState(FILTRO_VAZIO), []);

  const setSettings = useCallback((parcial: Partial<Settings>) => {
    setSettingsState((atual) => {
      const proximo = { ...atual, ...parcial };
      void idb.setKV(KV_SETTINGS, proximo);
      return proximo;
    });
  }, []);

  const atualizarPerfil = useCallback(
    async (parcial: Partial<Profile>) => {
      if (modo === 'rede') {
        if (!sessaoId) return;
        await rede.salvarPerfil(sessaoId, parcial);
        setEu((atual) => (atual ? { ...atual, ...parcial } : atual));
        setPerfis((atual) =>
          atual.map((p) => (p.id === sessaoId ? { ...p, ...parcial } : p)),
        );
        return;
      }

      setEu((atual) => {
        if (!atual) return atual;
        const proximo = { ...atual, ...parcial };
        void idb.setKV(KV_EU, proximo);
        return proximo;
      });
    },
    [modo, sessaoId],
  );

  const removerExemplos = useCallback(async () => {
    const demos = posts.filter((p) => p.demo);
    await Promise.all(demos.flatMap((p) => [idb.deletePost(p.id), idb.deleteImage(p.id)]));
    setPosts((atual) => atual.filter((p) => !p.demo));
  }, [posts]);

  const recriarExemplos = useCallback(async () => {
    const criados = await semear(true);
    setPosts((atual) =>
      [...atual.filter((p) => !p.demo), ...criados].sort((a, b) => b.createdAt - a.createdAt),
    );
    setPerfis(await idb.allProfiles());
  }, [semear]);

  const apagarTudo = useCallback(async () => {
    await idb.wipeAll();
    setPosts([]);
    setPerfis([]);
    const novo = perfilPadrao();
    await idb.setKV(KV_EU, novo);
    setEu(novo);
  }, []);

  const sair = useCallback(async () => {
    const cliente = clienteAtual();
    if (cliente) await cliente.auth.signOut();
  }, []);

  const perfilDe = useCallback(
    (id: string) => (eu && id === eu.id ? eu : perfis.find((p) => p.id === id)),
    [eu, perfis],
  );

  const valor = useMemo(
    () => ({
      pronto,
      erro,
      progresso,
      modo,
      sessaoId,
      eu,
      perfis,
      posts,
      settings,
      filtro,
      publicar,
      curtir,
      salvarPost,
      apagarPost,
      setFiltro,
      limparFiltro,
      setSettings,
      atualizarPerfil,
      removerExemplos,
      recriarExemplos,
      apagarTudo,
      sair,
      recarregarLocal: carregarLocal,
      perfilDe,
    }),
    [
      pronto,
      erro,
      progresso,
      modo,
      sessaoId,
      eu,
      perfis,
      posts,
      settings,
      filtro,
      publicar,
      curtir,
      salvarPost,
      apagarPost,
      setFiltro,
      limparFiltro,
      setSettings,
      atualizarPerfil,
      removerExemplos,
      recriarExemplos,
      apagarTudo,
      sair,
      carregarLocal,
      perfilDe,
    ],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Aplica o filtro de paletas.
 *
 * Chips de clima e chips de cor se combinam com E entre os grupos e OU dentro
 * de cada grupo: "terrosa + azuis" quer dizer "paleta terrosa que tenha azul",
 * que é como as pessoas descrevem o que estão procurando.
 */
export function filtrarPosts(posts: Post[], filtro: Filtro, perfis: Profile[]): Post[] {
  const busca = filtro.busca.trim().toLowerCase();

  return posts.filter((post) => {
    if (filtro.familias.length > 0 && !filtro.familias.some((f) => post.familias.includes(f))) {
      return false;
    }
    if (filtro.matizes.length > 0 && !filtro.matizes.some((m) => post.matizes.includes(m))) {
      return false;
    }
    if (filtro.soComPecas && post.pins.length === 0) return false;

    if (busca) {
      const autor = perfis.find((p) => p.id === post.authorId);
      const alvo = [
        post.caption,
        post.descricao,
        autor?.nome ?? '',
        autor?.handle ?? '',
        ...post.cores.map((c) => c.name),
        ...post.pins.flatMap((p) => [p.peca, p.marca, p.onde]),
      ]
        .join(' ')
        .toLowerCase();
      if (!alvo.includes(busca)) return false;
    }

    return true;
  });
}
