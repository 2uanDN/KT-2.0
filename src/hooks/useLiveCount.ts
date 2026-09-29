import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export function useInboxCount(): number {
  const count = useLiveQuery(async () => {
    return db.items.where('status').equals('inbox').count();
  }, []);

  return count ?? 0;
}

export function useSavedCount(): number {
  const count = useLiveQuery(async () => {
    return db.items.where('status').equals('saved').count();
  }, []);

  return count ?? 0;
}
