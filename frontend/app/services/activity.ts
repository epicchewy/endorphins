import type { components } from '~/types/api.gen'
import { request, type GetToken } from './http'

export type Activity = components['schemas']['Activity']
export type Completion = components['schemas']['Completion']
export function getActivity(
  timezone: string,
  getToken: GetToken,
  signal?: AbortSignal,
): Promise<Activity> {
  return request(`/api/v1/activity?${new URLSearchParams({ timezone })}`, getToken, { signal })
}
export function completeWorkout(id: string, key: string, getToken: GetToken): Promise<Completion> {
  return request(`/api/v1/workouts/${encodeURIComponent(id)}/completions`, getToken, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
  })
}
export function undoCompletion(
  id: string,
  getToken: GetToken,
): Promise<components['schemas']['UndoCompletion']> {
  return request(`/api/v1/completions/${encodeURIComponent(id)}`, getToken, { method: 'DELETE' })
}
export const completionMilestones = [1, 5, 10, 25, 50]
export function completionMilestone(count: number): number | null {
  return completionMilestones.findLast((value) => count >= value) ?? null
}
