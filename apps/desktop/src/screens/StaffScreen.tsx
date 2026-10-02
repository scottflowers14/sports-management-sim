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

interface StaffScreenProps {
  staff: LacrosseStaff;
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

export function StaffScreen({ staff, candidates, budget, onHire, onRelease }: StaffScreenProps) {
  const payroll = staffPayroll(staff);
  const room = budget - payroll;
  const usedPct = Math.min(100, Math.round((payroll / budget) * 100));

  return (
    <div className="staff-layout">
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
              return (
                <tr key={role} className={member ? undefined : 'staff-vacant'}>
                  <td>
                    <strong>{STAFF_ROLE_LABELS[role].title}</strong>
                    <div className="dim staff-role-effect">{STAFF_ROLE_LABELS[role].effect}</div>
                  </td>
                  <td>{member ? `${member.name.first} ${member.name.last}` : <em>Vacant</em>}</td>
                  <td>
                    <span className={ratingClass(staffRating(staff, role))}>{member?.rating ?? VACANT_STAFF_RATING}</span>
                  </td>
                  <td>{member ? formatSalary(member.salary) : '—'}</td>
                  <td>{member ? `${member.yearsLeft} yr${member.yearsLeft === 1 ? '' : 's'}` : '—'}</td>
                  <td>{describeStaffEffect(role, staffRating(staff, role))}</td>
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
