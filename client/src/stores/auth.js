import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('cac_token') || '')
  const user = ref((() => {
    try { return JSON.parse(localStorage.getItem('cac_user') || 'null') } catch { return null }
  })())

  const isLoggedIn = computed(() => !!token.value)
  const hasPerm = (perm) => user.value?.permisos?.includes(perm) ?? false

  function setAuth(newToken, newUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('cac_token', newToken)
    localStorage.setItem('cac_user', JSON.stringify(newUser))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('cac_token')
    localStorage.removeItem('cac_user')
  }

  return { token, user, isLoggedIn, hasPerm, setAuth, logout }
})
