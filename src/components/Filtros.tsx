import { Folha, IconeCheque } from './ui';
import {
  PALETTE_FAMILY_META,
  PALETTE_FAMILY_ORDER,
} from '../lib/color/palettes';
import {
  HUE_FAMILY_LABEL,
  HUE_FAMILY_ORDER,
  HUE_FAMILY_SWATCH,
} from '../lib/color/names';
import type { Filtro, HueFamily, PaletteFamily, Post } from '../lib/types';

/**
 * O filtro por paleta.
 *
 * Dois eixos separados porque respondem a perguntas diferentes: "clima" é como
 * a pessoa descreve o que quer vestir ("algo terroso"), "cor" é o que ela está
 * caçando no armário ("preciso de alguma coisa azul"). Juntar os dois num
 * filtro só faria "terrosa" e "marrons" competirem sendo quase sinônimos.
 */

export function contarFamilias(posts: Post[]): Map<PaletteFamily, number> {
  const m = new Map<PaletteFamily, number>();
  for (const p of posts) for (const f of p.familias) m.set(f, (m.get(f) ?? 0) + 1);
  return m;
}

export function contarMatizes(posts: Post[]): Map<HueFamily, number> {
  const m = new Map<HueFamily, number>();
  for (const p of posts) for (const h of p.matizes) m.set(h, (m.get(h) ?? 0) + 1);
  return m;
}

function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}

/** Fila horizontal de chips de clima — o filtro rápido, no topo do feed. */
export function ChipsPaleta({
  posts,
  filtro,
  setFiltro,
}: {
  posts: Post[];
  filtro: Filtro;
  setFiltro: (f: (atual: Filtro) => Filtro) => void;
}) {
  const contagem = contarFamilias(posts);
  const familias = PALETTE_FAMILY_ORDER.filter((f) => (contagem.get(f) ?? 0) > 0);

  if (familias.length === 0) return null;

  return (
    <div className="chips" role="group" aria-label="Filtrar por paleta">
      {familias.map((f) => {
        const meta = PALETTE_FAMILY_META[f];
        const ativo = filtro.familias.includes(f);
        return (
          <button
            key={f}
            className="chip"
            aria-pressed={ativo}
            onClick={() =>
              setFiltro((atual) => ({ ...atual, familias: alternar(atual.familias, f) }))
            }
            title={meta.hint}
          >
            <span className="chip-amostra trio">
              {meta.swatch.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            {meta.label}
            <span className="chip-contagem">{contagem.get(f)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Fila horizontal de chips de cor. */
export function ChipsCor({
  posts,
  filtro,
  setFiltro,
}: {
  posts: Post[];
  filtro: Filtro;
  setFiltro: (f: (atual: Filtro) => Filtro) => void;
}) {
  const contagem = contarMatizes(posts);
  const matizes = HUE_FAMILY_ORDER.filter((h) => (contagem.get(h) ?? 0) > 0);

  if (matizes.length === 0) return null;

  return (
    <div className="chips" role="group" aria-label="Filtrar por cor">
      {matizes.map((h) => {
        const ativo = filtro.matizes.includes(h);
        return (
          <button
            key={h}
            className="chip"
            aria-pressed={ativo}
            onClick={() =>
              setFiltro((atual) => ({ ...atual, matizes: alternar(atual.matizes, h) }))
            }
          >
            <span className="chip-amostra">
              <i style={{ background: HUE_FAMILY_SWATCH[h] }} />
            </span>
            {HUE_FAMILY_LABEL[h]}
            <span className="chip-contagem">{contagem.get(h)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FolhaFiltros({
  posts,
  filtro,
  setFiltro,
  onLimpar,
  onFechar,
}: {
  posts: Post[];
  filtro: Filtro;
  setFiltro: (f: (atual: Filtro) => Filtro) => void;
  onLimpar: () => void;
  onFechar: () => void;
}) {
  const contFamilias = contarFamilias(posts);
  const contMatizes = contarMatizes(posts);
  const comPecas = posts.filter((p) => p.pins.length > 0).length;

  return (
    <Folha
      titulo="Filtrar por paleta"
      onFechar={onFechar}
      acao={
        <button className="btn btn-fantasma" style={{ height: 34 }} onClick={onLimpar}>
          Limpar
        </button>
      }
    >
      <p className="campo-rotulo">Clima da paleta</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
        {PALETTE_FAMILY_ORDER.map((f) => {
          const meta = PALETTE_FAMILY_META[f];
          const n = contFamilias.get(f) ?? 0;
          return (
            <button
              key={f}
              className="chip"
              aria-pressed={filtro.familias.includes(f)}
              disabled={n === 0}
              style={n === 0 ? { opacity: 0.35 } : undefined}
              onClick={() =>
                setFiltro((atual) => ({ ...atual, familias: alternar(atual.familias, f) }))
              }
              title={meta.hint}
            >
              <span className="chip-amostra trio">
                {meta.swatch.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              {meta.label}
              <span className="chip-contagem">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="campo-rotulo">Cor presente no look</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
        {HUE_FAMILY_ORDER.map((h) => {
          const n = contMatizes.get(h) ?? 0;
          return (
            <button
              key={h}
              className="chip"
              aria-pressed={filtro.matizes.includes(h)}
              disabled={n === 0}
              style={n === 0 ? { opacity: 0.35 } : undefined}
              onClick={() =>
                setFiltro((atual) => ({ ...atual, matizes: alternar(atual.matizes, h) }))
              }
            >
              <span className="chip-amostra">
                <i style={{ background: HUE_FAMILY_SWATCH[h] }} />
              </span>
              {HUE_FAMILY_LABEL[h]}
              <span className="chip-contagem">{n}</span>
            </button>
          );
        })}
      </div>

      <button
        className="opcao"
        aria-pressed={filtro.soComPecas}
        onClick={() => setFiltro((atual) => ({ ...atual, soComPecas: !atual.soComPecas }))}
      >
        <span className="opcao-marca">{filtro.soComPecas && <IconeCheque />}</span>
        <span>
          <strong>Só looks com peças etiquetadas</strong>
          <span>
            {comPecas} de {posts.length} looks dizem de onde é cada peça.
          </span>
        </span>
      </button>

      <button
        className="btn btn-primario btn-bloco"
        style={{ marginTop: 16 }}
        onClick={onFechar}
      >
        Ver resultados
      </button>
    </Folha>
  );
}
