export type LibrarySearch = {
  q?: string
  level?: number
  sort?: 'newest' | 'shortest'
}

export const librarySearchDefaults = { q: '', sort: 'newest' } as const

export function librarySearch(search: Record<string, unknown>): LibrarySearch {
  const level = typeof search.level === 'string' ? Number(search.level) : search.level
  return {
    q: typeof search.q === 'string' ? [...search.q].slice(0, 200).join('') : '',
    level:
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 5
        ? level
        : undefined,
    sort: search.sort === 'shortest' ? 'shortest' : 'newest',
  }
}

// Input text remains readable in the URL; equivalent queries share a cache entry.
export function libraryFilters(search: LibrarySearch) {
  const valid = librarySearch(search)
  return {
    q: (valid.q ?? '').trim().toLowerCase(),
    level: valid.level,
    sort: valid.sort ?? 'newest',
  }
}

export type LibraryFilters = ReturnType<typeof libraryFilters>

export function libraryFilterParams(filters: LibraryFilters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.level !== undefined) params.set('level', String(filters.level))
  return params
}
