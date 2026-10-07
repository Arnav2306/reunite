import { api, setStoredToken, clearStoredToken } from './api';
import type { AuthResponse, LoginCredentials, SignupCredentials, User } from '../types/auth';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const data = await api.post<AuthResponse>('/api/auth/login/', credentials, {
      requiresAuth: false,
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    const data = await api.post<AuthResponse>('/api/auth/signup/', credentials, {
      requiresAuth: false,
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async getCurrentUser(): Promise<User> {
    return api.get<User>('/api/auth/me/', {
      requiresAuth: true,
    });
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout/', {}, { requiresAuth: true });
    } catch {
      // Even if backend logout fails or is offline, clear client token
    } finally {
      clearStoredToken();
    }
  },
};
