import { useMemo, useState } from 'react';
import { Grade } from '../components/Grade';
import { TelaPost } from '../components/TelaPost';
import { FaixaPaleta } from '../components/Paleta';
import { Vazio } from '../components/ui';
import { describePalette, resumirPaletas } from '../lib/color/palettes';
import { useCroma } from '../lib/store';
import { comClima, comMatiz, type Filtro, type Post } from '../lib/types';

/** Os looks guardados — e, junto, a paleta que eles formam. */
export function Salvos({
  onExplorar,
  onExplorarCom,
  onAbrirPerfil,
}: {
  onExplorar: () => void;
  onExplorarCom: (fn: (atual: Filtro) => Filtro) => void;
  onAbrirPerfil: (id: string) => void;
}) {
  const { posts } = useCroma();
  const [aberto, setAberto] = useState<Post | null>(null);

  const salvos = useMemo(
    () => posts.filter((p) => p.salvo).sort((a, b) => b.createdAt - a.createdAt),
    [posts],
  );

  const paleta = useMemo(() => resumirPaletas(salvos.map((p) => p.cores)), [salvos]);

  return (
    <>
      <header className="topo">
        <h2 className="topo-titulo">Salvos</h2>
        <span className="mini topo-acoes">{salvos.length}</span>
      </header>

      {salvos.length === 0 ? (
        <Vazio
          icone="⌾"
          titulo="Nada salvo ainda"
          texto="Toque no marcador de um look para guardar aqui. Serve como referência de compra e de combinação."
          acao={
            <button className="btn btn-secundario" onClick={onExplorar}>
              Explorar paletas
            </button>
          }
        />
      ) : (
        <>
          <section className="carta" style={{ margin: '0 16px 14px', overflow: 'hidden' }}>
            <FaixaPaleta cores={paleta} altura={40} />
            <div style={{ padding: '10px 12px 12px' }}>
              <p className="titulo-secao" style={{ fontSize: 15 }}>
                O que você vem guardando
              </p>
              <p className="legenda">{describePalette(paleta)}</p>
            </div>
          </section>

          <Grade posts={salvos} onAbrir={setAberto} />
        </>
      )}

      {aberto && (
        <TelaPost
          post={posts.find((p) => p.id === aberto.id) ?? aberto}
          onFechar={() => setAberto(null)}
          onAbrirPerfil={onAbrirPerfil}
          onFiltrarCor={(m) => onExplorarCom((a) => comMatiz(a, m))}
          onFiltrarClima={(c) => onExplorarCom((a) => comClima(a, c))}
        />
      )}
    </>
  );
}
