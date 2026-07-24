import { useState } from 'react';
import type { ChordPoolEntry, MasteryMap } from '../lib/mastery';
import { recordQuizResult } from '../lib/mastery';
import { makeQuestion, type QuizQuestion } from '../lib/quiz';
import { playChordAudio } from '../lib/audio';
import { IconBack, IconPlay } from './icons';

interface Props {
  pool: ChordPoolEntry[];
  mastery: MasteryMap;
  onMasteryChange: (m: MasteryMap) => void;
  onBack: () => void;
}

export function EarTraining({ pool, mastery, onMasteryChange, onBack }: Props) {
  const [q, setQ] = useState<QuizQuestion | null>(() => makeQuestion(pool, mastery));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [played, setPlayed] = useState(false);

  const play = (symbol: string) => {
    playChordAudio(symbol);
    setPlayed(true);
  };

  const next = (lastAnswer?: string) => {
    setQ(makeQuestion(pool, mastery, lastAnswer));
    setPicked(null);
    setPlayed(false);
  };

  const choose = (option: string) => {
    if (picked || !q) return;
    const correct = option === q.answer;
    setPicked(option);
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    onMasteryChange(recordQuizResult(mastery, q.answer, correct));
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
        <h1>Ear Training <span className="sub">{score.correct}/{score.total}</span></h1>
      </div>

      <div className="scroll">
        {!q ? (
          <div className="empty"><p>Load a few songs first — ear training needs at least two different chords to quiz you on.</p></div>
        ) : (
          <div className="quiz">
            <div className="quiz-prompt">Which chord is this?</div>
            <button className="ear-play" onClick={() => play(q.answer)} aria-label="Play chord">
              <IconPlay size={40} />
            </button>
            {played && <div className="hint" style={{ textAlign: 'center' }}>Tap again to replay</div>}
            <div className="quiz-options" style={{ marginTop: 22 }}>
              {q.options.map((o) => (
                <button
                  key={o}
                  className={`quiz-opt${picked ? (o === q.answer ? ' correct' : o === picked ? ' wrong' : '') : ''}`}
                  onClick={() => choose(o)}
                  disabled={!!picked}
                >
                  {o}
                </button>
              ))}
            </div>
            {picked && (
              <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => next(q.answer)}>
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
