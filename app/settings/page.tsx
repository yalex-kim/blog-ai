'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isValidDomainEntry } from '@/lib/trusted-domains';
import { getVertical } from '@/lib/verticals/registry';
import { btnPrimary, btnSecondary } from '@/lib/ui';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The vertical decides every label on this page, so it is read from the
  // tenant record rather than assumed.
  const [vertical, setVertical] = useState<string | null>(null);
  const pack = getVertical(vertical);
  const { terminology } = pack;

  const [tenantName, setTenantName] = useState('');
  const [category, setCategory] = useState('');
  const [mainServices, setMainServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState('');
  const [address, setAddress] = useState('');
  const [trustedDomains, setTrustedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [blogPlatform, setBlogPlatform] = useState('naver');
  const [blogId, setBlogId] = useState('');
  const [blogPassword, setBlogPassword] = useState('');
  const [blogBoardName, setBlogBoardName] = useState('');

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/tenant/settings');
      if (response.ok) {
        const data = await response.json();
        const h = data.tenant;
        const tenantPack = getVertical(h.vertical);
        setVertical(h.vertical ?? null);
        setTenantName(h.name || '');
        setCategory(h.category || tenantPack.terminology.defaultCategory);
        setMainServices(h.main_services || []);
        setAddress(h.address || '');
        setTrustedDomains(
          h.trusted_domains && h.trusted_domains.length > 0
            ? h.trusted_domains
            : tenantPack.trustedDomains
        );
        setBlogPlatform(h.blog_platform || 'naver');
        setBlogId(h.blog_id || '');
        setBlogBoardName(h.blog_board_name || '');

        // Check missing fields
        const missing = [];
        if (!h.name) missing.push(tenantPack.terminology.tenantNameLabel);
        if (!h.main_services || h.main_services.length === 0) {
          missing.push(tenantPack.terminology.servicesLabel);
        }
        if (!h.address) missing.push('주소');
        if (!h.blog_id) missing.push('블로그 ID');
        if (!h.blog_board_name) missing.push('게시판 이름');
        setMissingFields(missing);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addService = () => {
    if (serviceInput.trim() && !mainServices.includes(serviceInput.trim())) {
      setMainServices([...mainServices, serviceInput.trim()]);
      setServiceInput('');
    }
  };

  const removeService = (service: string) => {
    setMainServices(mainServices.filter(s => s !== service));
  };

  const addDomain = () => {
    const value = domainInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!value) return;
    if (!isValidDomainEntry(value)) {
      setDomainError('올바른 도메인 형식이 아닙니다. 예: health.kr');
      return;
    }
    if (!trustedDomains.includes(value)) {
      setTrustedDomains([...trustedDomains, value]);
    }
    setDomainInput('');
    setDomainError('');
  };

  const removeDomain = (domain: string) => {
    setTrustedDomains(trustedDomains.filter(d => d !== domain));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenantName,
          category,
          main_services: mainServices,
          address,
          trusted_domains: trustedDomains,
          blog_platform: blogPlatform,
          blog_id: blogId,
          blog_password_encrypted: blogPassword || undefined,
          blog_board_name: blogBoardName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('설정이 저장되었습니다.');
        if (data.tenant.is_initial_setup_complete) {
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          fetchSettings(); // Refresh to check missing fields
        }
      } else {
        setError(data.error || '설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface shadow">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-ink">{terminology.tenantNoun} 설정</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {missingFields.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-semibold text-yellow-800 mb-2">
              다음 항목을 입력해주세요:
            </p>
            <ul className="list-disc list-inside text-yellow-700">
              {missingFields.map(field => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}

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

        <form onSubmit={handleSave} className="bg-surface rounded-card shadow-card p-8 space-y-6">
          <div>
            <label htmlFor="tenant-name" className="block text-sm font-medium text-ink mb-2">
              {terminology.tenantNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              id="tenant-name"
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-ink mb-2">
              {terminology.categoryLabel}
            </label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={terminology.defaultCategory}
              className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="service-input" className="block text-sm font-medium text-ink mb-2">
              {terminology.servicesLabel} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
              id="service-input"
                type="text"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                placeholder={`예: ${terminology.serviceExamples[0] ?? ""}`}
                className="flex-1 px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={addService}
                className={`${btnSecondary} px-4 py-2`}
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {mainServices.map(service => (
                <span
                  key={service}
                  className="bg-accent-tint text-accent-strong px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="text-accent hover:text-accent-strong"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-ink mb-2">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울시 강남구 ..."
              className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div className="border-t pt-6">
            <label htmlFor="domain-input" className="block text-sm font-medium text-ink mb-2">
              참고자료 신뢰 도메인
            </label>
            <p className="text-sm text-ink-faint mb-2">
              블로그 글 작성 시 이 도메인들에서만 자료를 검색해 참고 링크로 표시합니다. 직접 추가/삭제할 수 있습니다.
            </p>
            <div className="flex gap-2 mb-1">
              <input
              id="domain-input"
                type="text"
                value={domainInput}
                onChange={(e) => { setDomainInput(e.target.value); setDomainError(''); }}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                placeholder="예: health.kr"
                className="flex-1 px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={addDomain}
                className={`${btnSecondary} px-4 py-2`}
              >
                추가
              </button>
            </div>
            {domainError && <p className="text-sm text-red-600 mb-2">{domainError}</p>}
            <div className="flex flex-wrap gap-2">
              {trustedDomains.map(domain => (
                <span
                  key={domain}
                  className="bg-accent-tint text-accent-strong px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {domain}
                  <button
                    type="button"
                    onClick={() => removeDomain(domain)}
                    className="text-accent hover:text-accent-strong"
                  >
                    ×
                  </button>
                </span>
              ))}
              {trustedDomains.length === 0 && (
                <p className="text-sm text-ink-faint">
                  등록된 도메인이 없으면 기본 신뢰 도메인 목록이 사용됩니다.
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">블로그 정보</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="blog-platform" className="block text-sm font-medium text-ink mb-2">
                  플랫폼
                </label>
                <select
              id="blog-platform"
                  value={blogPlatform}
                  onChange={(e) => setBlogPlatform(e.target.value)}
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                >
                  <option value="naver">네이버 블로그</option>
                </select>
              </div>

              <div>
                <label htmlFor="blog-id" className="block text-sm font-medium text-ink mb-2">
                  블로그 ID <span className="text-red-500">*</span>
                </label>
                <input
              id="blog-id"
                  type="text"
                  value={blogId}
                  onChange={(e) => setBlogId(e.target.value)}
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <label htmlFor="blog-password" className="block text-sm font-medium text-ink mb-2">
                  블로그 비밀번호 (저장/변경 시에만 입력)
                </label>
                <input
              id="blog-password"
              autoComplete="new-password"
                  type="password"
                  value={blogPassword}
                  onChange={(e) => setBlogPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label htmlFor="blog-board-name" className="block text-sm font-medium text-ink mb-2">
                  게시판 이름 <span className="text-red-500">*</span>
                </label>
                <input
              id="blog-board-name"
                  type="text"
                  value={blogBoardName}
                  onChange={(e) => setBlogBoardName(e.target.value)}
                  placeholder="예: 건강정보"
                  className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`${btnPrimary} w-full py-3`}
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </form>
      </main>
    </div>
  );
}
