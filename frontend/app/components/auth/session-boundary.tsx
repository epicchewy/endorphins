import { useAuth } from '~/auth/client'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { Component } from 'react'
import { clearSessionCache } from '~/services/session-cache'

export function SessionBoundary() {
  const { sessionId } = useAuth()
  const client = useQueryClient()
  // A session change also discards component state and in-flight mutation callbacks.
  return <SessionScope key={sessionId ?? 'signed-out'} client={client} sessionId={sessionId} />
}

class SessionScope extends Component<{
  client: QueryClient
  sessionId: string | null | undefined
}> {
  componentWillUnmount() {
    clearSessionCache(this.props.client, this.props.sessionId)
  }

  render() {
    return <Outlet />
  }
}
