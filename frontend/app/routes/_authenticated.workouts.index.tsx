import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authenticated/workouts/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/workouts', replace: true })
  },
})
