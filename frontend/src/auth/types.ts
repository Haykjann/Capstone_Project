export type Role = 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export type QuizStatus = 'DRAFT' | 'PUBLISHED';

export interface Org {
  id: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ProfileResponse {
  user: User;
  org?: Org;
}
