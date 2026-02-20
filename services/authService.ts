import { buildApiUrl } from './apiConfig';

export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
}

export interface AuthResponse {
  ok: boolean;
  token: string;
  user: AuthUser;
  expiresAt?: string;
}

const parseAuthResponse = async (res: Response): Promise<AuthResponse> => {
  const raw = await res.text();
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as AuthResponse;
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> => {
  const res = await fetch(buildApiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  return parseAuthResponse(res);
};

export const loginUser = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const res = await fetch(buildApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return parseAuthResponse(res);
};

export const fetchMe = async (token: string): Promise<AuthResponse> => {
  const res = await fetch(buildApiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return parseAuthResponse(res);
};

export const logoutUser = async (token: string): Promise<void> => {
  const res = await fetch(buildApiUrl('/api/auth/logout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(raw || `Logout failed (${res.status})`);
  }
};
