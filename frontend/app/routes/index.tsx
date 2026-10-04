import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { WorkoutPage } from '~/pages/workout-page'
import { workoutSearch } from '~/services/workout-preferences'
export const Route = createFileRoute('/')({
  validateSearch: workoutSearch,
  search: { middlewares: [stripSearchParams({ minutes: 45, level: 2 })] },
  component: WorkoutPage,
})
