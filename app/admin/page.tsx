'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { getVertical, listVerticals, DEFAULT_VERTICAL_ID } from '@/lib/verticals/registry';

interface Tenant {
  id: string;
  login_id: string;
  name: string | null;
  vertical: string | null;
  category: string;
  is_initial_setup_complete: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  // Picking the vertical is the one decision an admin cannot defer: it decides
  // the writing rules, the image style, and every label the tenant will see.
  const [vertical, setVertical] = useState(DEFAULT_VERTICAL_ID);
  const [category, setCategory] = useState(getVertical(DEFAULT_VERTICAL_ID).terminology.defaultCategory);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await fetch('/api/admin/auth/session');
        if (!response.ok) {
          // Not authenticated, redirect to admin login
          router.replace('/admin/login');
          return;
        }
        // Authenticated, fetch tenants
        await fetchTenants();
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/admin/login');
      } finally {
        setChecking(false);
      }
    };

    checkAuthentication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!tenantId || !initialPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_id: tenantId,
          initial_password: initialPassword,
          vertical,
          category,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`계정이 생성되었습니다! (ID: ${tenantId})`);
        setTenantId('');
        setInitialPassword('');
        setVertical(DEFAULT_VERTICAL_ID);
        setCategory(getVertical(DEFAULT_VERTICAL_ID).terminology.defaultCategory);
        setShowForm(false);
        fetchTenants();
      } else {
        setError(data.error || '계정 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  // Show loading while checking authentication
  if (checking) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-ink-faint">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-ink">
              관리자 - 계정 관리
            </h1>
            <button
              onClick={handleLogout}
              className={`${btnSecondary} px-4 py-2`}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Create Tenant Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${showForm ? btnSecondary : btnPrimary} px-6 py-3`}
          >
            {showForm ? '취소' : '+ 새 계정 등록'}
          </button>
        </div>

        {/* Create Tenant Form */}
        {showForm && (
          <div className="bg-surface rounded-card shadow-card p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">새 계정 생성</h2>
            <form onSubmit={handleCreateHospital} className="space-y-4">
              <div>
                <label htmlFor="new-tenant-id" className="block text-sm font-medium text-ink mb-2">
                  로그인 ID
                </label>
                <input
                  id="new-tenant-id"
                  autoComplete="off"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="예: seoul-womens-tenant"
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label htmlFor="new-tenant-password" className="block text-sm font-medium text-ink mb-2">
                  초기 비밀번호
                </label>
                <input
                  id="new-tenant-password"
                  autoComplete="new-password"
                  type="password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="계정에 전달할 초기 비밀번호"
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                />
                <p className="text-sm text-ink-faint mt-1">
                  * 첫 로그인 후 비밀번호를 변경할 수 있습니다.
                </p>
              </div>

              <div>
                <label htmlFor="new-tenant-vertical" className="block text-sm font-medium text-ink mb-2">
                  업종
                </label>
                <select
                  id="new-tenant-vertical"
                  value={vertical}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVertical(next);
                    setCategory(getVertical(next).terminology.defaultCategory);
                  }}
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                >
                  {listVerticals().map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-faint mt-1">
                  {getVertical(vertical).description}
                </p>
              </div>

              <div>
                <label htmlFor="new-tenant-category" className="block text-sm font-medium text-ink mb-2">
                  {getVertical(vertical).terminology.categoryLabel}
                </label>
                <input
                  id="new-tenant-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={getVertical(vertical).terminology.defaultCategory}
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>

              <button
                type="submit"
                className={`${btnPrimary} w-full py-3`}
              >
                계정 생성
              </button>
            </form>
          </div>
        )}

        {/* Tenants List */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-xl font-semibold">등록된 계정 목록</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-ink-faint">로딩 중...</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-ink-faint">
              등록된 계정이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-paper">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-faint uppercase">
                      로그인 ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-faint uppercase">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-faint uppercase">
                      업종
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-faint uppercase">
                      초기 설정
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-faint uppercase">
                      등록일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                      className="cursor-pointer hover:bg-accent-tint transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink">
                        {tenant.login_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                        {tenant.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                        {getVertical(tenant.vertical).label}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            tenant.is_initial_setup_complete
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {tenant.is_initial_setup_complete ? '완료' : '미완료'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                        {new Date(tenant.created_at).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
