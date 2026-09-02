'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary } from '@/lib/ui';

export default function LoginPage() {
  const router = useRouter();
  const [tenantId, setHospitalId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          // User is already logged in, redirect to dashboard
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: tenantId, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if password change is required
        if (data.tenant.must_change_password) {
          router.replace('/change-password');
        } else if (!data.tenant.is_initial_setup_complete) {
          // Redirect to settings if setup not complete
          router.replace('/settings');
        } else {
          // Go to dashboard (replace to prevent back to login)
          router.replace('/dashboard');
        }
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-accent-tint to-surface flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-ink">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-tint to-surface flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-accent mb-2">Blog AI</h1>
          <p className="text-ink-soft">블로그 글·이미지 자동 생성</p>
        </div>

        <div className="bg-surface rounded-card shadow-card p-8">
          <h2 className="text-2xl font-semibold mb-6 text-ink">로그인</h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="tenant-id" className="block text-sm font-medium text-ink mb-2">
                로그인 ID
              </label>
              <input
                id="tenant-id"
                type="text"
                autoComplete="username"
                value={tenantId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-ink"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-ink"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${btnPrimary} w-full py-3`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
