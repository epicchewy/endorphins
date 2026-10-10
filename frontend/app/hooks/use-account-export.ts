import { useMutation } from '@tanstack/react-query'
import { exportAccount, type AccountExport } from '~/services/accounts'
import { queryKeys } from '~/services/query-keys'
import { useAccountSession } from './use-account'

export function useAccountExport() {
  const { sessionId, getToken, isCurrentSession } = useAccountSession()
  return useMutation({
    mutationKey: queryKeys.accountExport(sessionId),
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    mutationFn: async (accountId: string) => {
      const data = await exportAccount(getToken)
      // Account/session switches must never cause a late download from the previous account.
      if (!isCurrentSession()) return false
      if (data.user.id !== accountId) {
        throw new Error(
          'We couldn’t confirm this download belongs to your account. Please try again.',
        )
      }
      downloadAccount(data)
      // Keep only completion state in the mutation cache, never the exported personal data.
      return true
    },
  })
}

function downloadAccount(data: AccountExport) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }),
  )
  try {
    link.href = url
    link.download = `endorphins-data-${data.exportedAt.slice(0, 10)}.json`
    document.body.append(link)
    link.click()
  } finally {
    URL.revokeObjectURL(url)
    link.remove()
  }
}
