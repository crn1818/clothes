import { useMemo, useState } from 'react';
import { CartaoPost } from '../components/CartaoPost';
import { ChipsCor, ChipsPaleta, FolhaFiltros } from '../components/Filtros';
import { IconeBusca, IconeFiltro, IconeX, Vazio } from '../components/ui';
import { PALETTE_FAMILY_META } from '../lib/color/palettes';
import { HUE_FAMILY_LABEL } from '../lib/color/names';
import { filtrarPosts, useCroma } from '../lib/store';
import { comClima, comMatiz, filtroAtivo } from '../lib/types';

export function Feed({
  onCompor,
  onAbrirPerfil,
}: {
  onCompor: () => void;
  onAbrirPerfil: (id: string) => void;
}) {
  const {
    posts,
    perfis,
    eu,
    filtro,
    settings,
    setFiltro,
    limparFiltro,
    curtir,
    salvarPost,
    apagarPost,
  } = useCroma();

  const [buscando, setBuscando] = useState(false);
  const [folhaFiltros, setFolhaFiltros] = useState(false);

  const todosPerfis = useMemo(() => (eu ? [...perfis, eu] : perfis), [perfis, eu]);
  const visiveis = useMemo(
    () => filtrarPosts(posts, filtro, todosPerfis),
    [posts, filtro, todosPerfis],
  );

  const ativo = filtroAtivo(filtro);
  const nFiltros =
    filtro.familias.length + filtro.matizes.length + (filtro.soComPecas ? 1 : 0);

  return (
    <>
      <header className="topo">
        {buscando ? (
          <>
            <div className="busca">
              <span className="busca-icone">
                <IconeBusca />
              </span>
              <input
                className="entrada"
                autoFocus
                value={filtro.busca}
                placeholder="Peça, marca, loja, cor…"
                onChange={(e) => setFiltro((a) => ({ ...a, busca: e.target.value }))}
              />
            </div>
            <button
              className="icone-btn"
              onClick={() => {
                setBuscando(false);
                setFiltro((a) => ({ ...a, busca: '' }));
              }}
              aria-label="Fechar busca"
            >
              <IconeX />
            </button>
          </>
        ) : (
          <>
            <h1 className="marca">
              Cro<span>ma</span>
            </h1>
            <div className="topo-acoes">
              <button
                className="icone-btn"
                onClick={() => setBuscando(true)}
                aria-label="Buscar"
              >
                <IconeBusca tamanho={21} />
              </button>
              <button
                className={`icone-btn${nFiltros > 0 ? ' ativo' : ''}`}
                onClick={() => setFolhaFiltros(true)}
                aria-label="Filtrar por paleta"
                style={{ position: 'relative' }}
              >
                <IconeFiltro />
                {nFiltros > 0 && <span className="selo">{nFiltros}</span>}
              </button>
            </div>
          </>
        )}
      </header>

      <ChipsPaleta posts={posts} filtro={filtro} setFiltro={setFiltro} />
      <ChipsCor posts={posts} filtro={filtro} setFiltro={setFiltro} />

      {ativo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 16px 10px',
            fontSize: 13,
            color: 'var(--tinta-2)',
          }}
        >
          <strong style={{ color: 'var(--tinta)' }}>{visiveis.length}</strong>
          {visiveis.length === 1 ? 'look' : 'looks'}
          {filtro.familias.length > 0 &&
            ` · ${filtro.familias.map((f) => PALETTE_FAMILY_META[f].label).join(', ')}`}
          {filtro.matizes.length > 0 &&
            ` · ${filtro.matizes.map((m) => HUE_FAMILY_LABEL[m]).join(', ')}`}
          <button
            className="btn btn-fantasma"
            style={{ height: 28, padding: '0 12px', marginLeft: 'auto', fontSize: 12 }}
            onClick={limparFiltro}
          >
            Limpar
          </button>
        </div>
      )}

      {visiveis.length === 0 ? (
        ativo ? (
          <Vazio
            icone="◍"
            titulo="Nenhum look nessa paleta"
            texto="Tenta afrouxar o filtro — ou posta o primeiro look nessas cores."
            acao={
              <button className="btn btn-secundario" onClick={limparFiltro}>
                Limpar filtros
              </button>
            }
          />
        ) : (
          <Vazio
            icone="◐"
            titulo="O feed está vazio"
            texto="Poste o look de hoje. A paleta sai sozinha assim que a foto entra."
            acao={
              <button className="btn btn-primario" onClick={onCompor}>
                Postar um look
              </button>
            }
          />
        )
      ) : (
        visiveis.map((post) => (
          <CartaoPost
            key={post.id}
            post={post}
            autor={todosPerfis.find((p) => p.id === post.authorId)}
            souEu={post.authorId === eu?.id}
            mostrarPinsPadrao={settings.mostrarPins}
            onCurtir={() => curtir(post.id)}
            onSalvar={() => salvarPost(post.id)}
            onApagar={() => void apagarPost(post.id)}
            onFiltrarCor={(m) => setFiltro((a) => comMatiz(a, m))}
            onFiltrarClima={(c) => setFiltro((a) => comClima(a, c))}
            onAbrirPerfil={onAbrirPerfil}
          />
        ))
      )}

      {folhaFiltros && (
        <FolhaFiltros
          posts={posts}
          filtro={filtro}
          setFiltro={setFiltro}
          onLimpar={limparFiltro}
          onFechar={() => setFolhaFiltros(false)}
        />
      )}
    </>
  );
}
