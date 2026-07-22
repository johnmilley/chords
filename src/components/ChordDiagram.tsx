import { guitarShape, pianoVoicing, type GuitarShape } from '../lib/chord-shapes';
import { NOTE_LABELS } from '../lib/music';

interface Props {
  symbol: string;
  instrument: 'guitar' | 'piano';
  leftHanded: boolean;
  size?: number;
}

export function ChordDiagram({ symbol, instrument, leftHanded, size = 120 }: Props) {
  if (instrument === 'piano') return <PianoDiagram symbol={symbol} width={size * 1.6} />;
  return <GuitarDiagram symbol={symbol} leftHanded={leftHanded} width={size} />;
}

// ---- Guitar ----

function GuitarDiagram({ symbol, leftHanded, width }: { symbol: string; leftHanded: boolean; width: number }) {
  const shape = guitarShape(symbol);
  if (!shape) return <NoDiagram width={width} />;

  const played = shape.frets.filter((f) => f > 0);
  const minFret = played.length ? Math.min(...played) : 1;
  const maxFret = played.length ? Math.max(...played) : 1;
  const startFret = maxFret <= 4 ? 1 : minFret; // window start
  const FRETS = 4;

  const W = width;
  const padX = W * 0.13;
  const padTop = W * 0.2;
  const padBottom = W * 0.1;
  const gridW = W - padX * 2;
  const gridH = W - padTop - padBottom;
  const stringGap = gridW / 5;
  const fretGap = gridH / FRETS;

  // String index in draw order (0 = leftmost). Standard: low-E on left.
  const order = leftHanded ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
  const xOf = (drawIdx: number) => padX + drawIdx * stringGap;
  const yOfFret = (fret: number) => padTop + (fret - startFret + 0.5) * fretGap;

  const dotColor = 'var(--accent-strong)';

  return (
    <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="img" aria-label={`${symbol} guitar chord`}>
      {/* nut or start-fret label */}
      {startFret === 1 ? (
        <rect x={padX} y={padTop - 5} width={gridW} height={5} fill="var(--text)" rx={1} />
      ) : (
        <text x={padX - 8} y={padTop + fretGap * 0.6} fontSize={W * 0.11} fill="var(--text-dim)" textAnchor="end">
          {startFret}
        </text>
      )}

      {/* frets */}
      {Array.from({ length: FRETS + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padX} y1={padTop + i * fretGap} x2={padX + gridW} y2={padTop + i * fretGap} stroke="var(--line)" strokeWidth={1.5} />
      ))}
      {/* strings */}
      {order.map((_, i) => (
        <line key={`s${i}`} x1={xOf(i)} y1={padTop} x2={xOf(i)} y2={padTop + gridH} stroke="var(--text-faint)" strokeWidth={1.3} />
      ))}

      {/* barre */}
      {shape.barreFret ? renderBarre(shape, order, xOf, yOfFret, startFret) : null}

      {/* dots + open/muted markers */}
      {order.map((stringIdx, drawIdx) => {
        const fret = shape.frets[stringIdx];
        const x = xOf(drawIdx);
        if (fret === -1) {
          return <MarkX key={drawIdx} x={x} y={padTop - 12} r={W * 0.03} />;
        }
        if (fret === 0) {
          return <circle key={drawIdx} cx={x} cy={padTop - 12} r={W * 0.035} fill="none" stroke="var(--text-dim)" strokeWidth={1.6} />;
        }
        // Skip drawing a separate dot on the barre fret's outer strings (covered by barre bar).
        return <circle key={drawIdx} cx={x} cy={yOfFret(fret)} r={W * 0.06} fill={dotColor} />;
      })}
    </svg>
  );
}

function renderBarre(
  shape: GuitarShape,
  order: number[],
  xOf: (i: number) => number,
  yOfFret: (f: number) => number,
  _startFret: number,
) {
  const bf = shape.barreFret!;
  // Find the span of strings sitting at the barre fret.
  const drawIdxAt = order.map((si) => shape.frets[si]);
  const first = drawIdxAt.findIndex((f) => f === bf);
  const last = drawIdxAt.length - 1 - [...drawIdxAt].reverse().findIndex((f) => f === bf);
  if (first < 0 || last <= first) return null;
  const x1 = xOf(first);
  const x2 = xOf(last);
  const y = yOfFret(bf);
  const h = 12;
  return <rect x={x1 - h / 2} y={y - h / 2} width={x2 - x1 + h} height={h} rx={h / 2} fill="var(--accent-strong)" />;
}

function MarkX({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g stroke="var(--text-faint)" strokeWidth={1.6}>
      <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
      <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
    </g>
  );
}

function NoDiagram({ width }: { width: number }) {
  return (
    <div style={{ width, height: width, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 8 }}>
      no diagram
    </div>
  );
}

// ---- Piano ----

function PianoDiagram({ symbol, width }: { symbol: string; width: number }) {
  const v = pianoVoicing(symbol);
  if (!v) return <NoDiagram width={width / 1.6} />;
  const set = new Set(v.pitchClasses.map((p) => ((p % 12) + 12) % 12));
  const rootPc = ((v.root % 12) + 12) % 12;

  // Two octaves starting at C.
  const whiteMap = [0, 2, 4, 5, 7, 9, 11];
  const octaves = 2;
  const whiteCount = whiteMap.length * octaves;
  const H = width * 0.42;
  const ww = width / whiteCount;
  const bw = ww * 0.62;
  const bh = H * 0.62;

  const whites: JSXNode[] = [];
  const blacks: JSXNode[] = [];
  for (let o = 0; o < octaves; o++) {
    whiteMap.forEach((pc, i) => {
      const idx = o * 7 + i;
      const x = idx * ww;
      const on = set.has(pc);
      whites.push(
        <g key={`w${idx}`}>
          <rect x={x} y={0} width={ww} height={H} fill={on ? (pc === rootPc ? 'var(--accent-strong)' : 'var(--accent)') : 'var(--bg-elev)'} stroke="var(--line)" strokeWidth={1} />
          {on && <text x={x + ww / 2} y={H - 6} fontSize={ww * 0.5} textAnchor="middle" fill="#0b0d10" fontWeight="700">{NOTE_LABELS[pc][0]}</text>}
        </g>,
      );
    });
    // Black keys sit between certain whites.
    [[0, 1], [1, 2], [3, 4], [4, 5], [5, 6]].forEach(([leftWhite], k) => {
      const blackPc = [1, 3, 6, 8, 10][k];
      const idx = o * 7 + leftWhite;
      const x = (idx + 1) * ww - bw / 2;
      const on = set.has(blackPc);
      blacks.push(
        <rect key={`b${o}-${k}`} x={x} y={0} width={bw} height={bh} rx={2} fill={on ? (blackPc === rootPc ? 'var(--accent-strong)' : 'var(--accent)') : 'var(--text)'} stroke="var(--bg)" strokeWidth={1} />,
      );
    });
  }

  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${symbol} piano chord`}>
      {whites}
      {blacks}
    </svg>
  );
}

type JSXNode = ReturnType<typeof MarkX>;
