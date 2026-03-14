/**
 * 🔒 Security Agent
 * Handles input validation, sanitization, rate limiting, and data privacy.
 */

const rateLimit = require('express-rate-limit');

class SecurityAgent {
  constructor() {
    this.name = 'SecurityAgent';
    this.maxImageSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    this.maxDimension = 4096;
  }

  /**
   * Creates Express rate limiter middleware
   */
  createRateLimiter() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 requests per minute
      message: { error: 'Too many scan requests. Please wait a moment.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Validates and sanitizes an incoming image
   * @param {string} imageData - Base64 encoded image
   * @returns {{ valid: boolean, sanitized?: Buffer, mimeType?: string, error?: string }}
   */
  async validateImage(imageData) {
    try {
      if (!imageData || typeof imageData !== 'string') {
        return { valid: false, error: 'No image data provided' };
      }

      // Extract mime type and base64 data
      const matches = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) {
        return { valid: false, error: 'Invalid image format. Expected base64 data URI.' };
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      // Validate mime type
      if (!this.allowedMimeTypes.includes(mimeType)) {
        return { valid: false, error: `Unsupported image type: ${mimeType}. Use JPEG, PNG, or WebP.` };
      }

      // Decode and check size
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > this.maxImageSize) {
        return { valid: false, error: `Image too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max 10MB.` };
      }

      if (buffer.length < 1000) {
        return { valid: false, error: 'Image too small or corrupted.' };
      }

      return { valid: true, sanitized: buffer, mimeType };
    } catch (err) {
      return { valid: false, error: `Image validation failed: ${err.message}` };
    }
  }

  /**
   * Sanitizes text output to prevent XSS
   */
  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Logs security events without exposing sensitive data
   */
  logEvent(event, details = {}) {
    console.log(`[Security] ${event}`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
}

module.exports = SecurityAgent;
