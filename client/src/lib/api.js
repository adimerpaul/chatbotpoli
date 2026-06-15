let _router = null
export function initApi(router) { _router = router }

export function apiFetch(url, options = {}) {
  const token = localStorage.getItem('cac_token')
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  return fetch(url, { ...options, headers }).then((r) => {
    if (r.status === 401) {
      localStorage.removeItem('cac_token')
      localStorage.removeItem('cac_user')
      if (_router) {
        _router.replace('/login')
      } else {
        window.location.replace('/login')
      }
      return new Promise(() => {})
    }
    return r
  })
}
