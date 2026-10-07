import { createFileRoute, redirect } from '@tanstack/react-router'
import { librarySearch } from '~/services/library-search'
export const Route = createFileRoute('/_authenticated/workouts/')({
  validateSearch: librarySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/app/workouts', search, replace: true })
  },
})
