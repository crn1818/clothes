import { useEffect } from 'react';
import { CartaoPost } from './CartaoPost';
import { IconeVoltar } from './ui';
import { useCroma } from '../lib/store';
import type { HueFamily, PaletteFamily, Post } from '../lib/types';

/**
 * Um look aberto em tela cheia, a partir da grade.
 *
 * Os chips de cor e de clima levam para Explorar em vez de só marcarem o
 * filtro: o filtro não tem efeito visível nesta tela, então marcá-lo aqui e
 * não sair do lugar pareceria botão quebrado.
 */
export function TelaPost({
  post,
  onFechar,
  onFiltrarCor,
  onFiltrarClima,
  onAbrirPerfil,
}: {
  post: Post;
  onFechar: () => void;
  onFiltrarCor?: (f: HueFamily) => void;
  onFiltrarClima?: (f: PaletteFamily) => void;
  onAbrirPerfil?: (id: string) => void;
}) {
  const { eu, curtir, salvarPost, apagarPost, perfilDe, settings } = useCroma();

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', esc);
    };
  }, [onFechar]);

  return (
    <div className="tela-cheia">
      <div className="tela-cheia-col">
        <header className="topo">
          <button className="icone-btn" onClick={onFechar} aria-label="Voltar">
            <IconeVoltar />
          </button>
          <h2 className="topo-titulo">Look</h2>
        </header>

        <CartaoPost
          post={post}
          autor={perfilDe(post.authorId)}
          souEu={post.authorId === eu?.id}
          mostrarPinsPadrao={settings.mostrarPins}
          onCurtir={() => curtir(post.id)}
          onSalvar={() => salvarPost(post.id)}
          onApagar={() => {
            void apagarPost(post.id);
            onFechar();
          }}
          onFiltrarCor={
            onFiltrarCor &&
            ((f) => {
              onFechar();
              onFiltrarCor(f);
            })
          }
          onFiltrarClima={
            onFiltrarClima &&
            ((f) => {
              onFechar();
              onFiltrarClima(f);
            })
          }
          onAbrirPerfil={(id) => {
            onFechar();
            onAbrirPerfil?.(id);
          }}
        />

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
