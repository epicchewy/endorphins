import { useClerk, useSession } from '~/auth/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentUser, updateAccount, type UpdateAccountInput } from '~/services/accounts'
import { APIError } from '~/services/http'
import { queryKeys } from '~/services/query-keys'

export function useAccountSession() {
  const { session } = useSession()
  const clerk = useClerk()
  // Capture this resource: a pending request must never obtain another account's token.
  const getToken = async () => (session ? session.getToken() : null)
  const isCurrentSession = () => Boolean(session && clerk.session?.id === session.id)
  return { userId: session?.user.id, sessionId: session?.id, getToken, isCurrentSession }
}

export function retryAccountQuery(count: number, error: Error) {
  return !(error instanceof APIError && error.status >= 400 && error.status < 500) && count < 1
}

export function useAccount() {
  const { userId, sessionId, getToken } = useAccountSession()
  return useQuery({
    queryKey: queryKeys.profile(sessionId),
    queryFn: ({ signal }) => getCurrentUser(getToken, signal),
    enabled: Boolean(userId),
    retry: retryAccountQuery,
    staleTime: 60_000,
  })
}

export function useUpdateAccount() {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  const client = useQueryClient()
  return useMutation({
    mutationKey: queryKeys.updateAccount(sessionId),
    mutationFn: (input: UpdateAccountInput) => updateAccount(input, getToken),
    retry: false,
    networkMode: 'always',
    onSuccess: (user) => {
      if (isCurrentSession()) client.setQueryData(queryKeys.profile(sessionId), user)
    },
  })
}
