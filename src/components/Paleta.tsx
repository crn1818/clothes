import type { PaletteColor } from '../lib/types';

/** Faixa proporcional: cada cor ocupa o quanto ela ocupa do look. */
export function FaixaPaleta({
  cores,
  altura,
}: {
  cores: PaletteColor[];
  altura?: number;
}) {
  if (cores.length === 0) return null;
  return (
    <div className="paleta-faixa" style={altura ? { height: altura } : undefined}>
      {cores.map((c, i) => (
        <i
          key={`${c.hex}-${i}`}
          style={{ flexGrow: c.share, background: c.hex }}
          title={`${c.name} · ${Math.round(c.share * 100)}%`}
        />
      ))}
    </div>
  );
}

/** Os nomes das cores em português, com a fatia de cada uma. */
export function EtiquetasCores({
  cores,
  limite,
}: {
  cores: PaletteColor[];
  limite?: number;
}) {
  const lista = limite ? cores.slice(0, limite) : cores;
  if (lista.length === 0) return null;

  return (
    <div className="paleta-legenda">
      {lista.map((c, i) => (
        <span className="cor-etiqueta" key={`${c.hex}-${i}`}>
          <i style={{ background: c.hex }} />
          {c.name}
          <b>{Math.round(c.share * 100)}%</b>
        </span>
      ))}
    </div>
  );
}

/**
 * A coluna de cores que fica ao lado da foto no compositor.
 *
 * Fica encostada na imagem de propósito: a leitura pretendida é "esta foto ⇒
 * estas cores", e a paleta aparece sozinha assim que a foto entra, sem que
 * ninguém precise apertar nada.
 */
export function TrilhoPaleta({
  cores,
  carregando,
}: {
  cores: PaletteColor[];
  carregando?: boolean;
}) {
  if (carregando) {
    return (
      <div className="trilho" aria-live="polite">
        <p className="mini" style={{ margin: 0 }}>
          Lendo as cores…
        </p>
        {[0, 1, 2, 3].map((i) => (
          <div className="trilho-item" key={i}>
            <div
              className="trilho-cor"
              style={{ background: 'var(--linha)', animation: 'pisca 1.1s infinite', animationDelay: `${i * 0.12}s` }}
            />
            <div style={{ flex: 1, height: 9, borderRadius: 4, background: 'var(--linha)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (cores.length === 0) return <div className="trilho" />;

  return (
    <div className="trilho" aria-live="polite">
      <p className="mini" style={{ margin: 0, fontWeight: 600, letterSpacing: '0.04em' }}>
        PALETA
      </p>
      {cores.map((c, i) => (
        <div className="trilho-item" key={`${c.hex}-${i}`}>
          <span className="trilho-cor" style={{ background: c.hex }} />
          <span className="trilho-nome">
            {c.name}
            <span className="trilho-pct" style={{ display: 'block' }}>
              {Math.round(c.share * 100)}% · {c.hex}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
