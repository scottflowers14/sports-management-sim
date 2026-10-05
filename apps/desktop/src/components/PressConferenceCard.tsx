import { describeEffects, type PressQuestion } from '../press-conference';

export function PressConferenceCard({ press, onAnswer }: { press: PressQuestion; onAnswer: (answerId: string) => void }) {
  return (
    <article className="card press-card" aria-label="Press conference">
      <p className="eyebrow">Postgame Press Conference · Week {press.week}</p>
      <h2 className="press-question">“{press.question}”</h2>
      <div className="press-answers">
        {press.answers.map((answer) => (
          <button key={answer.id} type="button" className="press-answer" onClick={() => onAnswer(answer.id)}>
            <strong>{answer.label}</strong>
            <span className="press-quote">“{answer.quote}”</span>
            <span className="press-effects">{describeEffects(answer.effects)}</span>
          </button>
        ))}
      </div>
    </article>
  );
}
