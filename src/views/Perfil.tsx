import { useMemo, useState } from 'react';
import { Grade } from '../components/Grade';
import { TelaPost } from '../components/TelaPost';
import { FaixaPaleta, EtiquetasCores } from '../components/Paleta';
import { Avatar, Folha, IconeAjustes, IconeVoltar, Vazio } from '../components/ui';
import { describePalette, resumirPaletas } from '../lib/color/palettes';
import { useCroma } from '../lib/store';
import { comClima, comMatiz, type Filtro, type Post, type Profile } from '../lib/types';

export function Perfil({
  perfilId,
  onVoltar,
  onAjustes,
  onCompor,
  onExplorarCom,
}: {
  perfilId: string;
  onVoltar?: () => void;
  onAjustes: () => void;
  onCompor: () => void;
  onExplorarCom: (fn: (atual: Filtro) => Filtro) => void;
}) {
  const { posts, eu, perfilDe, atualizarPerfil } = useCroma();
  const [aba, setAba] = useState<'looks' | 'salvos'>('looks');
  const [aberto, setAberto] = useState<Post | null>(null);
  const [editando, setEditando] = useState(false);

  const perfil = perfilDe(perfilId);
  const souEu = eu?.id === perfilId;

  const meusPosts = useMemo(
    () =>
      posts
        .filter((p) => p.authorId === perfilId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [posts, perfilId],
  );

  const salvos = useMemo(
    () => posts.filter((p) => p.salvo).sort((a, b) => b.createdAt - a.createdAt),
    [posts],
  );

  const paleta = useMemo(
    () => resumirPaletas(meusPosts.map((p) => p.cores)),
    [meusPosts],
  );

  const curtidas = meusPosts.reduce((s, p) => s + p.curtidas, 0);
  const pecas = meusPosts.reduce((s, p) => s + p.pins.length, 0);
  const lista = aba === 'looks' ? meusPosts : salvos;

  if (!perfil) {
    return (
      <>
        <header className="topo">
          {onVoltar && (
            <button className="icone-btn" onClick={onVoltar} aria-label="Voltar">
              <IconeVoltar />
            </button>
          )}
          <h2 className="topo-titulo">Perfil</h2>
        </header>
        <Vazio icone="◌" titulo="Perfil não encontrado" texto="Esse perfil não existe mais." />
      </>
    );
  }

  return (
    <>
      <header className="topo">
        {onVoltar && (
          <button className="icone-btn" onClick={onVoltar} aria-label="Voltar">
            <IconeVoltar />
          </button>
        )}
        <h2 className="topo-titulo">@{perfil.handle}</h2>
        {souEu && (
          <div className="topo-acoes">
            <button className="icone-btn" onClick={onAjustes} aria-label="Ajustes">
              <IconeAjustes />
            </button>
          </div>
        )}
      </header>

      <div className="perfil-topo">
        <Avatar perfil={perfil} grande />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{perfil.nome}</p>
          {perfil.cidade && <p className="mini" style={{ margin: 0 }}>{perfil.cidade}</p>}
          <div className="perfil-nums">
            <div className="perfil-num">
              <strong>{meusPosts.length}</strong>
              <span>looks</span>
            </div>
            <div className="perfil-num">
              <strong>{curtidas}</strong>
              <span>curtidas</span>
            </div>
            <div className="perfil-num">
              <strong>{pecas}</strong>
              <span>peças</span>
            </div>
          </div>
        </div>
      </div>

      {perfil.bio && (
        <p style={{ padding: '0 16px 12px', margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          {perfil.bio}
        </p>
      )}

      {souEu && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          <button
            className="btn btn-secundario"
            style={{ flex: 1, height: 36 }}
            onClick={() => setEditando(true)}
          >
            Editar perfil
          </button>
          <button
            className="btn btn-secundario"
            style={{ flex: 1, height: 36 }}
            onClick={onCompor}
          >
            Novo look
          </button>
        </div>
      )}

      {paleta.length > 0 && (
        <section
          className="carta"
          style={{ margin: '0 16px 16px', overflow: 'hidden' }}
        >
          <FaixaPaleta cores={paleta} altura={44} />
          <div style={{ padding: '10px 12px 12px' }}>
            <p className="titulo-secao" style={{ fontSize: 15 }}>
              {souEu ? 'A sua paleta' : `A paleta de ${perfil.nome.split(' ')[0]}`}
            </p>
            <p className="legenda" style={{ marginBottom: 2 }}>
              {describePalette(paleta)}
            </p>
          </div>
          <EtiquetasCores cores={paleta} limite={6} />
          <div style={{ height: 10 }} />
        </section>
      )}

      {souEu && (
        <div className="abas">
          <button
            className={`aba${aba === 'looks' ? ' ativa' : ''}`}
            onClick={() => setAba('looks')}
          >
            Meus looks
          </button>
          <button
            className={`aba${aba === 'salvos' ? ' ativa' : ''}`}
            onClick={() => setAba('salvos')}
          >
            Salvos {salvos.length > 0 && `(${salvos.length})`}
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        aba === 'salvos' ? (
          <Vazio
            icone="⌾"
            titulo="Nada salvo ainda"
            texto="Toque no marcador de um look para guardar aqui."
          />
        ) : (
          <Vazio
            icone="◐"
            titulo={souEu ? 'Você ainda não postou' : 'Sem looks por aqui'}
            texto={
              souEu
                ? 'O primeiro look vira o começo da sua paleta.'
                : 'Essa pessoa ainda não publicou nada.'
            }
            acao={
              souEu ? (
                <button className="btn btn-primario" onClick={onCompor}>
                  Postar um look
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <Grade posts={lista} onAbrir={setAberto} />
      )}

      {aberto && (
        <TelaPost
          post={posts.find((p) => p.id === aberto.id) ?? aberto}
          onFechar={() => setAberto(null)}
          onFiltrarCor={(m) => onExplorarCom((a) => comMatiz(a, m))}
          onFiltrarClima={(c) => onExplorarCom((a) => comClima(a, c))}
        />
      )}

      {editando && eu && (
        <FormPerfil
          perfil={eu}
          onSalvar={(p) => {
            atualizarPerfil(p);
            setEditando(false);
          }}
          onFechar={() => setEditando(false)}
        />
      )}
    </>
  );
}

const AVATARES: [string, string][] = [
  ['#C97F4E', '#5E7C8B'],
  ['#A2663C', '#E2D3BB'],
  ['#1F1F21', '#585C61'],
  ['#4C6FA0', '#C4DAEB'],
  ['#E4368C', '#EFC31C'],
  ['#4C5321', '#B0A46C'],
  ['#6C1226', '#B4884F'],
  ['#204C55', '#A6DDC0'],
];

function FormPerfil({
  perfil,
  onSalvar,
  onFechar,
}: {
  perfil: Profile;
  onSalvar: (p: Partial<Profile>) => void;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<Profile>(perfil);
  const set = <K extends keyof Profile>(chave: K, valor: Profile[K]) =>
    setRascunho((a) => ({ ...a, [chave]: valor }));

  return (
    <Folha titulo="Editar perfil" onFechar={onFechar}>
      <p className="campo-rotulo">Avatar</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 16 }}>
        {AVATARES.map((par) => {
          const escolhido = rascunho.avatar[0] === par[0] && rascunho.avatar[1] === par[1];
          return (
            <button
              key={par.join()}
              onClick={() => set('avatar', par)}
              aria-label={`Avatar ${par[0]} e ${par[1]}`}
              aria-pressed={escolhido}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${par[0]}, ${par[1]})`,
                boxShadow: escolhido ? '0 0 0 2.5px var(--tinta)' : 'none',
              }}
            />
          );
        })}
      </div>

      <label className="campo">
        <span className="campo-rotulo">Nome</span>
        <input
          className="entrada"
          value={rascunho.nome}
          maxLength={40}
          onChange={(e) => set('nome', e.target.value)}
        />
      </label>

      <label className="campo">
        <span className="campo-rotulo">Usuário</span>
        <input
          className="entrada"
          value={rascunho.handle}
          maxLength={24}
          onChange={(e) =>
            set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))
          }
        />
      </label>

      <label className="campo">
        <span className="campo-rotulo">Cidade</span>
        <input
          className="entrada"
          value={rascunho.cidade}
          maxLength={40}
          placeholder="Porto Alegre"
          onChange={(e) => set('cidade', e.target.value)}
        />
      </label>

      <label className="campo">
        <span className="campo-rotulo">Bio</span>
        <textarea
          className="area"
          value={rascunho.bio}
          maxLength={140}
          onChange={(e) => set('bio', e.target.value)}
        />
      </label>

      <button
        className="btn btn-primario btn-bloco"
        disabled={!rascunho.nome.trim() || !rascunho.handle.trim()}
        onClick={() =>
          onSalvar({
            nome: rascunho.nome.trim(),
            handle: rascunho.handle.trim(),
            bio: rascunho.bio.trim(),
            cidade: rascunho.cidade.trim(),
            avatar: rascunho.avatar,
          })
        }
      >
        Salvar
      </button>
    </Folha>
  );
}
