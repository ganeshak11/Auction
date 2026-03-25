'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  }, [searchParams, setToken, router]);

  return (
    <div className="text-center">
      <div className="spinner mx-auto mb-4" />
      <p className="text-text-muted">Completing sign in...</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <Suspense fallback={<div className="spinner" />}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
