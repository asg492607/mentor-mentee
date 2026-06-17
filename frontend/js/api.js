import { getIdToken } from './auth.js';
import { API_BASE_URL } from './config.js';
import { navigateTo } from './router.js';

async function fetchWithAuth(path, options = {}) {
  const token = await getIdToken();
  
  const headers = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    navigateTo('/login');
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMessage = 'API Error';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // ignore parsing error
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export const api = {
  get: (path) => fetchWithAuth(path, { method: 'GET' }),
  post: (path, body) => fetchWithAuth(path, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) 
  }),
  put: (path, body) => fetchWithAuth(path, { 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) 
  }),
  delete: (path) => fetchWithAuth(path, { method: 'DELETE' })
};
