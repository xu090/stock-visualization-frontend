export async function apiGet(url) {
  const response = await fetch(url)
  return parseResponse(response)
}

export async function apiPost(url, body = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return parseResponse(response)
}

export async function apiPatch(url, body = {}) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return parseResponse(response)
}

export async function apiDelete(url) {
  const response = await fetch(url, { method: 'DELETE' })
  return parseResponse(response)
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `HTTP ${response.status}`
    throw new Error(message)
  }
  return payload?.data ?? payload
}
