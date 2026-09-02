/**
 * Image generation provider types
 * Defines a common interface for different AI image generation services
 */

export interface ImageGenerationResult {
  /** Base64-encoded image data */
  imageData: string;
  /** MIME type (e.g., 'image/png') */
  mimeType?: string;
}

export interface ImageGenerationConfig {
  /** The prompt for image generation */
  prompt: string;
  /** Number of images to generate (default: 1) */
  numberOfImages?: number;
  /** Image size (e.g., "1024x1024") */
  size?: string;
  /** Optional model override */
  model?: string;
  /** Image quality: 'low' | 'medium' | 'high' (OpenAI gpt-image-2 only) */
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Common interface for all image generation providers
 */
export interface ImageGenerationProvider {
  /**
   * Generate an image from a text prompt
   * @param config - Image generation configuration
   * @returns Promise with base64-encoded image data
   */
  generateImage(config: ImageGenerationConfig): Promise<ImageGenerationResult>;

  /**
   * Get the provider name
   */
  readonly providerName: string;
}

/**
 * Supported image generation providers
 */
export enum ImageProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
}
