import type { components } from '~/types/api.gen'
import { request, type GetToken } from './http'
import { libraryFilterParams, type LibraryFilters } from './library-search'

export type Workout = components['schemas']['Workout']
export type WorkoutPage = components['schemas']['WorkoutPage']
export type WorkoutSummary = components['schemas']['WorkoutSummary']
export type GenerateInput = components['schemas']['GenerateRequest']
export type Exercise = components['schemas']['Exercise']

export function generateWorkout(
  input: GenerateInput,
  getToken: GetToken,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<Workout> {
  return request('/api/v1/workouts', getToken, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
}

export function listWorkouts(
  filters: LibraryFilters,
  cursor: string,
  getToken: GetToken,
  signal?: AbortSignal,
  limit = 20,
): Promise<WorkoutPage> {
  const params = libraryFilterParams(filters)
  params.set('sort', filters.sort)
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  return request(`/api/v1/workouts?${params}`, getToken, { signal })
}

export function summarizeWorkouts(
  filters: LibraryFilters,
  getToken: GetToken,
  signal?: AbortSignal,
): Promise<WorkoutSummary> {
  return request(`/api/v1/workouts/summary?${libraryFilterParams(filters)}`, getToken, { signal })
}

export function getWorkout(id: string, getToken: GetToken, signal?: AbortSignal): Promise<Workout> {
  return request(`/api/v1/workouts/${encodeURIComponent(id)}`, getToken, { signal })
}
