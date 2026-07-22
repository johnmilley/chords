import { useMemo } from 'react';
import { parseChordPro } from '../lib/chordpro';
import { transposeChord, transposeKeyName } from '../lib/music';

interface Props {
  body: string;
  /** net semitone shift to display (transpose - capo). */
  shift: number;
  targetKey?: string;
  columns: boolean;
  onChordTap: (symbol: string) => void;
}

export function ChordSheet({ body, shift, targetKey, columns, onChordTap }: Props) {
  const { lines } = useMemo(() => parseChordPro(body), [body]);
  const key = targetKey ? transposeKeyName(targetKey, shift) : undefined;

  return (
    <div className={`sheet${columns ? ' columns' : ''}`}>
      {lines.map((line, i) => {
        if (line.type === 'blank') return <div key={i} className="blank" />;
        if (line.type === 'section') return <div key={i} className="section">{line.label}</div>;
        if (line.type === 'comment') return <div key={i} className="comment">{line.text}</div>;
        const hasChord = line.segments.some((s) => s.chord);
        return (
          <div key={i} className="lyric-line">
            {line.segments.map((seg, j) => {
              const shown = seg.chord ? transposeChord(seg.chord, shift, key) : '';
              return (
                <span key={j} className={`seg${hasChord ? '' : ' chordless'}`}>
                  <span
                    className="ch"
                    onClick={seg.chord ? () => onChordTap(shown) : undefined}
                    role={seg.chord ? 'button' : undefined}
                  >
                    {shown}
                  </span>
                  <span className="tx">{seg.text || (seg.chord ? ' ' : '')}</span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
