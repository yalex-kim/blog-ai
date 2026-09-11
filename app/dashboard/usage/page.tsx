'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { btnGhost } from '@/lib/ui';
import { formatUsd } from '@/lib/pricing';

interface UsageResponse {
  days: number;
  truncated: boolean;
  summary: {
    totalUsd: number;
    tenantKeyUsd: number;
    platformKeyUsd: number;
    unpricedEvents: number;
    events: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
    webSearchRequests: number;
    imageCount: number;
  };
  byDay: { date: string; usd: number; events: number }[];
  byModel: {
    provider: string;
    model: string;
    kind: string;
    imageQuality: string | null;
    events: number;
    inputTokens: number;
    outputTokens: number;
    imageCount: number;
    usd: number;
    unpricedEvents: number;
  }[];
  recent: {
    kind: string;
    provider: string;
    model: string;
    keySource: string;
    inputTokens: number;
    outputTokens: number;
    webSearchRequests: number;
    imageCount: number;
    costUsd: number | null;
    createdAt: string;
  }[];
}

const KIND_LABELS: Record<string, string> = {
  blog_generation: '블로그 글 생성',
  topic_recommendation: '주제 추천',
  image_generation: '이미지 생성',
};

const RANGES = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
];

const numberFormat = new Intl.NumberFormat('ko-KR');

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-ink-faint">{detail}</p>}
    </div>
  );
}

