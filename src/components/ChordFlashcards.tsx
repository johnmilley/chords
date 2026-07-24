import { useState } from 'react';
import type { ChordPoolEntry, MasteryMap } from '../lib/mastery';
import { recordQuizResult } from '../lib/mastery';
import { makeQuestion, type QuizQuestion } from '../lib/quiz';
import { ChordDiagram } from './ChordDiagram';
import { IconBack } from './icons';

interface Props {
  pool: ChordPoolEntry[];
  mastery: MasteryMap;
  instrument: 'guitar' | 'piano';
  leftHanded: boolean;
  onMasteryChange: (m: MasteryMap) => void;
  onBack: () => void;
}

type Mode = 'name-it' | 'pick-it';

export function ChordFlashcards({ pool, mastery, instrument, leftHanded, onMasteryChange, onBack }: Props) {
  const [mode, setMode] = useState<Mode>(() => (Math.random() < 0.5 ? 'name-it' : 'pick-it'));
  const [q, setQ] = useState<QuizQuestion | null>(() => makeQuestion(pool, mastery));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const next = (lastAnswer?: string) => {
    setMode(Math.random() < 0.5 ? 'name-it' : 'pick-it');
    setQ(makeQuestion(pool, mastery, lastAnswer));
    setPicked(null);
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
        <h1>Chord Flashcards <span className="sub">{score.correct}/{score.total}</span></h1>
      </div>

      <div className="scroll">
        {!q ? (
          <div className="empty"><p>Load a few songs first — flashcards need at least two different chords to quiz you on.</p></div>
        ) : (
          <div className="quiz">
            {mode === 'name-it' ? (
              <>
                <div className="quiz-prompt">What chord is this?</div>
                <ChordDiagram symbol={q.answer} instrument={instrument} leftHanded={leftHanded} size={180} />
                <div className="quiz-options">
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
              </>
            ) : (
              <>
                <div className="quiz-prompt">Which one is <b>{q.answer}</b>?</div>
                <div className="quiz-diagram-grid">
                  {q.options.map((o) => (
                    <button
                      key={o}
                      className={`quiz-dcard${picked ? (o === q.answer ? ' correct' : o === picked ? ' wrong' : '') : ''}`}
                      onClick={() => choose(o)}
                      disabled={!!picked}
                    >
                      <ChordDiagram symbol={o} instrument={instrument} leftHanded={leftHanded} size={92} />
                    </button>
                  ))}
                </div>
              </>
            )}

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
