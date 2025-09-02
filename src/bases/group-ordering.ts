import { coerceForCompare } from './sorting';

/** Build a comparator for group names based on a property values domain
 * Strategy:
 *  - If groupBy property is the same as first sort key -> order groups using that sort key (ASC/DESC)
 *  - Else default to alphabetical ASC
 */
export function getGroupNameComparator(
  firstSortEntry: { id: string; direction: 'ASC' | 'DESC' } | null
): ((a: string, b: string) => number) {
  if (!firstSortEntry) {
    return (a, b) => String(a).localeCompare(String(b));
  }
  const dir = firstSortEntry.direction;
  return (a, b) => {
    const ca = coerceForCompare(a);
    const cb = coerceForCompare(b);
    let cmp = 0;
    if (typeof ca === 'number' && typeof cb === 'number') cmp = ca - cb;
    else if (typeof ca === 'string' && typeof cb === 'string') cmp = ca.localeCompare(cb);
    else cmp = String(ca).localeCompare(String(cb));
    return dir === 'DESC' ? -cmp : cmp;
  };
}

