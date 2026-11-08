import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

// Loaded only by `vite dev`; see the lazy import in routes/__root.tsx.
export function Devtools() {
  return (
    <TanStackDevtools
      // The default floating trigger starts over the header logo.
      config={{ triggerMode: 'fixed', position: 'bottom-right' }}
      plugins={[
        { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
        { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
      ]}
    />
  )
}
