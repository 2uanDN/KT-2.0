/**
 * Represents the state of a single entity query.
 * Distinguishes cleanly between asynchronous loading and a verified 'not found' state.
 */
export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'found'; data: T }
  | { status: 'notFound' };
