import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CamadaPinos } from '../components/Pinos';
import { TrilhoPaleta } from '../components/Paleta';
import {
  Folha,
  IconeCamera,
  IconeCheque,
  IconeEtiqueta,
  IconeLixo,
  IconeVoltar,
} from '../components/ui';
import { extractPalette } from '../lib/color/extract';
import { describePalette } from '../lib/color/palettes';
import { formatBytes, formatMegapixels, processPhoto, QUALITY_SPECS } from '../lib/image';
import { useCroma } from '../lib/store';
import type { ProcessedPhoto } from '../lib/image';
import {
  novoId,
  PIN_CATEGORY_ICON,
  PIN_CATEGORY_LABEL,
  type PaletteColor,
  type Pin,
  type PinCategory,
} from '../lib/types';

/**
 * Compor um look.
 *
 * A ordem da tela é a ordem do trabalho: a foto entra, a paleta aparece
 * sozinha ao lado dela, e só então se marca de onde é cada peça. Nada aqui
 * pede que a pessoa descreva cor — o app já leu. O que ela faz é *corrigir*:
 * tirar da paleta a cor que era da parede e não da roupa.
 */

const CATEGORIAS = Object.keys(PIN_CATEGORY_LABEL) as PinCategory[];

function renormalizar(cores: PaletteColor[]): PaletteColor[] {
  const total = cores.reduce((s, c) => s + c.share, 0);
  if (total <= 0) return cores;
  return cores.map((c) => ({ ...c, share: c.share / total }));
}

function pinVazio(x: number, y: number): Pin {
  return {
    id: novoId('pin-'),
    x,
    y,
    peca: '',
    categoria: 'top',
    marca: '',
    onde: '',
    preco: '',
    link: '',
  };
}

