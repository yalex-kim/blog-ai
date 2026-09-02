'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ToastViewport, useToasts } from '@/components/Toast';
import { btnDanger, btnPrimary, btnSecondary } from '@/lib/ui';
import { getVertical } from '@/lib/verticals/registry';

interface Tenant {
  id: string;
  login_id: string;
  name: string | null;
  vertical: string | null;
  category: string;
  main_services: string | null;
  address: string | null;
  blog_platform: string | null;
  blog_id: string | null;
  is_initial_setup_complete: boolean;
  must_change_password: boolean;
  created_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  topic: string;
  created_at: string;
  posted_to_blog: boolean;
}

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setHospital] = useState<Tenant | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<Tenant>>({});
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  // Held in a dismissible panel rather than a toast: the admin has to read
  // and relay this password, so it must not disappear on a timer.
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  const { toasts, showToast, dismiss } = useToasts();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        // Check admin authentication
        const authResponse = await fetch('/api/admin/auth/session');
        if (!authResponse.ok) {
          router.replace('/admin/login');
          return;
        }

        // Fetch tenant data
        await fetchHospitalData();
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/admin/login');
      }
    };

    checkAuthAndFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchHospitalData = async () => {
    try {
      setLoading(true);

      // Fetch tenant details
      const tenantResponse = await fetch(`/api/admin/tenants/${tenantId}`);
      if (tenantResponse.ok) {
        const data = await tenantResponse.json();
        setHospital(data.tenant);
        setEditedData(data.tenant);
      } else {
        setError('계정 정보를 불러올 수 없습니다.');
      }

      // Fetch blog posts
      const postsResponse = await fetch(`/api/admin/tenants/${tenantId}/posts`);
      if (postsResponse.ok) {
        const data = await postsResponse.json();
        setBlogPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      });

      if (response.ok) {
        showToast('success', '저장되었습니다.');
        setIsEditing(false);
        fetchHospitalData();
      } else {
        showToast('error', '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving:', error);
      showToast('error', '저장 중 오류가 발생했습니다.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (response.ok) {
        setIssuedPassword(newPassword);
        setNewPassword('');
        setShowResetForm(false);
      } else {
        showToast('error', '비밀번호 재설정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      showToast('error', '비밀번호 재설정 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-ink-faint">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '계정을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/admin')}
            className={`${btnSecondary} px-4 py-2`}
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="text-ink-soft hover:text-ink"
              >
                ← 뒤로
              </button>
              <h1 className="text-2xl font-bold text-ink">
                계정 관리: {tenant.name || tenant.login_id}
              </h1>
            </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tenant Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-surface rounded-card shadow-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">기본 정보</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`${btnSecondary} px-4 py-2`}
                  >
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedData(tenant);
                      }}
                      className={`${btnSecondary} px-4 py-2`}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className={`${btnPrimary} px-4 py-2`}
                    >
                      저장
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="detail-tenant-id" className="block text-sm font-medium text-ink-soft mb-1">
                    로그인 ID
                  </label>
                  <input
                    id="detail-tenant-id"
                    type="text"
                    value={tenant.login_id}
                    disabled
                    className="w-full px-3 py-2 border border-line-strong rounded-lg bg-accent-tint"
                  />
                </div>

                <div>
                  <label htmlFor="detail-tenant-name" className="block text-sm font-medium text-ink-soft mb-1">
                    {getVertical(tenant.vertical).terminology.tenantNameLabel}
                  </label>
                  <input
                    id="detail-tenant-name"
                    type="text"
                    value={isEditing ? editedData.name || '' : tenant.name || '-'}
                    onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-line-strong rounded-lg disabled:bg-accent-tint"
                  />
                </div>

                <div>
                  <label htmlFor="detail-category" className="block text-sm font-medium text-ink-soft mb-1">
                    {getVertical(tenant.vertical).terminology.categoryLabel}
                  </label>
                  <input
                    id="detail-category"
                    type="text"
                    value={isEditing ? editedData.category || '' : tenant.category}
                    onChange={(e) => setEditedData({ ...editedData, category: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-line-strong rounded-lg disabled:bg-accent-tint"
                  />
                </div>

                <div>
                  <label htmlFor="detail-address" className="block text-sm font-medium text-ink-soft mb-1">
                    주소
                  </label>
                  <input
                    id="detail-address"
                    type="text"
                    value={isEditing ? editedData.address || '' : tenant.address || '-'}
                    onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-line-strong rounded-lg disabled:bg-accent-tint"
                  />
                </div>

                <div>
                  <label htmlFor="detail-services" className="block text-sm font-medium text-ink-soft mb-1">
                    주요 서비스
                  </label>
                  <textarea
                    id="detail-services"
                    value={isEditing ? editedData.main_services || '' : tenant.main_services || '-'}
                    onChange={(e) => setEditedData({ ...editedData, main_services: e.target.value })}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full px-3 py-2 border border-line-strong rounded-lg disabled:bg-accent-tint"
                  />
                </div>
              </div>
            </div>

            {/* Blog Posts */}
            <div className="bg-surface rounded-card shadow-card p-6">
              <h2 className="text-xl font-semibold mb-4">생성된 블로그 글 ({blogPosts.length}개)</h2>
              {blogPosts.length === 0 ? (
                <p className="text-ink-faint">아직 생성된 글이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {blogPosts.map((post) => (
                    <div
                      key={post.id}
                      className="p-4 border border-line rounded-lg hover:bg-paper"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-ink">{post.title}</h3>
                          <p className="text-sm text-ink-faint mt-1">{post.topic}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              post.posted_to_blog
                                ? 'bg-green-100 text-green-800'
                                : 'bg-accent-tint text-ink'
                            }`}
                          >
                            {post.posted_to_blog ? '게시됨' : '미게시'}
                          </span>
                          <p className="text-xs text-ink-faint mt-1">
                            {new Date(post.created_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Status & Actions */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-surface rounded-card shadow-card p-6">
              <h2 className="text-xl font-semibold mb-4">계정 상태</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-soft">초기 설정</span>
                  <span
                    className={`text-sm px-2 py-1 rounded-full ${
                      tenant.is_initial_setup_complete
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {tenant.is_initial_setup_complete ? '완료' : '미완료'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-soft">비밀번호 변경 필요</span>
                  <span
                    className={`text-sm px-2 py-1 rounded-full ${
                      tenant.must_change_password
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {tenant.must_change_password ? '필요' : '완료'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ink-soft">등록일</span>
                  <span className="text-sm text-ink">
                    {new Date(tenant.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-surface rounded-card shadow-card p-6">
              <h2 className="text-xl font-semibold mb-4">관리 작업</h2>

              {issuedPassword && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-800">비밀번호가 재설정되었습니다. 계정 담당자에게 전달해주세요.</p>
                  <p className="mt-2 rounded bg-surface px-3 py-2 font-mono text-sm break-all">
                    {issuedPassword}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIssuedPassword(null)}
                    className="mt-3 text-sm text-green-800 underline hover:text-green-900"
                  >
                    확인했습니다
                  </button>
                </div>
              )}

              {!showResetForm ? (
                <button
                  onClick={() => setShowResetForm(true)}
                  className={`${btnDanger} w-full px-4 py-2`}
                >
                  비밀번호 재설정
                </button>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label htmlFor="reset-password" className="block text-sm font-medium text-ink-soft mb-1">
                      새 임시 비밀번호
                    </label>
                    <input
                      id="reset-password"
                      type="text"
                      autoComplete="off"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="계정에 전달할 비밀번호"
                      className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetForm(false);
                        setNewPassword('');
                      }}
                      className={`${btnSecondary} flex-1 px-4 py-2`}
                    >
                      취소
                    </button>
                    <button type="submit" className={`${btnDanger} flex-1 px-4 py-2`}>
                      재설정
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Blog Settings */}
            {tenant.blog_platform && (
              <div className="bg-surface rounded-card shadow-card p-6">
                <h2 className="text-xl font-semibold mb-4">블로그 설정</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-ink-soft">플랫폼</span>
                    <p className="text-sm font-medium text-ink">{tenant.blog_platform}</p>
                  </div>
                  <div>
                    <span className="text-sm text-ink-soft">블로그 ID</span>
                    <p className="text-sm font-medium text-ink">{tenant.blog_id || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
