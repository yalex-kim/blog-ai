'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary } from '@/lib/ui';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Brief inline confirmation before redirecting — a toast would be
        // unmounted by the navigation before it could be read.
        setSuccess('비밀번호가 변경되었습니다. 설정 화면으로 이동합니다.');
        setTimeout(() => router.push('/settings'), 1200);
      } else {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-surface rounded-card shadow-card p-8">
          <h1 className="text-2xl font-bold mb-2">비밀번호 변경</h1>
          <p className="text-ink-soft mb-6">
            보안을 위해 비밀번호를 변경해주세요.
          </p>

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-ink mb-2">
                현재 비밀번호
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-ink mb-2">
                새 비밀번호
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                required
              />
              <p className="text-sm text-ink-faint mt-1">8자 이상</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-ink mb-2">
                새 비밀번호 확인
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!success}
              className={`${btnPrimary} w-full py-3`}
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
