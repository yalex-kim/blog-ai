import { GoogleGenAI } from '@google/genai';
import {
  ImageGenerationProvider,
  ImageGenerationConfig,
  ImageGenerationResult,
} from './types';

/**
 * Google Gemini image generation provider (Gemini 3 Pro Image - Nano Banana Pro)
 */
export class GeminiImageProvider implements ImageGenerationProvider {
  private client: GoogleGenAI;
  public readonly providerName = 'Google Gemini 3 Pro Image (Nano Banana Pro)';

  constructor(apiKey?: string) {
    this.client = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY,
    });
  }

  async generateImage(
    config: ImageGenerationConfig
  ): Promise<ImageGenerationResult> {
    const { prompt, size = '1024x1024', model = 'gemini-3-pro-image-preview' } = config;

    // Convert size to Gemini's imageConfig format
    // 1024x1024 → 1:1 aspect ratio, 1K resolution
    const imageConfig = {
      aspectRatio: '1:1' as const,
      imageSize: '1K' as const,
    };

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        imageConfig,
      },
    });

    // Extract image data from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error('No response from Gemini');
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return {
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }

    throw new Error('No image data received from Gemini');
  }
}
