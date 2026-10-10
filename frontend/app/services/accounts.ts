import type { components } from '~/types/api.gen'
import { request, type GetToken } from './http'

export type User = components['schemas']['User']

export function getCurrentUser(getToken: GetToken, signal?: AbortSignal): Promise<User> {
  return request('/api/v1/me', getToken, { signal })
}

export type AccountExport = components['schemas']['AccountExport']

export function exportAccount(getToken: GetToken, signal?: AbortSignal): Promise<AccountExport> {
  return request('/api/v1/me/export', getToken, { signal })
}

export type UpdateAccountInput = components['schemas']['UpdateAccountRequest']
export function updateAccount(input: UpdateAccountInput, getToken: GetToken): Promise<User> {
  return request('/api/v1/me', getToken, { method: 'PATCH', body: JSON.stringify(input) })
}
