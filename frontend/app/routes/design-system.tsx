import { createFileRoute, notFound } from '@tanstack/react-router'
import { DesignSystem } from '~/components/design-system'

export const Route = createFileRoute('/design-system')({
  beforeLoad: () => {
    if (!import.meta.env.DEV && import.meta.env.MODE !== 'e2e') throw notFound()
  },
  component: DesignSystem,
})
