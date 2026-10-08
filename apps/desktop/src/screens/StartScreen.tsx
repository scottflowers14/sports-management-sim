import { useRef, useState } from 'react';
import type { DynastySaveMetadata } from '../persistence';
import { PROGRAM_TIER_NOTES, programTier, recommendedStarterTeam, type DynastyTeamChoice } from '../dynasty-factory';
import { DIFFICULTIES, DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS, type Difficulty } from '../difficulty';

export function StartScreen({
  saves,
  teamChoices,
  selectedTeamId,
  coachName,
  difficulty = 'normal',
  onDifficultyChange,
  onTeamChange,
  onCoachNameChange,
  onCreateDynasty,
  onLoadSave,
  onDeleteSave,
  onContinue,
  onExportSave,
  onImportSave,
  onExportTeamsTemplate,
  onImportTeams,
  onClearCustomTeams,
  hasCustomTeams,
  saveStatus,
  profileSummary,
  saveLegacies = {},
}: {
  saves: DynastySaveMetadata[];
  teamChoices: DynastyTeamChoice[];
  selectedTeamId: string;
  coachName: string;
  difficulty?: Difficulty;
  onDifficultyChange?: (difficulty: Difficulty) => void;
  onTeamChange: (teamId: string) => void;
  onCoachNameChange: (name: string) => void;
  onCreateDynasty: () => void;
  onLoadSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onContinue?: () => void;
  onExportSave?: (saveId: string) => void;
  onImportSave?: (json: string) => void;
  onExportTeamsTemplate?: () => void;
  onImportTeams?: (json: string) => void;
  onClearCustomTeams?: (() => void) | undefined;
  hasCustomTeams?: boolean | undefined;
  saveStatus?: string;
  /** Profile level and achievement count, once the player has earned any. */
  profileSummary?: { level: number; unlocked: number; total: number; points: number } | undefined;
  /** Legacy tier of each save's coaching career, by save id, from the profile. */
  saveLegacies?: Readonly<Record<string, string>>;
}) {
  const selectedTeam = teamChoices.find((team) => team.id === selectedTeamId) ?? teamChoices[0];
  const starter = recommendedStarterTeam(teamChoices);
  // Conferences in the order of their best program, teams strongest first.
  const conferenceGroups = [...new Set(teamChoices.map((t) => t.conferenceName ?? 'Independent'))]
    .map((name) => ({
      name,
      teams: teamChoices.filter((t) => (t.conferenceName ?? 'Independent') === name).sort((a, b) => b.prestige - a.prestige),
    }))
    .sort((a, b) => (b.teams[0]?.prestige ?? 0) - (a.teams[0]?.prestige ?? 0));
  const importInputRef = useRef<HTMLInputElement>(null);
  const teamsInputRef = useRef<HTMLInputElement>(null);
  const [confirmingNewDynasty, setConfirmingNewDynasty] = useState(false);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportSave) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') onImportSave(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleTeamsFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportTeams) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') onImportTeams(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <main className="start-screen" aria-label="Dynasty start screen">
      <section className="start-hero card">
        <p className="eyebrow">Men's College Lacrosse</p>
        <h1>Sports Management Sim</h1>
        <p className="dim">
          Load an existing career or start a new dynasty with a fresh recruiting universe.
        </p>
        {profileSummary && profileSummary.unlocked > 0 && (
          <p className="start-profile-summary" aria-label="Profile summary">
            <strong>Profile level {profileSummary.level}</strong> · {profileSummary.unlocked} of {profileSummary.total} achievements ·{' '}
            {profileSummary.points} pts
          </p>
        )}
        {onContinue && (
          <button type="button" className="primary-action continue-btn" onClick={onContinue}>
            Continue
          </button>
        )}
      </section>

      <section className="start-grid">
        <article className="card new-dynasty-card" aria-label="Create dynasty">
          <p className="eyebrow">New Dynasty</p>
          <h2>Choose Your Program</h2>
          <label className="field-label" htmlFor="coach-name-input">
            Head Coach Name
          </label>
          <input
            id="coach-name-input"
            type="text"
            value={coachName}
            maxLength={40}
            onChange={(event) => onCoachNameChange(event.target.value)}
            placeholder="Enter coach name"
            className="start-text-input"
          />
          <label className="field-label" htmlFor="team-select">
            Team
          </label>
          <select id="team-select" value={selectedTeamId} onChange={(event) => onTeamChange(event.target.value)}>
            {conferenceGroups.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} · {programTier(team.prestige)} · Prestige {team.prestige}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedTeam && (
            <div className="team-pick-note" aria-label="Program outlook">
              <span className={`tier-tag tier-${programTier(selectedTeam.prestige).replace(' ', '-').toLowerCase()}`}>
                {programTier(selectedTeam.prestige)}
              </span>
              <p className="dim">
                Start as {selectedTeam.name}
                {selectedTeam.conferenceName ? ` in the ${selectedTeam.conferenceName}` : ''}.{' '}
                {PROGRAM_TIER_NOTES[programTier(selectedTeam.prestige)]}
              </p>
            </div>
          )}
          {starter && starter.id !== selectedTeam?.id && (
            <p className="dim team-pick-suggest">
              New to the game?{' '}
              <button type="button" className="link-btn" onClick={() => onTeamChange(starter.id)}>
                Try {starter.name}
              </button>
              , a Contender with a roster that can win now.
            </p>
          )}
          {onDifficultyChange && (
            <>
              <p className="field-label" id="difficulty-label">
                Difficulty
              </p>
              <div className="news-filters difficulty-picker" role="group" aria-labelledby="difficulty-label">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`pos-filter-btn${difficulty === d ? ' active' : ''}`}
                    aria-pressed={difficulty === d}
                    onClick={() => onDifficultyChange(d)}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
              <p className="dim">{DIFFICULTY_DESCRIPTIONS[difficulty]}</p>
            </>
          )}
          {confirmingNewDynasty ? (
            <div className="new-dynasty-confirm">
              <p className="dim">Your existing saves won't be deleted.</p>
              <div className="new-dynasty-confirm-btns">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => { setConfirmingNewDynasty(false); onCreateDynasty(); }}
                >
                  Yes, Start New
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingNewDynasty(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                if (saves.length > 0) {
                  setConfirmingNewDynasty(true);
                } else {
                  onCreateDynasty();
                }
              }}
            >
              Start New Dynasty
            </button>
          )}
        </article>

        <article className="card load-dynasty-card" aria-label="Load dynasty">
          <p className="eyebrow">Load Dynasty</p>
          <h2>Existing Saves</h2>
          {saves.length === 0 ? (
            <p className="dim">No saved dynasties yet. Create one to get started.</p>
          ) : (
            <div className="save-list">
              {saves.map((save) => (
                <div key={save.saveId} className="save-slot">
                  <span>
                    <strong>
                      {save.name}
                      {save.difficulty && (
                        <span className={`difficulty-tag difficulty-${save.difficulty}`}>{DIFFICULTY_LABELS[save.difficulty]}</span>
                      )}
                    </strong>
                    <small>
                      {save.userTeamName} · {save.seasonYear} Week {save.currentWeek} · {save.record.wins}–
                      {save.record.losses}
                      {saveLegacies[save.saveId] && ` · ${saveLegacies[save.saveId]} legacy`}
                    </small>
                  </span>
                  <span className="save-slot-actions">
                    <button
                      type="button"
                      className="save-slot-action load"
                      aria-label={`Load ${save.name}`}
                      onClick={() => onLoadSave(save.saveId)}
                    >
                      Load
                    </button>
                    {onExportSave && (
                      <button
                        type="button"
                        className="save-slot-action export"
                        aria-label={`Export ${save.name}`}
                        onClick={() => onExportSave(save.saveId)}
                      >
                        Export
                      </button>
                    )}
                    <button
                      type="button"
                      className="save-slot-action delete"
                      aria-label={`Delete ${save.name}`}
                      onClick={() => onDeleteSave(save.saveId)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {onImportSave && (
            <div className="import-save-row">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
                aria-label="Import save file"
              />
              <button
                type="button"
                className="save-slot-action import"
                onClick={() => importInputRef.current?.click()}
              >
                Import Save from File
              </button>
            </div>
          )}
        </article>
      </section>

      <section className="card teams-config-card" aria-label="Custom teams configuration">
        <p className="eyebrow">Custom Teams</p>
        <h2>Schools &amp; Conferences</h2>
        {hasCustomTeams ? (
          <p className="dim">Custom teams are active. New dynasties will use your imported schools.</p>
        ) : (
          <p className="dim">
            Export the default schools as a JSON template, edit it to add your own programs, then import it before starting a new dynasty.
          </p>
        )}
        <div className="teams-config-actions">
          {onExportTeamsTemplate && (
            <button type="button" className="save-slot-action export" onClick={onExportTeamsTemplate}>
              Export Teams Template
            </button>
          )}
          {onImportTeams && (
            <>
              <input
                ref={teamsInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleTeamsFile}
                aria-label="Import custom teams file"
              />
              <button
                type="button"
                className="save-slot-action import"
                onClick={() => teamsInputRef.current?.click()}
              >
                Import Custom Teams
              </button>
            </>
          )}
          {onClearCustomTeams && (
            <button type="button" className="save-slot-action delete" onClick={onClearCustomTeams}>
              Restore Defaults
            </button>
          )}
        </div>
        {saveStatus && <p className="save-status-msg dim">{saveStatus}</p>}
      </section>
    </main>
  );
}
