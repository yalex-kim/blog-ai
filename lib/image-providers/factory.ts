import { ImageGenerationProvider, ImageProvider } from './types';
import { OpenAIImageProvider } from './openai-provider';
import { GeminiImageProvider } from './gemini-provider';

/**
 * `apiKey` is the tenant's own key under BYOK. Both provider classes fall back
 * to their platform env var when it is undefined, which keeps deployments that
 * predate BYOK working unchanged.
 */
export function getImageProvider(provider: string, apiKey?: string): ImageGenerationProvider {
  switch (provider) {
    case ImageProvider.GEMINI:
      return new GeminiImageProvider(apiKey);
    case ImageProvider.OPENAI:
    default:
      return new OpenAIImageProvider(apiKey);
  }
}

/**
 * Resolves which image provider a request should use: an explicit per-request
 * override, then the tenant's stored preference, then the deployment default.
 * Anything unrecognised lands on OpenAI, matching the factory's own default.
 */
export function resolveImageProviderId(
  requested?: unknown,
  tenantPreference?: string | null
): ImageProvider {
  const candidate =
    (typeof requested === 'string' && requested) ||
    tenantPreference ||
    process.env.IMAGE_PROVIDER ||
    ImageProvider.OPENAI;

  return candidate === ImageProvider.GEMINI ? ImageProvider.GEMINI : ImageProvider.OPENAI;
}
