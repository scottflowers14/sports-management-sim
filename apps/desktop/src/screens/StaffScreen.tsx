import {
  formatSalary,
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  staffPayroll,
  staffRating,
  VACANT_STAFF_RATING,
  type LacrosseStaff,
  type StaffMember,
  type StaffRole,
} from '@sports-management-sim/sport-lacrosse';
import { describeStaffEffect } from '../program-staff';
import {
  ABILITY_TIER_BONUS,
  abilityStaffBonus,
  availablePoints,
  canUpgrade,
  COACH_ABILITIES,
  COACH_ABILITY_INFO,
  coachXp,
  MAX_ABILITY_TIER,
  tierCost,
  XP_PER_POINT,
  xpToNextPoint,
  type CoachAbility,
} from '../coach-abilities';
import type { CoachProfile } from '../coach-profile';

interface StaffScreenProps {
  staff: LacrosseStaff;
  /** The head coach, whose abilities lift the staff. */
  coach?: CoachProfile | null;
  onUpgradeAbility?: (ability: CoachAbility) => void;
  candidates: StaffMember[];
  budget: number;
  onHire: (candidateId: string) => void;
  onRelease: (role: StaffRole) => void;
}

function ratingClass(rating: number): string {
  if (rating >= 80) return 'staff-rating staff-rating-elite';
  if (rating >= 65) return 'staff-rating staff-rating-good';
  if (rating >= 52) return 'staff-rating';
  return 'staff-rating staff-rating-poor';
}

