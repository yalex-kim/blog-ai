'use client';

import { useEffect, useState } from 'react';
import { btnPrimary, btnSecondary } from '@/lib/ui';

interface KeyStatus {
  provider: 'anthropic' | 'openai' | 'gemini';
  label: string;
  configured: boolean;
  hint: string | null;
}

const PROVIDER_HELP: Record<KeyStatus['provider'], { where: string; url: string }> = {
  anthropic: { where: 'Claude Console → API Keys', url: 'https://console.anthropic.com/settings/keys' },
  openai: { where: 'OpenAI Platform → API Keys', url: 'https://platform.openai.com/api-keys' },
  gemini: { where: 'Google AI Studio → API Keys', url: 'https://aistudio.google.com/apikey' },
};

/**
 * Keys save on their own, separately from the profile form. Two reasons: a key
 * is never rendered back into its input (it is write-only), so it cannot ride
 * along on a form submit the way a text field does; and re-saving the profile
 * must not touch a stored key — the API treats an omitted field as "leave it"
 * and an empty string as "delete it", and this component is what makes that
 * distinction visible.
 *
 * `position` lets the settings page mount this in both slots and let the
 * component decide which one renders: a tenant with no key has nothing else to
 * do on that page, so the card goes first; once every key is stored it drops
 * below the profile form, where a rarely-touched setting belongs. Only one slot
 * ever renders, so there is never a duplicate.
 */
export default function ApiKeySettings({
  position = 'bottom',
}: {
  position?: 'top' | 'bottom';
}) {
  const [statuses, setStatuses] = useState<KeyStatus[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const response = await fetch('/api/tenant/settings');
      if (!response.ok) return;
      const data = await response.json();
      setStatuses(data.apiKeys ?? []);
    } catch (err) {
      console.error('Error loading API key settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (payload: Record<string, unknown>, message: string) => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        setStatuses(data.apiKeys ?? []);
        setDrafts({});
        setSuccess(message);
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Error saving API keys:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveKeys = () => {
    const payload: Record<string, unknown> = {};
    for (const [provider, value] of Object.entries(drafts)) {
      if (value.trim()) payload[`${provider}_api_key`] = value.trim();
    }
    if (Object.keys(payload).length === 0) {
      setError('입력된 키가 없습니다.');
      return;
    }
    save(payload, 'API 키가 저장되었습니다.');
  };

  // An empty string is the API's explicit "remove this key" signal.
  const removeKey = (provider: string) =>
    save({ [`${provider}_api_key`]: '' }, 'API 키가 삭제되었습니다.');

  if (loading) return null;

  const anyMissing = statuses.some((status) => !status.configured);
  if (position === 'top' ? !anyMissing : anyMissing) return null;

  return (
    <section
      className={`bg-surface rounded-card shadow-card p-8 ${
        position === 'top' ? 'mb-6 ring-1 ring-accent/30' : 'mt-8'
      }`}
    >
      <h2 className="text-xl font-bold text-ink mb-1">API 키</h2>
      <p className="text-sm text-ink-soft mb-6">
        글과 이미지 생성에는 본인이 발급받은 API 키가 필요합니다. 키를 등록해야
        생성 기능을 사용할 수 있고, 요금은 등록한 키로 직접 청구됩니다. 키는
        암호화되어 저장되며, 저장 후에는 마지막 4자리만 확인할 수 있습니다.
      </p>

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

      <div className="space-y-6">
        {statuses.map((status) => {
          const help = PROVIDER_HELP[status.provider];
          return (
            <div key={status.provider}>
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <label
                  htmlFor={`key-${status.provider}`}
                  className="block text-sm font-medium text-ink"
                >
                  {status.label}
                </label>

                {status.configured ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                    등록됨 · {status.hint}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    미등록 · 생성 불가
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  id={`key-${status.provider}`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={drafts[status.provider] ?? ''}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [status.provider]: e.target.value })
                  }
                  placeholder={status.configured ? '새 키를 입력하면 교체됩니다' : '키를 붙여넣으세요'}
                  className="flex-1 min-w-0 px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent font-mono text-sm"
                />
                {status.configured && (
                  <button
                    type="button"
                    onClick={() => removeKey(status.provider)}
                    disabled={saving}
                    className={`${btnSecondary} px-4 py-2 text-sm whitespace-nowrap`}
                  >
                    삭제
                  </button>
                )}
              </div>

              <p className="mt-1 text-xs text-ink-faint">
                발급:{' '}
                <a
                  href={help.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-accent"
                >
                  {help.where}
                </a>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={saveKeys}
          disabled={saving}
          className={`${btnPrimary} px-6 py-2`}
        >
          {saving ? '저장 중...' : 'API 키 저장'}
        </button>
      </div>
    </section>
  );
}
