import { useCallback, useEffect, useState } from 'react';
import { Feed } from './views/Feed';
import { Explorar } from './views/Explorar';
import { Compor } from './views/Compor';
import { Salvos } from './views/Salvos';
import { Perfil } from './views/Perfil';
import { Ajustes } from './views/Ajustes';
import { Entrar } from './gates/Entrar';
import {
  IconeExplorar,
  IconeFeed,
  IconeMais,
  IconePerfil,
  IconeSalvo,
} from './components/ui';
import { useCroma } from './lib/store';
import type { Filtro } from './lib/types';

type Tela =
  | { nome: 'feed' }
  | { nome: 'explorar' }
  | { nome: 'salvos' }
  | { nome: 'perfil'; id: string }
  | { nome: 'ajustes' };

/** Aplica o tema escolhido; 'sistema' segue o aparelho e reage a mudanças nele. */
function useTema(preferencia: 'claro' | 'escuro' | 'sistema') {
  useEffect(() => {
    const raiz = document.documentElement;

    const aplicar = () => {
      const escuro =
        preferencia === 'escuro' ||
        (preferencia === 'sistema' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      raiz.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', escuro ? '#100e0c' : '#faf7f2');
    };

    aplicar();
    if (preferencia !== 'sistema') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [preferencia]);
}

export default function App() {
  const { pronto, erro, progresso, modo, sessaoId, eu, settings, posts, setFiltro } =
    useCroma();
  const [tela, setTela] = useState<Tela>({ nome: 'feed' });
  const [compondo, setCompondo] = useState(false);

  useTema(settings.tema);

  /* Marcar um filtro a partir de uma tela que não mostra resultados (perfil,
     salvos) só faz sentido se levar junto para onde eles aparecem. */
  const explorarCom = useCallback(
    (fn: (atual: Filtro) => Filtro) => {
      setFiltro(fn);
      setTela({ nome: 'explorar' });
    },
    [setFiltro],
  );

  // Volta ao topo ao trocar de aba — comportamento de app, não de site.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tela.nome]);

  if (!pronto) return <Abertura progresso={progresso} />;

  // Em rede sem sessão não há feed para mostrar: o que é público depende de
  // quem está olhando (o que você salvou, o que você curtiu).
  if (modo === 'rede' && !sessaoId) return <Entrar />;

  const salvos = posts.filter((p) => p.salvo).length;
  const irPara = (nome: 'feed' | 'explorar' | 'salvos') => setTela({ nome });
  const meuPerfil = () => setTela({ nome: 'perfil', id: eu?.id ?? 'eu' });

  return (
    <div className="app">
      {erro && (
        <div className="aviso erro">
          <strong>Armazenamento indisponível.</strong> {erro} Em janela anônima ou com
          cookies bloqueados, o Croma não consegue guardar as fotos.
        </div>
      )}

      <main className="conteudo">
        {tela.nome === 'feed' && (
          <Feed
            onCompor={() => setCompondo(true)}
            onAbrirPerfil={(id) => setTela({ nome: 'perfil', id })}
          />
        )}

        {tela.nome === 'explorar' && (
          <Explorar onAbrirPerfil={(id) => setTela({ nome: 'perfil', id })} />
        )}

        {tela.nome === 'salvos' && (
          <Salvos
            onExplorar={() => irPara('explorar')}
            onExplorarCom={explorarCom}
            onAbrirPerfil={(id) => setTela({ nome: 'perfil', id })}
          />
        )}

        {tela.nome === 'perfil' && (
          <Perfil
            perfilId={tela.id}
            onVoltar={tela.id === eu?.id ? undefined : () => irPara('feed')}
            onAjustes={() => setTela({ nome: 'ajustes' })}
            onCompor={() => setCompondo(true)}
            onExplorarCom={explorarCom}
          />
        )}

        {tela.nome === 'ajustes' && <Ajustes onVoltar={meuPerfil} />}
      </main>

      <nav className="barra" aria-label="Navegação principal">
        <button
          className={`barra-item${tela.nome === 'feed' ? ' ativo' : ''}`}
          onClick={() => irPara('feed')}
          aria-current={tela.nome === 'feed' ? 'page' : undefined}
        >
          <IconeFeed tamanho={21} />
          Feed
        </button>

        <button
          className={`barra-item${tela.nome === 'explorar' ? ' ativo' : ''}`}
          onClick={() => irPara('explorar')}
          aria-current={tela.nome === 'explorar' ? 'page' : undefined}
        >
          <IconeExplorar tamanho={21} />
          Paletas
        </button>

        <button
          className="barra-item postar"
          onClick={() => setCompondo(true)}
          aria-label="Postar um look"
        >
          <span className="barra-postar-circulo">
            <IconeMais tamanho={22} />
          </span>
        </button>

        <button
          className={`barra-item${tela.nome === 'salvos' ? ' ativo' : ''}`}
          onClick={() => irPara('salvos')}
          aria-current={tela.nome === 'salvos' ? 'page' : undefined}
        >
          <IconeSalvo tamanho={21} preenchido={salvos > 0 && tela.nome === 'salvos'} />
          Salvos
        </button>

        <button
          className={`barra-item${
            tela.nome === 'perfil' || tela.nome === 'ajustes' ? ' ativo' : ''
          }`}
          onClick={meuPerfil}
          aria-current={tela.nome === 'perfil' ? 'page' : undefined}
        >
          <IconePerfil tamanho={21} />
          Perfil
        </button>
      </nav>

      {compondo && <Compor onFechar={() => setCompondo(false)} />}
    </div>
  );
}

function Abertura({ progresso }: { progresso: string | null }) {
  return (
    <div className="abertura">
      <div>
        <h1 className="abertura-marca">Croma</h1>
        <p className="legenda">o look do dia, lido em cores</p>
        <div className="pontos" aria-hidden="true">
          <i style={{ background: '#C97F4E' }} />
          <i style={{ background: '#5E7C8B' }} />
          <i style={{ background: '#D9C7A8' }} />
          <i style={{ background: '#6C1226' }} />
        </div>
        {progresso && (
          <p className="mini" style={{ marginTop: 16 }} aria-live="polite">
            {progresso}
          </p>
        )}
      </div>
    </div>
  );
}
