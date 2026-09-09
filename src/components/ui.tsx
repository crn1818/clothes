import { useEffect, useState, type ReactNode } from 'react';
import { imageUrl, cachedUrl } from '../lib/idb';
import type { Post, Profile } from '../lib/types';

/* ---------- ícones ----------
   Traçado único de 1.7px em todos: um conjunto de ícones que não combina entre
   si é a coisa que mais rápido faz um app parecer amador. */

interface IconeProps {
  tamanho?: number;
  preenchido?: boolean;
}

function Svg({ children, tamanho = 22 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconeFeed = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M4 5h16M4 12h16M4 19h10" />
  </Svg>
);

export const IconeExplorar = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.2 8.8 13.6 13.6 8.8 15.2l1.6-4.8z" />
  </Svg>
);

export const IconeMais = ({ tamanho = 22 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconeSalvo = ({ tamanho, preenchido }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M6 4h12v16l-6-4.2L6 20z" fill={preenchido ? 'currentColor' : 'none'} />
  </Svg>
);

export const IconePerfil = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <circle cx="12" cy="8.5" r="3.7" />
    <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
  </Svg>
);

export const IconeCoracao = ({ tamanho, preenchido }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path
      d="M12 20s-7.3-4.5-7.3-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.3 2.7C19.3 15.5 12 20 12 20z"
      fill={preenchido ? 'currentColor' : 'none'}
    />
  </Svg>
);

export const IconeBusca = ({ tamanho = 17 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <circle cx="11" cy="11" r="6.3" />
    <path d="m16 16 4 4" />
  </Svg>
);

export const IconeX = ({ tamanho = 20 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const IconeAjustes = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 3.4v2.2M12 18.4v2.2M20.6 12h-2.2M5.6 12H3.4M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9" />
  </Svg>
);

export const IconeEtiqueta = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M3.8 12.6 11.4 5a2 2 0 0 1 1.4-.6H19a1 1 0 0 1 1 1v6.2a2 2 0 0 1-.6 1.4l-7.6 7.6a1.6 1.6 0 0 1-2.3 0l-5.7-5.7a1.6 1.6 0 0 1 0-2.3z" />
    <circle cx="15.6" cy="8.4" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconeFiltro = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);

export const IconeVoltar = ({ tamanho }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M15 5 8 12l7 7" />
  </Svg>
);

export const IconeCamera = ({ tamanho = 30 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M3.5 8.5h3.2l1.5-2.3h7.6l1.5 2.3h3.2v10.2H3.5z" />
    <circle cx="12" cy="13.4" r="3.5" />
  </Svg>
);

export const IconeLixo = ({ tamanho = 18 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M4.8 6.6h14.4M9.4 6.6V4.8h5.2v1.8M6.6 6.6l.9 12.6h9l.9-12.6" />
  </Svg>
);

export const IconeCheque = ({ tamanho = 12 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="m5 12.5 4.4 4.4L19 7.3" strokeWidth="2.6" />
  </Svg>
);

export const IconeOlho = ({ tamanho = 15 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12z" />
    <circle cx="12" cy="12" r="2.7" />
  </Svg>
);

export const IconeLink = ({ tamanho = 13 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1L11.6 7.3" />
    <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
  </Svg>
);

export const IconePino = ({ tamanho = 14 }: IconeProps) => (
  <Svg tamanho={tamanho}>
    <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" />
    <circle cx="12" cy="10.4" r="2.3" />
  </Svg>
);

/* ---------- avatar ---------- */

export function Avatar({ perfil, grande }: { perfil?: Profile; grande?: boolean }) {
  const [a, b] = perfil?.avatar ?? ['#B7ADA0', '#6E675F'];
  const inicial = (perfil?.nome ?? '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`avatar${grande ? ' g' : ''}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden="true"
    >
      {inicial}
    </div>
  );
}

/* ---------- folha inferior ---------- */

export function Folha({
  titulo,
  onFechar,
  children,
  acao,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  acao?: ReactNode;
}) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', esc);
    };
  }, [onFechar]);

  return (
    <div
      className="cortina"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="folha" onClick={(e) => e.stopPropagation()}>
        <div className="folha-pega" />
        <div className="folha-topo">
          <h3>{titulo}</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {acao}
            <button className="icone-btn" onClick={onFechar} aria-label="Fechar">
              <IconeX />
            </button>
          </div>
        </div>
        <div className="folha-corpo">{children}</div>
      </div>
    </div>
  );
}

/* ---------- imagem guardada ---------- */

/** O bastante de um post para achar a foto dele, nos dois modos. */
export type FonteImagem = Pick<Post, 'imageId' | 'urlFull' | 'urlThumb'>;

/**
 * Resolve a foto de um post.
 *
 * No modo rede a URL já veio pronta do storage e não há nada a fazer. No modo
 * local ela precisa ser criada a partir do blob no IndexedDB — e aí o cache
 * síncrono importa, senão uma foto já vista pisca em branco ao rolar o feed
 * de volta.
 */
export function useImagem(post: FonteImagem, variante: 'full' | 'thumb' = 'full') {
  const direta = variante === 'thumb' ? post.urlThumb : post.urlFull;
  const { imageId } = post;

  const [url, setUrl] = useState<string | null>(
    () => direta ?? cachedUrl(imageId, variante) ?? null,
  );

  useEffect(() => {
    if (direta) {
      setUrl(direta);
      return;
    }

    const pronto = cachedUrl(imageId, variante);
    if (pronto) {
      setUrl(pronto);
      return;
    }

    let vivo = true;
    setUrl(null);
    void imageUrl(imageId, variante).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [imageId, variante, direta]);

  return url;
}

export function Vazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: string;
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  return (
    <div className="vazio">
      <div className="vazio-icone">{icone}</div>
      <p style={{ fontWeight: 600, color: 'var(--tinta)', margin: '0 0 4px' }}>{titulo}</p>
      <p className="legenda" style={{ maxWidth: 300, margin: '0 auto' }}>
        {texto}
      </p>
      {acao && <div style={{ marginTop: 16 }}>{acao}</div>}
    </div>
  );
}

/** "há 3 dias", "agora" — datas absolutas num feed social só atrapalham. */
export function tempoRelativo(ts: number): string {
  const seg = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const hor = Math.floor(min / 60);
  if (hor < 24) return `há ${hor} h`;
  const dia = Math.floor(hor / 24);
  if (dia === 1) return 'ontem';
  if (dia < 7) return `há ${dia} dias`;
  const sem = Math.floor(dia / 7);
  if (sem < 5) return `há ${sem} sem`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
