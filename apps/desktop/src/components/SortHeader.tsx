import type { SortDirection } from '../league-browser';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** Clickable column header: click once to sort, again to flip direction. */
export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  title,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (column: K) => void;
  title?: string;
}) {
  const active = sort.key === column;
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={ariaSort} className={active ? 'sortable sorted' : 'sortable'}>
      <button type="button" className="sort-btn" onClick={() => onSort(column)} title={title ?? `Sort by ${label}`}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}

/** Next sort state after clicking `column`, with a per-column default direction. */
export function nextSort<K extends string>(
  current: SortState<K>,
  column: K,
  defaultDirection: SortDirection,
): SortState<K> {
  if (current.key === column) {
    return { key: column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key: column, direction: defaultDirection };
}
