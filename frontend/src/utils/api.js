export async function apiGet(url) {
  const response = await fetch(url, { headers: authHeaders() })
  return parseResponse(response)
}

export async function apiPost(url, body = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  })
  return parseResponse(response)
}

export async function apiPatch(url, body = {}) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  })
  return parseResponse(response)
}

export async function apiDelete(url) {
  const response = await fetch(url, { method: 'DELETE', headers: authHeaders() })
  return parseResponse(response)
}

function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload?.data ?? payload
}
