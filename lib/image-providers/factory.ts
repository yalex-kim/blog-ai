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
 * Resolves which image provider a request should use: the per-request choice
 * the dashboard sends, otherwise the deployment default. Anything unrecognised
 * lands on OpenAI, matching the factory's own default.
 *
 * There is deliberately no stored per-tenant preference. The dashboard picks a
 * provider next to the generate button and sends it on every call, so a saved
 * setting could never win — it would be a control that looks like it does
 * something and does nothing.
 */
export function resolveImageProviderId(requested?: unknown): ImageProvider {
  const candidate =
    (typeof requested === 'string' && requested) ||
    process.env.IMAGE_PROVIDER ||
    ImageProvider.OPENAI;

  return candidate === ImageProvider.GEMINI ? ImageProvider.GEMINI : ImageProvider.OPENAI;
}
