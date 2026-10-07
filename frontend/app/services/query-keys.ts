import type { LibraryFilters } from './library-search'

type SessionID = string | null | undefined

export const queryKeys = {
  account: (sessionId: SessionID) => ['account', sessionId] as const,
  profile: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'profile'] as const,
  workoutLists: (sessionId: SessionID) =>
    [...queryKeys.account(sessionId), 'workouts', 'lists'] as const,
  workoutList: (sessionId: SessionID, filters: LibraryFilters, limit = 20) =>
    [...queryKeys.workoutLists(sessionId), filters, limit] as const,
  workout: (sessionId: SessionID, id: string) =>
    [...queryKeys.account(sessionId), 'workouts', 'detail', id] as const,
  workoutSummaries: (sessionId: SessionID) =>
    [...queryKeys.account(sessionId), 'workouts', 'summaries'] as const,
  workoutSummary: (sessionId: SessionID, { q, level }: LibraryFilters) =>
    [...queryKeys.workoutSummaries(sessionId), { q, level }] as const,
  activities: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'activity'] as const,
  activity: (sessionId: SessionID, timezone: string) =>
    [...queryKeys.activities(sessionId), timezone] as const,
  updateAccount: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'update'] as const,
  completion: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'complete'] as const,
  accountExport: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'export'] as const,
  generate: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'generate'] as const,
}
