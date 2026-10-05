import {
  TEAM_TALK_LABELS,
  TEAM_TALK_LINES,
  TEAM_TALK_TONES,
  type TeamTalkReaction,
  type TeamTalkTone,
} from '@sports-management-sim/sport-lacrosse';
import type { PregameTalk } from '../week-sim';

const REACTION_TEXT: Record<TeamTalkReaction, string> = {
  positive: 'The room is buzzing. They bought in.',
  neutral: 'Heads nod. Business as usual.',
  negative: 'Shoulders tighten. That one didn’t land.',
};

export function TeamTalkCard({
  opponentName,
  talk,
  onTalk,
}: {
  opponentName: string;
  talk: PregameTalk | null;
  onTalk: (tone: TeamTalkTone) => void;
}) {
  return (
    <article className="card team-talk-card" aria-label="Team talk">
      <p className="section-label">Pregame Team Talk · vs {opponentName}</p>
      {talk ? (
        <div className={`team-talk-result team-talk-${talk.result.reaction}`}>
          <p className="team-talk-quote">{TEAM_TALK_LINES[talk.tone]}</p>
          <p>
            <strong>{REACTION_TEXT[talk.result.reaction]}</strong>
          </p>
        </div>
      ) : (
        <>
          <p className="dim team-talk-hint">
            One talk before the game. Underdogs and rivalry games feed off emotion; favorites need pushing.
          </p>
          <div className="team-talk-options">
            {TEAM_TALK_TONES.map((tone) => (
              <button key={tone} type="button" className="team-talk-btn" onClick={() => onTalk(tone)}>
                <strong>{TEAM_TALK_LABELS[tone]}</strong>
                <span className="dim">{TEAM_TALK_LINES[tone]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
