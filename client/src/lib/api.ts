const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${SERVER_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  // Check if response is CSV
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('text/csv')) {
    return res.text();
  }

  return res.json();
}

export const api = {
  // Auth
  devLogin: (name: string, email: string) =>
    fetchAPI('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    }),

  getMe: (token: string) =>
    fetchAPI('/auth/me', { token }),

  // Rooms
  createRoom: (token: string, settings?: Record<string, any>) =>
    fetchAPI('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(settings || {}),
      token,
    }),

  joinRoom: (token: string, code: string) =>
    fetchAPI('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
      token,
    }),

  getRoom: (token: string, code: string) =>
    fetchAPI(`/api/rooms/${code}`, { token }),

  assignTeams: (token: string, code: string) =>
    fetchAPI(`/api/rooms/${code}/assign-teams`, {
      method: 'POST',
      token,
    }),

  removeParticipant: (token: string, code: string, userId: string) =>
    fetchAPI(`/api/rooms/${code}/participants/${userId}`, {
      method: 'DELETE',
      token,
    }),

  // Player Selection
  getPlayers: (token: string) =>
    fetchAPI('/api/players', { token }),

  saveSelectedPlayers: (token: string, code: string, playerIds: string[]) =>
    fetchAPI(`/api/rooms/${code}/players`, {
      method: 'PUT',
      body: JSON.stringify({ playerIds }),
      token,
    }),

  getSelectedPlayers: (token: string, code: string) =>
    fetchAPI(`/api/rooms/${code}/players`, { token }),

  // Auction
  getAuctionState: (token: string, roomId: string) =>
    fetchAPI(`/api/auction/${roomId}/state`, { token }),

  getResults: (token: string, roomId: string) =>
    fetchAPI(`/api/auction/${roomId}/results`, { token }),

  exportCSV: (token: string, roomId: string) =>
    fetchAPI(`/api/auction/${roomId}/export`, { token }),
};