export function Compor({ onFechar }: { onFechar: () => void }) {
  const { publicar, settings } = useCroma();

  const [foto, setFoto] = useState<ProcessedPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cores, setCores] = useState<PaletteColor[]>([]);
  const [excluidas, setExcluidas] = useState<string[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [legenda, setLegenda] = useState('');

  const [lendo, setLendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [editando, setEditando] = useState<{ pin: Pin; novo: boolean } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLDivElement>(null);

  const coresFinais = useMemo(
    () => renormalizar(cores.filter((c) => !excluidas.includes(c.hex))),
    [cores, excluidas],
  );

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  useEffect(() => {
    if (!foto) return;
    const url = URL.createObjectURL(foto.full);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const carregar = useCallback(
    async (arquivo: File | Blob) => {
      setErro(null);
      setLendo(true);
      try {
        const processada = await processPhoto(arquivo, settings.quality);
        setFoto(processada);
        // A paleta sai da própria imagem já reduzida — mesma coisa que a pessoa vê.
        setCores(extractPalette(processada.analysis, { max: 5 }));
        setExcluidas([]);
        setPins([]);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui processar essa foto.');
      } finally {
        setLendo(false);
      }
    },
    [settings.quality],
  );

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (arquivo) void carregar(arquivo);
    e.target.value = '';
  };

  const aoSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(false);
    const arquivo = e.dataTransfer.files?.[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      setErro('Isso não parece uma imagem.');
      return;
    }
    void carregar(arquivo);
  };

  /** Toque na foto = nova peça naquele ponto. */
  const aoTocarFoto = (e: React.MouseEvent) => {
    if (!foto) return;
    const caixa = fotoRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const x = Math.min(0.97, Math.max(0.03, (e.clientX - caixa.left) / caixa.width));
    const y = Math.min(0.97, Math.max(0.03, (e.clientY - caixa.top) / caixa.height));
    setEditando({ pin: pinVazio(x, y), novo: true });
  };

  const salvarPin = (pin: Pin) => {
    setPins((atual) => {
      const existe = atual.some((p) => p.id === pin.id);
      return existe ? atual.map((p) => (p.id === pin.id ? pin : p)) : [...atual, pin];
    });
    setEditando(null);
  };

  const removerPin = (id: string) => {
    setPins((atual) => atual.filter((p) => p.id !== id));
    setEditando(null);
  };

  const enviar = async () => {
    if (!foto) return;
    setPublicando(true);
    setErro(null);
    try {
      await publicar({ foto, cores: coresFinais, caption: legenda, pins });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui publicar.');
      setPublicando(false);
    }
  };

  const spec = QUALITY_SPECS[settings.quality];
  const passo = foto ? (pins.length > 0 ? 3 : 2) : 1;

  return (
    <div className="tela-cheia">
      <div className="tela-cheia-col">
        <header className="topo">
          <button className="icone-btn" onClick={onFechar} aria-label="Cancelar">
            <IconeVoltar />
          </button>
          <h2 className="topo-titulo">Novo look</h2>
          <div className="topo-acoes">
            <button
              className="btn btn-primario"
              style={{ height: 34, padding: '0 16px' }}
              disabled={!foto || publicando || lendo}
              onClick={() => void enviar()}
            >
              {publicando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </header>

        <div className="passos" style={{ paddingTop: 10 }}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`passo${passo >= n ? ' feito' : ''}`} />
          ))}
        </div>

        {erro && <div className="aviso erro">{erro}</div>}

        <div className="secao" style={{ paddingTop: 8 }}>
          {!foto ? (
            <>
              <div
                className={`solta-foto${sobre ? ' sobre' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(true);
                }}
                onDragLeave={() => setSobre(false)}
                onDrop={aoSoltar}
              >
                <div style={{ color: 'var(--tinta-3)', marginBottom: 10 }}>
                  <IconeCamera />
                </div>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>
                  {lendo ? 'Processando a foto…' : 'A foto do look de hoje'}
                </p>
                <p className="legenda" style={{ margin: '0 auto 16px', maxWidth: 280 }}>
                  Arraste aqui ou escolha do dispositivo. A paleta aparece sozinha,
                  ao lado da foto.
                </p>
                <button
                  className="btn btn-primario"
                  onClick={() => inputRef.current?.click()}
                  disabled={lendo}
                >
                  Escolher foto
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={aoEscolher}
                />
              </div>

              <p className="mini" style={{ marginTop: 12, lineHeight: 1.5 }}>
                Qualidade <strong>{spec.label.toLowerCase()}</strong>: {spec.hint} Dá para
                mudar em Ajustes. A imagem fica guardada no seu navegador, em cheio e em
                miniatura.
              </p>
            </>
          ) : (
            <>
              <div className="compositor-linha">
                <div
                  className="compositor-foto"
                  ref={fotoRef}
                  onClick={aoTocarFoto}
                  role="application"
                  aria-label="Toque na foto para marcar uma peça"
                >
                  {preview && <img src={preview} alt="Prévia do look" />}
                  <CamadaPinos
                    pins={pins}
                    modo="editar"
                    onEditar={(pin) => setEditando({ pin, novo: false })}
                    onMover={(id, x, y) =>
                      setPins((atual) =>
                        atual.map((p) => (p.id === id ? { ...p, x, y } : p)),
                      )
                    }
                  />
                  <p className="dica-toque">
                    {pins.length === 0
                      ? 'Toque na peça para dizer de onde ela é'
                      : 'Toque em outra peça para marcar · arraste a bolinha para ajustar'}
                  </p>
                </div>

                <TrilhoPaleta cores={coresFinais} carregando={lendo} />
              </div>

              <p className="descricao-paleta" style={{ padding: '12px 0 0' }}>
                {describePalette(coresFinais)}
              </p>

              {cores.length > 1 && (
                <details style={{ marginTop: 10 }}>
                  <summary
                    className="mini"
                    style={{ cursor: 'pointer', fontWeight: 600 }}
                  >
                    Alguma cor é do fundo, não da roupa?
                  </summary>
                  <p className="mini" style={{ margin: '6px 0 8px' }}>
                    Desmarque para tirar da paleta. A descrição e os filtros se ajustam.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {cores.map((c) => {
                      const dentro = !excluidas.includes(c.hex);
                      return (
                        <button
                          key={c.hex}
                          className="chip"
                          aria-pressed={dentro}
                          disabled={dentro && coresFinais.length === 1}
                          onClick={() =>
                            setExcluidas((atual) =>
                              dentro
                                ? [...atual, c.hex]
                                : atual.filter((h) => h !== c.hex),
                            )
                          }
                        >
                          <span className="chip-amostra">
                            <i style={{ background: c.hex }} />
                          </span>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Tocar na foto é o gesto natural, mas não existe para quem
                  navega por teclado ou leitor de tela — daí este atalho, que
                  cria a etiqueta no centro para depois ser arrastada. */}
              <button
                className="btn btn-secundario btn-bloco"
                style={{ marginTop: 12, height: 38 }}
                onClick={() => setEditando({ pin: pinVazio(0.5, 0.5), novo: true })}
              >
                <IconeEtiqueta tamanho={17} /> Marcar mais uma peça
              </button>

              <div className="lista-pecas">
                {pins.map((pin, i) => (
                  <div className="peca-linha" key={pin.id}>
                    <span className="peca-num">{i + 1}</span>
                    <span className="peca-txt">
                      <strong>
                        {PIN_CATEGORY_ICON[pin.categoria]} {pin.peca || 'Peça sem nome'}
                      </strong>
                      <span>
                        {[pin.marca, pin.onde].filter(Boolean).join(' · ') ||
                          'Sem origem informada'}
                      </span>
                    </span>
                    <button
                      className="btn btn-fantasma"
                      style={{ height: 30, padding: '0 11px', fontSize: 12 }}
                      onClick={() => setEditando({ pin, novo: false })}
                    >
                      Editar
                    </button>
                    <button
                      className="icone-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => removerPin(pin.id)}
                      aria-label={`Remover ${pin.peca || 'peça'}`}
                    >
                      <IconeLixo tamanho={16} />
                    </button>
                  </div>
                ))}
              </div>

              <label className="campo" style={{ marginTop: 16 }}>
                <span className="campo-rotulo">Legenda</span>
                <textarea
                  className="area"
                  value={legenda}
                  maxLength={280}
                  placeholder="O que rolou nesse look?"
                  onChange={(e) => setLegenda(e.target.value)}
                />
              </label>

              <div className="carta" style={{ padding: 12, marginTop: 4 }}>
                <div className="linha-info">
                  <span>Guardada em</span>
                  <strong>
                    {foto.width}×{foto.height} · {formatMegapixels(foto.width, foto.height)}
                  </strong>
                </div>
                <div className="linha-info">
                  <span>Arquivo</span>
                  <strong>
                    {formatBytes(foto.bytes)} ·{' '}
                    {foto.mime.replace('image/', '').toUpperCase()}
                  </strong>
                </div>
                <div className="linha-info">
                  <span>Original</span>
                  <strong>
                    {formatBytes(foto.originalBytes)}
                    {foto.originalBytes > foto.bytes && (
                      <span style={{ color: 'var(--tinta-3)', fontWeight: 500 }}>
                        {' '}
                        (−{Math.round((1 - foto.bytes / foto.originalBytes) * 100)}%)
                      </span>
                    )}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  className="btn btn-secundario"
                  onClick={() => inputRef.current?.click()}
                  disabled={lendo || publicando}
                >
                  Trocar foto
                </button>
                <button
                  className="btn btn-primario"
                  style={{ flex: 1 }}
                  disabled={publicando || lendo}
                  onClick={() => void enviar()}
                >
                  {publicando ? 'Publicando…' : 'Publicar look'}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={aoEscolher}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>

      {editando && (
        <FormPeca
          pin={editando.pin}
          novo={editando.novo}
          onSalvar={salvarPin}
          onRemover={() => removerPin(editando.pin.id)}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/** Formulário de "de onde é essa peça". */
function FormPeca({
  pin,
  novo,
  onSalvar,
  onRemover,
  onFechar,
}: {
  pin: Pin;
  novo: boolean;
  onSalvar: (pin: Pin) => void;
  onRemover: () => void;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<Pin>(pin);
  const set = <K extends keyof Pin>(chave: K, valor: Pin[K]) =>
    setRascunho((atual) => ({ ...atual, [chave]: valor }));

  return (
    <Folha titulo={novo ? 'Marcar uma peça' : 'Editar peça'} onFechar={onFechar}>
      <label className="campo">
        <span className="campo-rotulo">Peça</span>
        <input
          className="entrada"
          autoFocus
          value={rascunho.peca}
          placeholder="Trench encurtado, tênis branco…"
          onChange={(e) => set('peca', e.target.value)}
        />
      </label>

      <p className="campo-rotulo">Tipo</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            className="chip"
            aria-pressed={rascunho.categoria === c}
            onClick={() => set('categoria', c)}
          >
            {PIN_CATEGORY_ICON[c]} {PIN_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <label className="campo">
        <span className="campo-rotulo">Marca</span>
        <input
          className="entrada"
          value={rascunho.marca}
          placeholder="Zara, brechó, feito por mim…"
          onChange={(e) => set('marca', e.target.value)}
        />
      </label>

      <label className="campo">
        <span className="campo-rotulo">De onde é</span>
        <input
          className="entrada"
          value={rascunho.onde}
          placeholder="Brechó da Lima e Silva, site, presente…"
          onChange={(e) => set('onde', e.target.value)}
        />
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <label className="campo" style={{ flex: '0 0 40%' }}>
          <span className="campo-rotulo">Preço</span>
          <input
            className="entrada"
            value={rascunho.preco}
            placeholder="R$ 120"
            inputMode="decimal"
            onChange={(e) => set('preco', e.target.value)}
          />
        </label>
        <label className="campo" style={{ flex: 1 }}>
          <span className="campo-rotulo">Link</span>
          <input
            className="entrada"
            value={rascunho.link}
            placeholder="https://…"
            inputMode="url"
            onChange={(e) => set('link', e.target.value)}
          />
        </label>
      </div>

      <p className="mini" style={{ marginTop: -4, marginBottom: 14 }}>
        Tudo é opcional menos o nome da peça. Quem vir o look passa o mouse (ou toca) na
        bolinha e lê isso.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        {!novo && (
          <button className="btn btn-perigo" onClick={onRemover}>
            <IconeLixo /> Remover
          </button>
        )}
        <button
          className="btn btn-primario"
          style={{ flex: 1 }}
          disabled={!rascunho.peca.trim()}
          onClick={() => onSalvar({ ...rascunho, peca: rascunho.peca.trim() })}
        >
          <IconeCheque /> {novo ? 'Marcar peça' : 'Salvar'}
        </button>
      </div>
    </Folha>
  );
}
