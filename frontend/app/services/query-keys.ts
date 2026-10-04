import type { LibraryFilters } from './library-search'

type SessionID = string | null | undefined

export const queryKeys = {
  account: (sessionId: SessionID) => ['account', sessionId] as const,
  profile: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'profile'] as const,
  workoutLists: (sessionId: SessionID) =>
    [...queryKeys.account(sessionId), 'workouts', 'lists'] as const,
  workoutList: (sessionId: SessionID, filters: LibraryFilters) =>
    [...queryKeys.workoutLists(sessionId), filters] as const,
  workout: (sessionId: SessionID, id: string) =>
    [...queryKeys.account(sessionId), 'workouts', 'detail', id] as const,
  workoutSummaries: (sessionId: SessionID) =>
    [...queryKeys.account(sessionId), 'workouts', 'summaries'] as const,
  workoutSummary: (sessionId: SessionID, { q, level }: LibraryFilters) =>
    [...queryKeys.workoutSummaries(sessionId), { q, level }] as const,
  accountExport: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'export'] as const,
  generate: (sessionId: SessionID) => [...queryKeys.account(sessionId), 'generate'] as const,
}
