/**
 * Image generation providers
 *
 * This module provides a polymorphic interface for different AI image generation services.
 * Easily switch between OpenAI, Gemini, or other providers by changing the IMAGE_PROVIDER
 * environment variable.
 *
 * Usage:
 * ```typescript
 * import { getImageProvider } from '@/lib/image-providers';
 *
 * const provider = getImageProvider();
 * const result = await provider.generateImage({
 *   prompt: 'A beautiful sunset over the ocean',
 *   size: '1024x1024'
 * });
 *
 * const imageBuffer = Buffer.from(result.imageData, 'base64');
 * ```
 *
 * Environment variables:
 * - IMAGE_PROVIDER: 'openai' or 'gemini' (default: 'openai')
 * - OPENAI_API_KEY: Required if using OpenAI
 * - GEMINI_API_KEY: Required if using Gemini
 */

export * from './types';
export * from './openai-provider';
export * from './gemini-provider';
export * from './factory';
