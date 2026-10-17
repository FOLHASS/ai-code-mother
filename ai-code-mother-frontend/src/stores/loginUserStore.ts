import { defineStore } from 'pinia'
import { UserApiClient } from '@/features/user-management/api'
import { isAuthenticationError } from '@/shared/api/errors.ts'
import { SessionState } from '@/shared/auth/SessionState.ts'

export const useLoginUserStore = defineStore('loginUser', () => {
  const api = new UserApiClient()
  const session = new SessionState(async () => {
    try {
      return (await api.getLogin()).data.data
    } catch (error) {
      if (isAuthenticationError(error)) return null
      throw error
    }
  })
  return {
    loginUser: session.loginUser,
    status: session.status,
    error: session.error,
    isInitialized: session.isInitialized,
    fetchLoginUser: session.fetchLoginUser,
    setLoginUser: session.setLoginUser,
    clearSession: session.clearSession,
  }
})
