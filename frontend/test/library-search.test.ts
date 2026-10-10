import { expect, test } from 'bun:test'
import { libraryFilters, librarySearch } from '../app/services/library-search'

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