export default function UsagePage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setErrorDetail('');
      try {
        const response = await fetch(`/api/usage?days=${days}`);
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        const body = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setData(body);
        } else {
          setError(body.error || '사용량을 불러오지 못했습니다.');
          setErrorDetail(body.detail || '');
        }
      } catch (err) {
        console.error('Error loading usage:', err);
        if (!cancelled) setError('서버 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [days, router]);

  // The bar chart is scaled to the busiest day rather than to the total, so a
  // quiet month still shows shape instead of a flat line.
  const peakDay = data ? Math.max(...data.byDay.map((d) => d.usd), 0) : 0;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface shadow">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-ink">사용량 및 요금</h1>
            <p className="text-sm text-ink-soft mt-1">
              내 API 키로 발생한 사용량입니다.
            </p>
          </div>
          <Link href="/dashboard" className={`${btnGhost} px-4 py-2 text-sm`}>
            ← 대시보드
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                days === range.days
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-ink-soft border-line-strong hover:bg-accent-tint'
              }`}
            >
              최근 {range.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
            {errorDetail && (
              <p className="mt-2 text-xs font-mono text-red-600 break-all">{errorDetail}</p>
            )}
          </div>
        )}

        {loading && <p className="text-ink-soft">불러오는 중...</p>}

        {!loading && data && data.summary.events === 0 && !error && (
          <div className="bg-surface rounded-card shadow-card p-8 text-center">
            <p className="text-ink-soft">
              최근 {data.days}일 동안 기록된 사용량이 없습니다.
            </p>
            <p className="text-sm text-ink-faint mt-2">
              글이나 이미지를 생성하면 여기에 요금이 집계됩니다.
            </p>
          </div>
        )}

        {!loading && data && data.summary.events > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <StatCard
                label={`최근 ${data.days}일 총액`}
                value={formatUsd(data.summary.totalUsd)}
                detail={`${numberFormat.format(data.summary.events)}건`}
              />
              <StatCard
                label="내 키로 청구"
                value={formatUsd(data.summary.tenantKeyUsd)}
                detail={
                  data.summary.platformKeyUsd > 0
                    ? `공용 키 ${formatUsd(data.summary.platformKeyUsd)} 별도`
                    : undefined
                }
              />
              <StatCard
                label="토큰"
                value={numberFormat.format(
                  data.summary.inputTokens + data.summary.outputTokens
                )}
                detail={`입력 ${numberFormat.format(
                  data.summary.inputTokens
                )} · 출력 ${numberFormat.format(data.summary.outputTokens)}`}
              />
              <StatCard
                label="웹 검색 · 이미지"
                value={`${numberFormat.format(
                  data.summary.webSearchRequests
                )} · ${numberFormat.format(data.summary.imageCount)}`}
                detail="검색 $10/1,000건"
              />
            </div>

            {data.summary.unpricedEvents > 0 && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
                {numberFormat.format(data.summary.unpricedEvents)}건은 단가 정보가 없어
                금액에 포함되지 않았습니다. 알 수 없는 모델로 생성된 기록입니다 —
                해당 모델의 단가를 <code>lib/pricing.ts</code>에 추가하면 다시 집계됩니다.
              </div>
            )}

            {data.truncated && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
                기록이 많아 최근 일부만 집계했습니다. 기간을 좁혀서 조회해주세요.
              </div>
            )}

            <section className="bg-surface rounded-card shadow-card p-6 mb-6">
              <h2 className="text-lg font-bold text-ink mb-4">일별 사용 금액</h2>
              <div className="flex items-end gap-1 h-40">
                {data.byDay.map((day) => (
                  <div
                    key={day.date}
                    className="flex-1 min-w-0 group relative flex flex-col justify-end h-full"
                    title={`${day.date} · ${formatUsd(day.usd)} · ${day.events}건`}
                  >
                    <div
                      className="w-full bg-accent rounded-t hover:bg-accent-strong transition-colors"
                      style={{
                        height: peakDay > 0 ? `${Math.max((day.usd / peakDay) * 100, 2)}%` : '2%',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-ink-faint">
                <span>{data.byDay[0]?.date}</span>
                <span>{data.byDay[data.byDay.length - 1]?.date}</span>
              </div>
            </section>

            <section className="bg-surface rounded-card shadow-card p-6 mb-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-ink mb-4">모델별 내역</h2>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-ink-soft border-b border-line">
                    <th className="pb-2 font-medium">작업</th>
                    <th className="pb-2 font-medium">모델</th>
                    <th className="pb-2 font-medium text-right">횟수</th>
                    <th className="pb-2 font-medium text-right">입력</th>
                    <th className="pb-2 font-medium text-right">출력</th>
                    <th className="pb-2 font-medium text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byModel.map((row) => (
                    <tr
                      key={`${row.provider}-${row.model}-${row.kind}-${row.imageQuality ?? ''}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 text-ink">{KIND_LABELS[row.kind] ?? row.kind}</td>
                      <td className="py-2 text-ink-soft font-mono text-xs">
                        {row.model}
                        {row.imageQuality && (
                          <span className="ml-1 text-ink-faint">({row.imageQuality})</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink">
                        {numberFormat.format(row.events)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink-soft">
                        {numberFormat.format(row.inputTokens)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink-soft">
                        {numberFormat.format(row.outputTokens)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink font-medium">
                        {row.unpricedEvents === row.events ? '—' : formatUsd(row.usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-surface rounded-card shadow-card p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-ink mb-4">최근 기록</h2>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-ink-soft border-b border-line">
                    <th className="pb-2 font-medium">시각</th>
                    <th className="pb-2 font-medium">작업</th>
                    <th className="pb-2 font-medium">키</th>
                    <th className="pb-2 font-medium text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((row, index) => (
                    <tr
                      key={`${row.createdAt}-${index}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 text-ink-soft">
                        {new Date(row.createdAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2 text-ink">{KIND_LABELS[row.kind] ?? row.kind}</td>
                      <td className="py-2 text-ink-soft">
                        {row.keySource === 'tenant' ? '내 키' : '공용 키'}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink">
                        {row.costUsd === null ? '—' : formatUsd(row.costUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <p className="mt-6 text-xs text-ink-faint">
              금액은 공개 단가 기준 추정치입니다. 실제 청구 금액은 각 제공자의
              콘솔을 확인해주세요. 토큰·요청 수는 제공자가 보고한 실제 값입니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
