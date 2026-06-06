'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';
import type { UserRole } from '../../types/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const { user, isLoading, isInitialized, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) checkAuth();
  }, [isInitialized, checkAuth]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.replace('/login'); return; }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/');
    }
  }, [isInitialized, user, allowedRoles, router]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
