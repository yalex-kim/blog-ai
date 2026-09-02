import OpenAI from 'openai';
import {
  ImageGenerationProvider,
  ImageGenerationConfig,
  ImageGenerationResult,
} from './types';

export class OpenAIImageProvider implements ImageGenerationProvider {
  private client: OpenAI;
  public readonly providerName = 'OpenAI GPT-Image-2';

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async generateImage(
    config: ImageGenerationConfig
  ): Promise<ImageGenerationResult> {
    const { prompt, size = '1024x1024', quality = 'low' } = config;

    const response = await this.client.images.generate({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: size as '1024x1024' | '1024x1536' | '1536x1024',
      quality,
    });

    // SDK v6 returns Stream | ImagesResponse union — narrow to the non-streaming case
    const b64Image = 'data' in response ? response.data?.[0]?.b64_json : null;
    if (!b64Image) {
      throw new Error('No image data received from OpenAI');
    }

    return {
      imageData: b64Image,
      mimeType: 'image/png',
    };
  }
}
