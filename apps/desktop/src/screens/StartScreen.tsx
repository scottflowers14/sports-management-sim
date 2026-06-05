import { useRef } from 'react';
import type { DynastySaveMetadata } from '../persistence';
import type { DynastyTeamChoice } from '../dynasty-factory';

export function StartScreen({
  saves,
  teamChoices,
  selectedTeamId,
  coachName,
  onTeamChange,
  onCoachNameChange,
  onCreateDynasty,
  onLoadSave,
  onDeleteSave,
  onContinue,
  onExportSave,
  onImportSave,
  saveStatus,
}: {
  saves: DynastySaveMetadata[];
  teamChoices: DynastyTeamChoice[];
  selectedTeamId: string;
  coachName: string;
  onTeamChange: (teamId: string) => void;
  onCoachNameChange: (name: string) => void;
  onCreateDynasty: () => void;
  onLoadSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onContinue?: () => void;
  onExportSave?: (saveId: string) => void;
  onImportSave?: (json: string) => void;
  saveStatus?: string;
}) {
  const selectedTeam = teamChoices.find((team) => team.id === selectedTeamId) ?? teamChoices[0];
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportSave) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') onImportSave(text);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
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
            {teamChoices.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} · Prestige {team.prestige}
              </option>
            ))}
          </select>
          {selectedTeam && (
            <p className="dim">
              Start as {selectedTeam.name}
              {selectedTeam.conferenceId ? ` in ${selectedTeam.conferenceId.toUpperCase()}` : ''}.
            </p>
          )}
          <button type="button" className="primary-action" onClick={onCreateDynasty}>
            Start New Dynasty
          </button>
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
                    <strong>{save.name}</strong>
                    <small>
                      {save.userTeamName} · {save.seasonYear} Week {save.currentWeek} · {save.record.wins}–
                      {save.record.losses}
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

          {saveStatus && <p className="save-status-msg dim">{saveStatus}</p>}

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
    </main>
  );
}
