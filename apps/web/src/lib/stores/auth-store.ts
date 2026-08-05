import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import type { UserRole } from '@german-job-engine/shared-types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface DecodedAccessToken {
  sub: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
  hydrate: () => void;
}

const REFRESH_TOKEN_STORAGE_KEY = 'gje.refreshToken';
// Non-httpOnly, UX-redirect-only marker for middleware's coarse route guard — never treated as a
// security boundary (docs/frontend-architecture/09-navigation-architecture.md). Real authorization
// is always the Bearer access token sent on every API call (lib/api-client.ts).
const SESSION_COOKIE_NAME = 'gje_session';

function decodeUser(accessToken: string): AuthUser | null {
  try {
    const decoded = jwtDecode<DecodedAccessToken>(accessToken);
    return { id: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

function setSessionCookie(present: boolean) {
  if (typeof document === 'undefined') return;
  // `Secure` when served over HTTPS (Milestone 22.3 audit fix — previously always omitted, so
  // in production this non-sensitive marker would still have been sent over a downgraded HTTP
  // connection if one ever occurred). Omitted on plain HTTP (local dev) because browsers reject
  // a `Secure` cookie set from a non-HTTPS origin outright.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : '';
  if (present) {
    document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`;
  } else {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0${secure}`;
  }
}

/**
 * Authentication State (docs/frontend-architecture/07-state-management-strategy.md) — access
 * token held in memory only, refresh token in localStorage as the documented interim choice
 * (docs/frontend-architecture/12-architecture-decision-records.md ADR-003), pending the backend
 * adding httpOnly-cookie refresh issuance (docs/frontend-architecture/13-risks-and-open-questions.md
 * OQ-10). This file is the single owner of both.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  setTokens: ({ accessToken, refreshToken }) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }
    setSessionCookie(true);
    set({ accessToken, refreshToken, user: decodeUser(accessToken) });
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
    setSessionCookie(false);
    set({ accessToken: null, refreshToken: null, user: null });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const storedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    set({ refreshToken: storedRefreshToken, hydrated: true });
    // Deliberately does not restore accessToken from storage (never persisted, per ADR-003) —
    // a real refresh call (lib/api-client.ts's 401 handling, or an explicit boot-time refresh)
    // is what re-establishes it. Until that happens, `user` stays null and any authenticated
    // fetch will correctly 401-and-refresh on first use.
  },
}));
