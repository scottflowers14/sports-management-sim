/** Color-graded rating number, like the green/yellow/red grades in management sims. */
export function RatingCell({ value }: { value: number }) {
  const tier = value >= 80 ? 'r-elite' : value >= 70 ? 'r-good' : value >= 60 ? 'r-avg' : value >= 50 ? 'r-weak' : 'r-poor';
  return <span className={`rating-cell ${tier}`}>{value}</span>;
}
