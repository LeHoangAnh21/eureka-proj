export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'WAREHOUSE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}
