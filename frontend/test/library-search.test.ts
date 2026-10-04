import { expect, test } from 'bun:test'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  stripSearchParams,
} from '@tanstack/react-router'
import {
  libraryFilters,
  librarySearch,
  librarySearchDefaults,
} from '../app/services/library-search'

test('library search accepts bounded scalar preferences and ignores unrelated URL input', () => {
  expect(
    librarySearch({
      q: '  Squat  ',
      level: '3',
      sort: 'shortest',
      redirect: 'https://example.com',
    }),
  ).toEqual({
    q: '  Squat  ',
    level: 3,
    sort: 'shortest',
  })
  for (const level of ['', true, ['2'], {}, 0, 6, 2.5, 'NaN']) {
    expect(librarySearch({ q: {}, level, sort: 'DROP TABLE' })).toEqual({
      q: '',
      level: undefined,
      sort: 'newest',
    })
  }
  expect([...(librarySearch({ q: '🏋'.repeat(250) }).q ?? '')]).toHaveLength(200)
  expect(libraryFilters(librarySearch({ q: '  SQUAT  ', level: '2' }))).toEqual({
    q: 'squat',
    level: 2,
    sort: 'newest',
  })
})

test('library and detail links preserve validated filters while stripping defaults', async () => {
  const root = createRootRoute()
  const options = {
    getParentRoute: () => root,
    validateSearch: librarySearch,
  }
  const list = createRoute({
    ...options,
    path: '/workouts',
    search: { middlewares: [stripSearchParams(librarySearchDefaults)] },
  })
  const detail = createRoute({
    ...options,
    path: '/workouts/$workoutId',
    search: { middlewares: [stripSearchParams(librarySearchDefaults)] },
  })
  const history = createMemoryHistory({
    initialEntries: ['/workouts?q=squat&level=3&sort=shortest'],
  })
  const router = createRouter({ routeTree: root.addChildren([list, detail]), history })
  await router.load()
  const search = librarySearch(router.state.location.search)
  const detailLink = router.buildLocation({
    to: '/workouts/$workoutId',
    params: { workoutId: 'saved-plan' },
    search,
  })
  expect(detailLink.pathname).toBe('/workouts/saved-plan')
  expect(detailLink.search).toEqual(search)
  const backLink = router.buildLocation({
    to: '/workouts',
    search: librarySearch(detailLink.search),
  })
  expect(backLink.search).toEqual(search)
  const sorted = router.buildLocation({
    to: '/workouts',
    search: { q: 'squats', level: 3, sort: 'newest' },
  })
  expect(sorted.search).toEqual({ q: 'squats', level: 3 })
  const cleared = router.buildLocation({ to: '/workouts', search: { q: '', sort: 'newest' } })
  expect(cleared.searchStr).toBe('')
})
