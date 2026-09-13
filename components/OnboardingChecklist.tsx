'use client';

import { btnPrimary } from '@/lib/ui';

export interface OnboardingStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** Where this step is completed. Omitted for the last step, which happens
   *  right here on the dashboard. */
  href?: string;
}

/**
 * The path from a new account to a first article is four steps across three
 * screens, and each one used to just hand off to the next with no sense of how
 * far along you were. This is the map.
 *
 * It disappears the moment every step is done — permanent scaffolding on a
 * screen you use daily is clutter, and a tenant who has written ten posts does
 * not need to be told they changed their password once.
 */
export function OnboardingChecklist({
  steps,
  onNavigate,
}: {
  steps: OnboardingStep[];
  onNavigate: (href: string) => void;
}) {
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  // The first unfinished step is the one to act on; later ones stay visible
  // for context but are not the call to action.
  const next = steps.find((step) => !step.done);

  return (
    <section
      aria-labelledby="onboarding-title"
      className="mb-6 bg-surface rounded-card shadow-card p-6"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 id="onboarding-title" className="text-lg font-semibold text-ink">
          시작하기
        </h2>
        <span className="text-sm text-ink-soft tabular-nums">
          {doneCount}/{steps.length} 완료
        </span>
      </div>

      <div
        className="h-1.5 rounded-full bg-line overflow-hidden mb-5"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="설정 진행률"
      >
        <div
          className="h-full bg-accent rounded-full transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-3">
        {steps.map((step) => {
          const isNext = step.id === next?.id;
          return (
            <li key={step.id} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-accent text-white'
                    : isNext
                      ? 'border-2 border-accent text-accent'
                      : 'border border-line-strong text-ink-faint'
                }`}
              >
                {step.done ? '✓' : ''}
              </span>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.done ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                >
                  {step.label}
                  <span className="sr-only">{step.done ? ' (완료)' : ''}</span>
                </p>
                {!step.done && isNext && (
                  <p className="text-sm text-ink-soft mt-0.5">{step.hint}</p>
                )}
              </div>

              {isNext && step.href && (
                <button
                  type="button"
                  onClick={() => onNavigate(step.href!)}
                  className={`${btnPrimary} shrink-0 px-4 py-1.5 text-sm`}
                >
                  이동
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
