import {
  endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import type { DateRange, RangePreset } from '../domain/types';

/** Indian financial weeks run Monday to Sunday. */
const WEEK_OPTS = { weekStartsOn: 1 as const };

export function rangeFor(preset: RangePreset, now = new Date()): DateRange {
  switch (preset) {
    case 'this_week':
      return {
        from: startOfWeek(now, WEEK_OPTS).getTime(),
        to: endOfWeek(now, WEEK_OPTS).getTime(),
        label: 'This week',
      };
    case 'this_month':
      return {
        from: startOfMonth(now).getTime(),
        to: endOfMonth(now).getTime(),
        label: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      };
    case 'last_month': {
      const previous = subMonths(now, 1);
      return {
        from: startOfMonth(previous).getTime(),
        to: endOfMonth(previous).getTime(),
        label: previous.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      };
    }
    case 'last_30d':
      return {
        from: startOfDay(new Date(now.getTime() - 29 * 86_400_000)).getTime(),
        to: endOfDay(now).getTime(),
        label: 'Last 30 days',
      };
    case 'custom':
    default:
      return rangeFor('this_month', now);
  }
}

export function customRange(from: Date, to: Date): DateRange {
  return {
    from: startOfDay(from).getTime(),
    to: endOfDay(to).getTime(),
    label: `${from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
  };
}

/** The window immediately before `range`, of equal length. Used for pace comparison. */
export function precedingRange(range: DateRange): DateRange {
  const span = range.to - range.from;
  return { from: range.from - span - 1, to: range.from - 1, label: 'Previous period' };
}

export function trailingRange(days: number, now = new Date()): DateRange {
  return {
    from: startOfDay(new Date(now.getTime() - days * 86_400_000)).getTime(),
    to: endOfDay(now).getTime(),
    label: `Last ${days} days`,
  };
}

export const RANGE_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: 'this_week', label: 'Week' },
  { value: 'this_month', label: 'Month' },
  { value: 'last_30d', label: '30 days' },
  { value: 'last_month', label: 'Last mo.' },
];