export function StaffScreen({ staff, coach, onUpgradeAbility, candidates, budget, onHire, onRelease }: StaffScreenProps) {
  const payroll = staffPayroll(staff);
  const room = budget - payroll;
  const usedPct = Math.min(100, Math.round((payroll / budget) * 100));

  const abilities = coach?.abilities;

  return (
    <div className="staff-layout">
      {coach && onUpgradeAbility && <CoachAbilitiesCard coach={coach} onUpgrade={onUpgradeAbility} />}

      <article className="card" aria-label="Coaching staff">
        <div className="staff-header">
          <h2>Coaching Staff</h2>
          <div className="staff-budget">
            <span>
              Payroll <strong>{formatSalary(payroll)}</strong> of {formatSalary(budget)}
            </span>
            <div className="staff-budget-bar" aria-hidden="true">
              <div className="staff-budget-fill" style={{ width: `${usedPct}%` }} />
            </div>
            <span className="dim">{formatSalary(Math.max(0, room))} available</span>
          </div>
        </div>
        <table className="standings-table staff-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Coach</th>
              <th>Rating</th>
              <th>Salary</th>
              <th>Contract</th>
              <th>Effect</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {STAFF_ROLES.map((role) => {
              const member = staff[role];
              const bonus = abilityStaffBonus(abilities, role);
              const playing = Math.min(99, staffRating(staff, role) + bonus);
              return (
                <tr key={role} className={member ? undefined : 'staff-vacant'}>
                  <td>
                    <strong>{STAFF_ROLE_LABELS[role].title}</strong>
                    <div className="dim staff-role-effect">{STAFF_ROLE_LABELS[role].effect}</div>
                  </td>
                  <td>{member ? `${member.name.first} ${member.name.last}` : <em>Vacant</em>}</td>
                  <td>
                    <span className={ratingClass(playing)}>{member?.rating ?? VACANT_STAFF_RATING}</span>
                    {bonus > 0 && (
                      <span className="staff-coach-bonus" title="From your head coach abilities">
                        +{bonus}
                      </span>
                    )}
                  </td>
                  <td>{member ? formatSalary(member.salary) : '—'}</td>
                  <td>{member ? `${member.yearsLeft} yr${member.yearsLeft === 1 ? '' : 's'}` : '—'}</td>
                  <td>{describeStaffEffect(role, playing)}</td>
                  <td>
                    {member && (
                      <button type="button" className="staff-release-btn" onClick={() => onRelease(role)}>
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="dim staff-note">
          Vacant roles play at a {VACANT_STAFF_RATING} rating. Contracts count down each offseason, and coaches whose deals
          expire come back to the hiring pool asking for a raise.
        </p>
      </article>

      <article className="card" aria-label="Staff candidates">
        <h2>Hiring Pool</h2>
        {candidates.length === 0 && <p className="dim">No candidates right now. A new pool arrives each offseason.</p>}
        <div className="staff-candidate-grid">
          {STAFF_ROLES.map((role) => {
            const pool = candidates.filter((c) => c.role === role).sort((a, b) => b.rating - a.rating);
            if (pool.length === 0) return null;
            const current = staff[role];
            const currentRating = staffRating(staff, role);
            return (
              <section key={role} className="staff-candidate-group">
                <h3>{STAFF_ROLE_LABELS[role].title}</h3>
                <ul>
                  {pool.map((c) => {
                    const newPayroll = payroll - (current?.salary ?? 0) + c.salary;
                    const affordable = newPayroll <= budget;
                    const delta = c.rating - currentRating;
                    return (
                      <li key={c.id} className="staff-candidate">
                        <div>
                          <strong>
                            {c.name.first} {c.name.last}
                          </strong>{' '}
                          <span className="staff-candidate-badges">
                            <span className={ratingClass(c.rating)}>{c.rating}</span>{' '}
                            <span className={delta > 0 ? 'staff-delta-up' : delta < 0 ? 'staff-delta-down' : 'dim'}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          </span>
                          <div className="dim">
                            {formatSalary(c.salary)} · {c.yearsLeft} yrs · {describeStaffEffect(role, c.rating)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="offer-btn staff-hire-btn"
                          disabled={!affordable}
                          title={affordable ? undefined : `Payroll would be ${formatSalary(newPayroll)}`}
                          onClick={() => onHire(c.id)}
                        >
                          Hire
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function CoachAbilitiesCard({ coach, onUpgrade }: { coach: CoachProfile; onUpgrade: (ability: CoachAbility) => void }) {
  const points = availablePoints(coach);
  const xp = coachXp(coach);
  const progressPct = Math.round(((XP_PER_POINT - xpToNextPoint(coach)) / XP_PER_POINT) * 100);
  return (
    <article className="card coach-abilities-card" aria-label="Head coach abilities">
      <div className="staff-header">
        <h2>Head Coach · {coach.name}</h2>
        <div className="staff-budget">
          <span>
            <strong>{points}</strong> ability point{points === 1 ? '' : 's'} to spend · {xp} career XP
          </span>
          <div className="staff-budget-bar" aria-hidden="true">
            <div className="staff-budget-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="dim">{xpToNextPoint(coach)} XP to the next point</span>
        </div>
      </div>
      <ul className="coach-ability-list">
        {COACH_ABILITIES.map((ability) => {
          const info = COACH_ABILITY_INFO[ability];
          const tier = coach.abilities?.[ability] ?? 0;
          const maxed = tier >= MAX_ABILITY_TIER;
          return (
            <li key={ability}>
              <div>
                <strong>{info.title}</strong>
                <span className="dim">{info.blurb}</span>
                <span className="coach-ability-tiers" aria-label={`Tier ${tier} of ${MAX_ABILITY_TIER}`}>
                  {Array.from({ length: MAX_ABILITY_TIER }, (_, i) => (
                    <span key={i} className={i < tier ? 'tier-pip filled' : 'tier-pip'} />
                  ))}
                  <span className="dim">
                    {tier > 0 ? `+${tier * ABILITY_TIER_BONUS} ${STAFF_ROLE_LABELS[info.role].title}` : STAFF_ROLE_LABELS[info.role].title}
                  </span>
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                disabled={!canUpgrade(coach, ability)}
                onClick={() => onUpgrade(ability)}
                aria-label={`Upgrade ${info.title}`}
              >
                {maxed ? 'Maxed' : `Upgrade · ${tierCost(tier + 1)} pt${tierCost(tier + 1) === 1 ? '' : 's'}`}
              </button>
            </li>
          );
        })}
      </ul>
      {coach.lastXpAward && coach.lastXpAward.lines.length > 0 && (
        <p className="dim staff-note">
          {coach.lastXpAward.year} season: {coach.lastXpAward.lines.map((l) => `${l.label} +${l.xp}`).join(', ')}.
        </p>
      )}
      <p className="dim staff-note">
        Wins, goals met, titles, Coach of the Year and pro draft picks earn XP. Every {XP_PER_POINT} XP is an ability point, and
        each tier makes that coordinator play {ABILITY_TIER_BONUS} points better.
      </p>
    </article>
  );
}
