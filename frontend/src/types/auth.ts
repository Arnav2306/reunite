export type UserRole = 'student' | 'custodian' | 'admin' | 'superadmin';

export interface User {
  id: number;
  public_id: string;
  name: string;
  email: string;
  college_email?: string;
  personal_email?: string | null;
  mobile_number?: string | null;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  portal?: 'student' | 'admin';
}

export interface SignupCredentials {
  name: string;
  email?: string;
  password: string;
  password_confirm?: string;
  mobile_number?: string;
  personal_email?: string;
  role?: UserRole;
}
