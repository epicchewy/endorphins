import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { LocalDate } from '../app/components/ui/local-date'

test.each(['2026-10-09', '2026-10-09T00:30:00Z'])(
  'dates keep a stable server fallback for %s',
  (value) => {
    expect(renderToStaticMarkup(<LocalDate value={value} month="long" year="numeric" />)).toContain(
      '>2026-10-09<',
    )
  },
)
