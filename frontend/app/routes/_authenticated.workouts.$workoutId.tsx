import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authenticated/workouts/$workoutId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/app/workouts/$workoutId', params, replace: true })
  },
})
