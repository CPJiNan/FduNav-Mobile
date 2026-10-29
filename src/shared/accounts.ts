export type Theme = 'light' | 'dark' | 'auto';

export interface AccountState {
  username: string | null;
  status: 'signed-out' | 'signed-in' | 'unverified' | 'expired';
  lastLogin: string | null;
  message: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
