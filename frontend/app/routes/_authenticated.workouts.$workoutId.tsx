import { createFileRoute, redirect } from '@tanstack/react-router'
import { librarySearch } from '~/services/library-search'
export const Route = createFileRoute('/_authenticated/workouts/$workoutId')({
  validateSearch: librarySearch,
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: '/app/workouts/$workoutId', params, search, replace: true })
  },
})
