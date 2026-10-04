import { useAuth } from '~/auth/client'
import { useQueryClient } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { clearSessionCache } from '~/services/session-cache'

export function SessionBoundary() {
  const { sessionId } = useAuth()
  const client = useQueryClient()
  useEffect(() => () => clearSessionCache(client, sessionId), [client, sessionId])
  // A session change also discards component state and in-flight mutation callbacks.
  return <Outlet key={sessionId ?? 'signed-out'} />
}
