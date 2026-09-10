import { useEffect, useState } from 'react';
import { IconeCheque, IconeVoltar } from '../components/ui';
import { formatBytes, QUALITY_SPECS } from '../lib/image';
import { storageUsage, type StorageUsage } from '../lib/idb';
import { useCroma } from '../lib/store';
import {
  configFixaNoBuild,
  lerConfig,
  limparConfig,
  salvarConfig,
  testarConfig,
} from '../lib/supabase';
import { exportarTudo, importarDe, type ResultadoImport } from '../lib/backup';
import type { QualityPreset, Settings } from '../lib/types';

const TEMAS: { valor: Settings['tema']; rotulo: string; dica: string }[] = [
  { valor: 'sistema', rotulo: 'Do sistema', dica: 'Acompanha o claro/escuro do aparelho.' },
  { valor: 'claro', rotulo: 'Claro', dica: 'Papel quente. Melhor para julgar cor.' },
  { valor: 'escuro', rotulo: 'Escuro', dica: 'Fundo baixo, as fotos saltam.' },
];

function Opcao({
  ativo,
  titulo,
  texto,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button className="opcao" aria-pressed={ativo} onClick={onClick}>
      <span className="opcao-marca">{ativo && <IconeCheque />}</span>
      <span>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
    </button>
  );
}

