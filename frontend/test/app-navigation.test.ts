import { expect, test } from 'bun:test'
import { safeAppPath } from '../app/services/app-navigation'
test('auth return paths keep workout settings and remain inside the app', () => {
  expect(safeAppPath('/app/new?minutes=75&level=4')).toBe('/app/new?minutes=75&level=4')
  expect(safeAppPath('/workouts/saved?level=3')).toBe('/app/workouts/saved?level=3')
  expect(safeAppPath('/app/workouts/saved/finish')).toBe('/app/workouts/saved/finish')
  for (const path of [
    undefined,
    'https://example.com/app',
    '//example.com/app',
    '/app/../sign-in',
    '/app/onboarding',
    '/app/onboarding/?next=/app/onboarding',
    '/application',
    '/\\example.com',
  ])
    expect(safeAppPath(path)).toBe('/app')
})
