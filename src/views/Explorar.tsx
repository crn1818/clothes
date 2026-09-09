import { useMemo, useState } from 'react';
import { Grade } from '../components/Grade';
import { TelaPost } from '../components/TelaPost';
import { ChipsCor } from '../components/Filtros';
import { IconeBusca, IconeX, Vazio } from '../components/ui';
import {
  PALETTE_FAMILY_META,
  PALETTE_FAMILY_ORDER,
} from '../lib/color/palettes';
import { filtrarPosts, useCroma } from '../lib/store';
import { comClima, comMatiz, filtroAtivo, type PaletteFamily, type Post } from '../lib/types';

/**
 * Explorar é a tela onde a paleta vem antes da foto.
 *
 * O feed é cronológico; aqui a entrada é o clima da cor — escolhe-se "terrosa"
 * e vê-se tudo que é terroso, de qualquer pessoa, de qualquer dia.
 */
export function Explorar({ onAbrirPerfil }: { onAbrirPerfil: (id: string) => void }) {
  const { posts, perfis, eu, filtro, setFiltro, limparFiltro } = useCroma();
  const [aberto, setAberto] = useState<Post | null>(null);

  const todosPerfis = useMemo(() => (eu ? [...perfis, eu] : perfis), [perfis, eu]);
  const visiveis = useMemo(
    () => filtrarPosts(posts, filtro, todosPerfis),
    [posts, filtro, todosPerfis],
  );

  const contagem = useMemo(() => {
    const m = new Map<PaletteFamily, number>();
    for (const p of posts) for (const f of p.familias) m.set(f, (m.get(f) ?? 0) + 1);
    return m;
  }, [posts]);

  const familias = PALETTE_FAMILY_ORDER.filter((f) => (contagem.get(f) ?? 0) > 0);
  const ativo = filtroAtivo(filtro);

  const alternarFamilia = (f: PaletteFamily) =>
    setFiltro((atual) => ({
      ...atual,
      familias: atual.familias.includes(f)
        ? atual.familias.filter((x) => x !== f)
        : [...atual.familias, f],
    }));

  return (
    <>
      <header className="topo">
        <h2 className="topo-titulo">Explorar por paleta</h2>
        {ativo && (
          <button
            className="icone-btn topo-acoes"
            onClick={limparFiltro}
            aria-label="Limpar filtros"
          >
            <IconeX />
          </button>
        )}
      </header>

      <div className="secao" style={{ paddingBottom: 8 }}>
        <div className="busca">
          <span className="busca-icone">
            <IconeBusca />
          </span>
          <input
            className="entrada"
            value={filtro.busca}
            placeholder="Buscar por peça, marca, loja ou cor…"
            onChange={(e) => setFiltro((a) => ({ ...a, busca: e.target.value }))}
          />
        </div>
      </div>

      {familias.length > 0 && (
        <>
          <p className="campo-rotulo" style={{ padding: '4px 16px 0' }}>
            Clima da paleta
          </p>
          <div className="paleta-cartoes">
            {familias.map((f) => {
              const meta = PALETTE_FAMILY_META[f];
              return (
                <button
                  key={f}
                  className="paleta-cartao"
                  aria-pressed={filtro.familias.includes(f)}
                  onClick={() => alternarFamilia(f)}
                >
                  <span className="paleta-cartao-cores">
                    {meta.swatch.map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                  <span className="paleta-cartao-txt">
                    <strong>
                      {meta.label}{' '}
                      <span
                        style={{
                          fontFamily: 'var(--ui)',
                          fontSize: 12,
                          color: 'var(--tinta-3)',
                          fontWeight: 500,
                        }}
                      >
                        {contagem.get(f)}
                      </span>
                    </strong>
                    <span>{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="campo-rotulo" style={{ padding: '0 16px 0' }}>
        Cor presente no look
      </p>
      <ChipsCor posts={posts} filtro={filtro} setFiltro={setFiltro} />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          padding: '10px 16px 8px',
          fontSize: 13,
          color: 'var(--tinta-2)',
        }}
      >
        <strong style={{ color: 'var(--tinta)' }}>{visiveis.length}</strong>
        {visiveis.length === 1 ? 'look encontrado' : 'looks encontrados'}
      </div>

      {visiveis.length === 0 ? (
        <Vazio
          icone="◍"
          titulo="Nada nessa combinação"
          texto="Nenhum look bate com todos os filtros ao mesmo tempo."
          acao={
            <button className="btn btn-secundario" onClick={limparFiltro}>
              Limpar filtros
            </button>
          }
        />
      ) : (
        <Grade posts={visiveis} onAbrir={setAberto} />
      )}

      {aberto && (
        <TelaPost
          post={posts.find((p) => p.id === aberto.id) ?? aberto}
          onFechar={() => setAberto(null)}
          onAbrirPerfil={onAbrirPerfil}
          onFiltrarCor={(m) => setFiltro((a) => comMatiz(a, m))}
          onFiltrarClima={(c) => setFiltro((a) => comClima(a, c))}
        />
      )}
    </>
  );
}
