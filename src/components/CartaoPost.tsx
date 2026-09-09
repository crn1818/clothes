import { useState } from 'react';
import { CamadaPinos } from './Pinos';
import { FaixaPaleta } from './Paleta';
import {
  Avatar,
  IconeCoracao,
  IconeEtiqueta,
  IconeLixo,
  IconeOlho,
  IconeSalvo,
  tempoRelativo,
  useImagem,
} from './ui';
import { PALETTE_FAMILY_META } from '../lib/color/palettes';
import { altTextFor } from '../lib/color/palettes';
import type { HueFamily, PaletteFamily, Post, Profile } from '../lib/types';

interface Props {
  post: Post;
  autor?: Profile;
  souEu: boolean;
  mostrarPinsPadrao: boolean;
  onCurtir: () => void;
  onSalvar: () => void;
  onApagar?: () => void;
  onFiltrarCor?: (familia: HueFamily) => void;
  onFiltrarClima?: (familia: PaletteFamily) => void;
  onAbrirPerfil?: (id: string) => void;
}

export function CartaoPost({
  post,
  autor,
  souEu,
  mostrarPinsPadrao,
  onCurtir,
  onSalvar,
  onApagar,
  onFiltrarCor,
  onFiltrarClima,
  onAbrirPerfil,
}: Props) {
  const url = useImagem(post, 'full');
  const [pinsVisiveis, setPinsVisiveis] = useState(mostrarPinsPadrao);
  const [confirmar, setConfirmar] = useState(false);

  const proporcao = post.width && post.height ? `${post.width} / ${post.height}` : '4 / 5';

  return (
    <article className="post">
      <header className="post-topo">
        <button
          onClick={() => onAbrirPerfil?.(post.authorId)}
          style={{ display: 'contents' }}
          aria-label={`Perfil de ${autor?.nome ?? 'usuário'}`}
        >
          <Avatar perfil={autor} />
        </button>
        <div className="post-autor">
          <div className="post-nome">
            {autor?.nome ?? 'Alguém'}
            {post.demo && <span className="selo-exemplo">exemplo</span>}
          </div>
          <div className="post-sub">
            @{autor?.handle ?? 'anon'} · {tempoRelativo(post.createdAt)}
            {autor?.cidade ? ` · ${autor.cidade}` : ''}
          </div>
        </div>

        {souEu && onApagar && (
          <button
            className="icone-btn"
            onClick={() => (confirmar ? onApagar() : setConfirmar(true))}
            onBlur={() => setConfirmar(false)}
            aria-label={confirmar ? 'Confirmar exclusão' : 'Apagar post'}
            style={confirmar ? { color: 'var(--curtida)' } : undefined}
            title={confirmar ? 'Clique de novo para apagar' : 'Apagar'}
          >
            <IconeLixo />
          </button>
        )}
      </header>

      <div className="foto-area" style={{ aspectRatio: url ? undefined : proporcao }}>
        {url ? (
          <img
            src={url}
            alt={altTextFor(post.cores, post.caption)}
            width={post.width}
            height={post.height}
          />
        ) : (
          <div className="foto-esqueleto" style={{ aspectRatio: proporcao }} />
        )}

        {url && <CamadaPinos pins={post.pins} visivel={pinsVisiveis} />}

        {post.pins.length > 0 && url && (
          <button
            className="pinos-alternar"
            onClick={() => setPinsVisiveis((v) => !v)}
            aria-pressed={pinsVisiveis}
          >
            {pinsVisiveis ? <IconeOlho /> : <IconeEtiqueta tamanho={15} />}
            {post.pins.length} {post.pins.length === 1 ? 'peça' : 'peças'}
          </button>
        )}
      </div>

      <FaixaPaleta cores={post.cores} />

      <div className="post-acoes">
        <button
          className={`acao${post.curtiuEu ? ' curtido' : ''}`}
          onClick={onCurtir}
          aria-pressed={post.curtiuEu}
          aria-label={post.curtiuEu ? 'Descurtir' : 'Curtir'}
        >
          <IconeCoracao preenchido={post.curtiuEu} tamanho={21} />
          {post.curtidas > 0 && post.curtidas}
        </button>

        {post.pins.length > 0 && (
          <span className="acao" style={{ cursor: 'default' }}>
            <IconeEtiqueta tamanho={19} />
            {post.pins.length}
          </span>
        )}

        <button
          className={`acao acao-fim${post.salvo ? ' salvo' : ''}`}
          onClick={onSalvar}
          aria-pressed={post.salvo}
          aria-label={post.salvo ? 'Remover dos salvos' : 'Salvar'}
        >
          <IconeSalvo preenchido={post.salvo} tamanho={21} />
        </button>
      </div>

      {post.familias.length > 0 && (
        <div className="climas">
          {post.familias.map((f) => (
            <button
              key={f}
              className="clima"
              onClick={() => onFiltrarClima?.(f)}
              title={PALETTE_FAMILY_META[f].hint}
            >
              {PALETTE_FAMILY_META[f].label}
            </button>
          ))}
        </div>
      )}

      {post.descricao && <p className="descricao-paleta">{post.descricao}</p>}

      <div className="paleta-legenda">
        {post.cores.map((c, i) => (
          <button
            className="cor-etiqueta"
            key={`${c.hex}-${i}`}
            onClick={() => onFiltrarCor?.(c.family)}
            title={`Ver looks com ${c.name}`}
          >
            <i style={{ background: c.hex }} />
            {c.name}
            <b>{Math.round(c.share * 100)}%</b>
          </button>
        ))}
      </div>

      {post.caption && (
        <p className="post-legenda">
          <span className="autor">{autor?.handle ?? 'anon'}</span>
          {post.caption}
        </p>
      )}
    </article>
  );
}