export function Ajustes({ onVoltar }: { onVoltar: () => void }) {
  const {
    settings,
    setSettings,
    posts,
    modo,
    eu,
    sair,
    removerExemplos,
    recriarExemplos,
    apagarTudo,
  } = useCroma();

  const [uso, setUso] = useState<StorageUsage | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarTudo, setConfirmarTudo] = useState(false);

  const temExemplos = posts.some((p) => p.demo);
  const meus = posts.filter((p) => !p.demo).length;

  useEffect(() => {
    void storageUsage().then(setUso).catch(() => setUso(null));
  }, [posts]);

  const rodar = async (nome: string, fn: () => Promise<void>) => {
    setOcupado(nome);
    try {
      await fn();
      setUso(await storageUsage());
    } finally {
      setOcupado(null);
    }
  };

  const pct =
    uso && uso.cotaBytes > 0 ? Math.min(100, (uso.usadoBytes / uso.cotaBytes) * 100) : 0;

  return (
    <>
      <header className="topo">
        <button className="icone-btn" onClick={onVoltar} aria-label="Voltar">
          <IconeVoltar />
        </button>
        <h2 className="topo-titulo">Ajustes</h2>
      </header>

      <section className="secao">
        <p className="titulo-secao">Qualidade das fotos</p>
        <p className="legenda" style={{ marginBottom: 10 }}>
          Vale para as próximas fotos. As já postadas continuam como estão.
        </p>
        <div className="opcoes">
          {(Object.keys(QUALITY_SPECS) as QualityPreset[]).map((q) => (
            <Opcao
              key={q}
              ativo={settings.quality === q}
              titulo={QUALITY_SPECS[q].label}
              texto={QUALITY_SPECS[q].hint}
              onClick={() => setSettings({ quality: q })}
            />
          ))}
        </div>
      </section>

      <section className="secao" style={{ paddingTop: 0 }}>
        <p className="titulo-secao">Aparência</p>
        <div className="opcoes" style={{ marginTop: 8 }}>
          {TEMAS.map((t) => (
            <Opcao
              key={t.valor}
              ativo={settings.tema === t.valor}
              titulo={t.rotulo}
              texto={t.dica}
              onClick={() => setSettings({ tema: t.valor })}
            />
          ))}
        </div>
      </section>

      <section className="secao" style={{ paddingTop: 0 }}>
        <p className="titulo-secao">Etiquetas de peça</p>
        <div className="opcoes" style={{ marginTop: 8 }}>
          <Opcao
            ativo={settings.mostrarPins}
            titulo="Mostrar as bolinhas por padrão"
            texto="Desligado, elas ficam escondidas até alguém tocar em “peças”."
            onClick={() => setSettings({ mostrarPins: !settings.mostrarPins })}
          />
        </div>
      </section>

      <SecaoRede modo={modo} emailOuHandle={eu?.handle} onSair={sair} />

      {modo === 'local' && <SecaoBackup />}

      <section className="secao" style={{ paddingTop: 0 }}>
        <p className="titulo-secao">Armazenamento deste aparelho</p>
        <p className="legenda" style={{ marginBottom: 8 }}>
          {modo === 'rede'
            ? 'No modo rede as fotos ficam no Supabase; aqui sobram só as preferências.'
            : 'As fotos ficam neste navegador, em tamanho cheio e em miniatura. Nada é enviado para nenhum servidor.'}
        </p>

        <div className="carta" style={{ padding: 12 }}>
          {uso ? (
            <>
              <div className="linha-info">
                <span>Fotos guardadas</span>
                <strong>{uso.fotos}</strong>
              </div>
              <div className="linha-info">
                <span>Em uso</span>
                <strong>{formatBytes(uso.usadoBytes)}</strong>
              </div>
              {uso.cotaBytes > 0 && (
                <>
                  <div className="linha-info">
                    <span>Disponível para o site</span>
                    <strong>{formatBytes(uso.cotaBytes)}</strong>
                  </div>
                  <div className="barra-uso">
                    <i style={{ width: `${Math.max(1.5, pct)}%` }} />
                  </div>
                  <p className="mini" style={{ margin: 0 }}>
                    {pct < 1 ? 'menos de 1%' : `${pct.toFixed(1)}%`} da cota deste
                    navegador.
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="mini" style={{ margin: 0 }}>
              Calculando…
            </p>
          )}
        </div>
      </section>

      {modo === 'local' && (
        <>
          <section className="secao" style={{ paddingTop: 0 }}>
            <p className="titulo-secao">Conteúdo de exemplo</p>
            <p className="legenda" style={{ marginBottom: 10 }}>
              Os looks marcados como <em>exemplo</em> são croquis gerados pelo próprio
              app, para o feed não nascer vazio. Eles passam pelo mesmo leitor de cor das
              fotos de verdade. Você tem {meus} {meus === 1 ? 'look seu' : 'looks seus'}.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {temExemplos ? (
                <button
                  className="btn btn-secundario"
                  disabled={ocupado !== null}
                  onClick={() => void rodar('remover', removerExemplos)}
                >
                  {ocupado === 'remover' ? 'Removendo…' : 'Remover os exemplos'}
                </button>
              ) : (
                <button
                  className="btn btn-secundario"
                  disabled={ocupado !== null}
                  onClick={() => void rodar('recriar', recriarExemplos)}
                >
                  {ocupado === 'recriar' ? 'Gerando…' : 'Trazer os exemplos de volta'}
                </button>
              )}
            </div>
          </section>

          <section className="secao" style={{ paddingTop: 0 }}>
            <p className="titulo-secao">Zona de risco</p>
            <p className="legenda" style={{ marginBottom: 10 }}>
              Apaga tudo: seus looks, suas fotos, seu perfil. Não dá para desfazer.
            </p>
            <button
              className="btn btn-perigo"
              disabled={ocupado !== null}
              onClick={() => {
                if (!confirmarTudo) {
                  setConfirmarTudo(true);
                  return;
                }
                void rodar('tudo', apagarTudo).then(() => setConfirmarTudo(false));
              }}
              onBlur={() => setConfirmarTudo(false)}
            >
              {ocupado === 'tudo'
                ? 'Apagando…'
                : confirmarTudo
                  ? 'Tem certeza? Clique de novo'
                  : 'Apagar tudo'}
            </button>
          </section>
        </>
      )}

      <section className="secao" style={{ paddingTop: 0 }}>
        <p className="titulo-secao">Sobre o Croma</p>
        <p className="legenda" style={{ lineHeight: 1.55 }}>
          A paleta de cada look sai de um k-means em OKLab — o espaço de cor em que
          distância numérica corresponde ao que o olho percebe — rodando sobre os pixels
          da própria foto. Antes disso, o fundo é separado por espalhamento a partir da
          moldura da imagem, senão a paleta de um look inteiro seria a cor da parede.
          Cada cor recebe o nome mais próximo num dicionário de moda em português.
        </p>
      </section>

      <div style={{ height: 24 }} />
    </>
  );
}

/* ---------- modo rede ---------- */

function SecaoRede({
  modo,
  emailOuHandle,
  onSair,
}: {
  modo: 'local' | 'rede';
  emailOuHandle?: string;
  onSair: () => Promise<void>;
}) {
  const cfg = lerConfig();
  const fixa = configFixaNoBuild();

  const [abrindo, setAbrindo] = useState(false);
  const [url, setUrl] = useState(cfg?.url ?? '');
  const [chave, setChave] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);

  const ligar = async () => {
    setTestando(true);
    setErro(null);
    const problema = await testarConfig({ url, anonKey: chave });
    setTestando(false);
    if (problema) {
      setErro(problema);
      return;
    }
    salvarConfig({ url, anonKey: chave });
    // O modo é decidido na abertura do app; recarregar é o caminho honesto.
    window.location.reload();
  };

  if (modo === 'rede') {
    return (
      <section className="secao" style={{ paddingTop: 0 }}>
        <p className="titulo-secao">Modo rede</p>
        <p className="legenda" style={{ marginBottom: 10 }}>
          Conectado{emailOuHandle ? ` como @${emailOuHandle}` : ''}. Seus looks vão para o
          projeto Supabase e aparecem para as outras contas.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secundario" onClick={() => void onSair()}>
            Sair da conta
          </button>
          {!fixa && (
            <button
              className="btn btn-fantasma"
              onClick={() => {
                limparConfig();
                window.location.reload();
              }}
            >
              Desligar o modo rede
            </button>
          )}
        </div>
        {fixa && (
          <p className="mini" style={{ marginTop: 8 }}>
            As credenciais vieram do build (<code>.env</code>), então não dá para
            desligar por aqui.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="secao" style={{ paddingTop: 0 }}>
      <p className="titulo-secao">Modo rede (Supabase)</p>
      <p className="legenda" style={{ marginBottom: 10 }}>
        Hoje o Croma é só seu: tudo mora neste navegador. Ligando um projeto Supabase ele
        vira rede de verdade — contas, feed compartilhado e as fotos no storage.
      </p>

      {!abrindo ? (
        <button className="btn btn-secundario" onClick={() => setAbrindo(true)}>
          Ligar o modo rede
        </button>
      ) : (
        <>
          <ol className="mini" style={{ paddingLeft: 18, lineHeight: 1.6, marginTop: 0 }}>
            <li>
              Crie um projeto em <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>
            </li>
            <li>
              No SQL Editor, rode o arquivo <code>supabase/schema.sql</code> do projeto
            </li>
            <li>
              Copie a URL e a chave <em>publishable</em> (ou a anon legada) em
              Project Settings → API
            </li>
          </ol>

          {erro && <div className="aviso erro">{erro}</div>}

          <label className="campo" style={{ marginTop: 10 }}>
            <span className="campo-rotulo">URL do projeto</span>
            <input
              className="entrada"
              value={url}
              placeholder="https://xxxxxxxx.supabase.co"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">Chave pública</span>
            <textarea
              className="area"
              style={{ minHeight: 60, fontSize: 12, fontFamily: 'monospace' }}
              value={chave}
              placeholder="sb_publishable_… ou eyJhbGciOi…"
              onChange={(e) => setChave(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-fantasma" onClick={() => setAbrindo(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primario"
              style={{ flex: 1 }}
              disabled={!url.trim() || !chave.trim() || testando}
              onClick={() => void ligar()}
            >
              {testando ? 'Testando…' : 'Testar e ligar'}
            </button>
          </div>

          <p className="mini" style={{ marginTop: 8 }}>
            Essa chave é pública por natureza — ela vai no navegador de qualquer
            jeito. Quem protege os dados é o RLS do <code>schema.sql</code>.
          </p>
        </>
      )}
    </section>
  );
}

/* ---------- backup ---------- */

function SecaoBackup() {
  const { recarregarLocal } = useCroma();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = () =>
    new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.croma.json,.json';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });

  return (
    <section className="secao" style={{ paddingTop: 0 }}>
      <p className="titulo-secao">Backup</p>
      <p className="legenda" style={{ marginBottom: 10 }}>
        Tudo mora neste navegador. Se você limpar os dados do site, os looks somem — o
        arquivo de backup traz fotos, paletas e etiquetas junto.
      </p>

      {erro && <div className="aviso erro">{erro}</div>}
      {resultado && (
        <div className="aviso">
          {resultado.importados} {resultado.importados === 1 ? 'look importado' : 'looks importados'}
          {resultado.ignorados > 0 && `, ${resultado.ignorados} já existiam`}.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-secundario"
          disabled={ocupado !== null}
          onClick={async () => {
            setOcupado('exportar');
            setErro(null);
            try {
              await exportarTudo();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Falha ao exportar.');
            } finally {
              setOcupado(null);
            }
          }}
        >
          {ocupado === 'exportar' ? 'Preparando…' : 'Baixar backup'}
        </button>

        <button
          className="btn btn-secundario"
          disabled={ocupado !== null}
          onClick={async () => {
            const arquivo = await escolher();
            if (!arquivo) return;
            setOcupado('importar');
            setErro(null);
            setResultado(null);
            try {
              setResultado(await importarDe(arquivo));
              await recarregarLocal();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Falha ao importar.');
            } finally {
              setOcupado(null);
            }
          }}
        >
          {ocupado === 'importar' ? 'Importando…' : 'Restaurar de um backup'}
        </button>
      </div>
    </section>
  );
}
