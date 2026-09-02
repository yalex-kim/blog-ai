import { ImageGenerationProvider, ImageProvider } from './types';
import { OpenAIImageProvider } from './openai-provider';
import { GeminiImageProvider } from './gemini-provider';

export function getImageProvider(provider: string): ImageGenerationProvider {
  switch (provider) {
    case ImageProvider.GEMINI:
      return new GeminiImageProvider();
    case ImageProvider.OPENAI:
    default:
      return new OpenAIImageProvider();
  }
}
