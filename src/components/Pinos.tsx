import { useCallback, useEffect, useRef, useState } from 'react';
import { IconeLink, IconePino } from './ui';
import { PIN_CATEGORY_ICON, PIN_CATEGORY_LABEL, type Pin } from '../lib/types';

/**
 * As bolinhas sobre a foto que dizem de onde é cada peça.
 *
 * Dois gestos, um componente: no desktop a bolinha abre no `hover` (é o que a
 * pessoa espera de um ponto interativo), no toque ela abre no tap — `hover`
 * simplesmente não existe lá, e um app que só funciona com mouse não é um app.
 *
 * O cartão nasce grudado na bolinha e é empurrado para dentro das bordas da
 * foto; sem isso, uma peça marcada na beirada abriria um cartão cortado pela
 * metade. Ele também vira para cima quando o pino está na parte de baixo da
 * imagem, que é onde ficam sapatos — o caso mais comum de todos.
 */

const LARGURA_CARTAO = 208;
const MARGEM = 8;
const FOLGA = 20;

interface Props {
  pins: Pin[];
  visivel?: boolean;
  /** 'editar' torna os pinos arrastáveis e troca o cartão por um callback. */
  modo?: 'ver' | 'editar';
  onEditar?: (pin: Pin) => void;
  onMover?: (id: string, x: number, y: number) => void;
  /** Anima os pinos na primeira aparição para que ninguém deixe de vê-los. */
  pulsar?: boolean;
}

function usaHover(): boolean {
  const [tem, setTem] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setTem(mq.matches);
    const ouvir = (e: MediaQueryListEvent) => setTem(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, []);
  return tem;
}

export function CamadaPinos({
  pins,
  visivel = true,
  modo = 'ver',
  onEditar,
  onMover,
  pulsar,
}: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hover = usaHover();

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) setAberto(null);
  }, [visivel]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cancelarFechar = useCallback(() => window.clearTimeout(timer.current), []);
  const agendarFechar = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAberto(null), 140);
  }, []);

  /* ---------- arrastar (só no modo editar) ---------- */

  const inicioArrasto = useRef<{ x: number; y: number; mexeu: boolean } | null>(null);

  const aoApontar = (e: React.PointerEvent, pin: Pin) => {
    if (modo !== 'editar') return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    inicioArrasto.current = { x: e.clientX, y: e.clientY, mexeu: false };
    setArrastando(pin.id);
  };

  const aoMover = (e: React.PointerEvent, pin: Pin) => {
    if (modo !== 'editar' || arrastando !== pin.id || !inicioArrasto.current) return;
    const caixa = caixaRef.current?.getBoundingClientRect();
    if (!caixa) return;

    const dist = Math.hypot(
      e.clientX - inicioArrasto.current.x,
      e.clientY - inicioArrasto.current.y,
    );
    if (dist > 4) inicioArrasto.current.mexeu = true;
    if (!inicioArrasto.current.mexeu) return;

    const x = Math.min(0.98, Math.max(0.02, (e.clientX - caixa.left) / caixa.width));
    const y = Math.min(0.98, Math.max(0.02, (e.clientY - caixa.top) / caixa.height));
    onMover?.(pin.id, x, y);
  };

  const aoSoltar = (e: React.PointerEvent, pin: Pin) => {
    if (modo !== 'editar') return;
    e.stopPropagation();
    const mexeu = inicioArrasto.current?.mexeu ?? false;
    inicioArrasto.current = null;
    setArrastando(null);
    // Toque curto sem arrastar = intenção de editar, não de mover.
    if (!mexeu) onEditar?.(pin);
  };

  if (pins.length === 0 || !visivel) return null;

  const pinAberto = pins.find((p) => p.id === aberto);

  return (
    <div
      className="camada-pinos"
      ref={caixaRef}
      style={{ position: 'absolute', inset: 0, zIndex: 3 }}
    >
      {pins.map((pin, i) => (
        <button
          key={pin.id}
          type="button"
          className={[
            'pino',
            aberto === pin.id ? 'aberto' : '',
            modo === 'editar' ? 'arrastavel' : '',
            arrastando === pin.id ? 'arrastando' : '',
            pulsar && modo === 'ver' ? 'pulsa' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: `${pin.x * 100}%`,
            top: `${pin.y * 100}%`,
            animationDelay: `${i * 0.14}s`,
          }}
          aria-label={
            modo === 'editar'
              ? `Editar ${pin.peca || 'peça'} — arraste para reposicionar`
              : `${pin.peca}${pin.marca ? `, ${pin.marca}` : ''}`
          }
          aria-expanded={modo === 'ver' ? aberto === pin.id : undefined}
          onPointerDown={(e) => aoApontar(e, pin)}
          onPointerMove={(e) => aoMover(e, pin)}
          onPointerUp={(e) => aoSoltar(e, pin)}
          onClick={(e) => {
            e.stopPropagation();
            if (modo === 'editar') return;
            setAberto((atual) => (atual === pin.id ? null : pin.id));
          }}
          onPointerEnter={() => {
            if (modo === 'ver' && hover) {
              cancelarFechar();
              setAberto(pin.id);
            }
          }}
          onPointerLeave={() => {
            if (modo === 'ver' && hover) agendarFechar();
          }}
          onFocus={() => modo === 'ver' && setAberto(pin.id)}
          onBlur={() => modo === 'ver' && agendarFechar()}
        >
          {modo === 'editar' ? i + 1 : PIN_CATEGORY_ICON[pin.categoria]}
        </button>
      ))}

      {modo === 'ver' && pinAberto && (
        <CartaoPino
          pin={pinAberto}
          largura={largura}
          onEntrar={cancelarFechar}
          onSair={agendarFechar}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}

function CartaoPino({
  pin,
  largura,
  onEntrar,
  onSair,
  onFechar,
}: {
  pin: Pin;
  largura: number;
  onEntrar: () => void;
  onSair: () => void;
  onFechar: () => void;
}) {
  // Centraliza no pino, mas nunca deixa o cartão vazar a foto.
  const centro = pin.x * largura;
  const meio = LARGURA_CARTAO / 2;
  const min = MARGEM + meio;
  const max = Math.max(min, largura - MARGEM - meio);
  const esquerda = largura > 0 ? Math.min(max, Math.max(min, centro)) : centro;

  const paraCima = pin.y > 0.62;

  return (
    <div
      className="pino-cartao"
      role="tooltip"
      style={{
        left: largura > 0 ? esquerda : `${pin.x * 100}%`,
        ...(paraCima
          ? { bottom: `calc(${(1 - pin.y) * 100}% + ${FOLGA}px)` }
          : { top: `calc(${pin.y * 100}% + ${FOLGA}px)` }),
      }}
      onPointerEnter={onEntrar}
      onPointerLeave={onSair}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="categoria">{PIN_CATEGORY_LABEL[pin.categoria]}</p>
      <h4>{pin.peca || 'Peça sem nome'}</h4>
      {pin.marca && <p className="marca">{pin.marca}</p>}
      {pin.onde && (
        <p className="onde">
          <IconePino />
          <span>{pin.onde}</span>
        </p>
      )}
      {pin.preco && <span className="preco">{pin.preco}</span>}
      {pin.link && (
        <a
          className="link"
          href={pin.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
        >
          <IconeLink /> Ver a peça
        </a>
      )}
      <button
        className="icone-btn"
        style={{ position: 'absolute', top: 2, right: 2, width: 26, height: 26 }}
        onClick={onFechar}
        aria-label="Fechar"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
