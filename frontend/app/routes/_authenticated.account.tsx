import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authenticated/account')({
  beforeLoad: () => {
    throw redirect({ to: '/app/account', replace: true })
  },
})
