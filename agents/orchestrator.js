/**
 * ⚙️ Orchestrator
 * Coordinates all agents in the scan pipeline.
 * Handles errors, timeouts, and partial results.
 */

const CameraAgent = require('./cameraAgent');
const DetailedVisionAgent = require('./detailedVisionAgent');
const VerificationAgent = require('./verificationAgent');
const NutritionAgent = require('./nutritionAgent');
const HealthAgent = require('./healthAgent');
const OverlayAgent = require('./overlayAgent');
const UIAgent = require('./uiAgent');
const SecurityAgent = require('./securityAgent');

class Orchestrator {
  constructor(config = {}) {
    this.security = new SecurityAgent();
    this.camera = new CameraAgent();
    this.vision = new DetailedVisionAgent(config.geminiApiKey);
    this.verification = new VerificationAgent();
    this.nutrition = new NutritionAgent(config.usdaApiKey);
    this.health = new HealthAgent();
    this.overlay = new OverlayAgent();
    this.ui = new UIAgent();
  }

  /**
   * Run the full scan pipeline
   * @param {string} imageData - Base64 data URI from the camera
   * @param {function} onProgress - Progress callback (stage, message)
   * @returns {object} Complete scan result
   */
  async scan(imageData, onProgress = () => {}) {
    const startTime = Date.now();
    const result = {
      success: false,
      stages: {},
      timing: {},
      error: null,
    };

    try {
      // Stage 1: Security validation
      onProgress('security', 'Validating image...');
      let stageStart = Date.now();

      const validation = await this.security.validateImage(imageData);
      if (!validation.valid) {
        return { ...result, error: validation.error, stages: { security: 'failed' } };
      }

      result.stages.security = 'passed';
      result.timing.security = Date.now() - stageStart;
      this.security.logEvent('image_validated', {
        size: validation.sanitized.length,
      });

      // Stage 2: Camera preprocessing
      onProgress('camera', 'Processing image...');
      stageStart = Date.now();

      const processed = await this.camera.process(validation.sanitized);
      if (!processed.success) {
        return { ...result, error: processed.error, stages: { ...result.stages, camera: 'failed' } };
      }

      result.stages.camera = 'done';
      result.timing.camera = Date.now() - stageStart;
      result.imageMetadata = processed.metadata;

      // Stage 3: Vision analysis
      onProgress('vision', 'Identifying products...');
      stageStart = Date.now();

      const vision = await this.vision.analyzeDetail(processed.image, processed.mimeType);
      if (!vision.success) {
        return { ...result, error: vision.error, stages: { ...result.stages, vision: 'failed' } };
      }

      if (vision.products.length === 0) {
        return {
          ...result,
          success: true,
          products: [],
          overlayData: { overlays: [], legend: {} },
          uiConfig: this.ui.generateUIConfig({ overlays: [] }),
          stages: { ...result.stages, vision: 'done - no products found' },
          timing: { ...result.timing, vision: Date.now() - stageStart, total: Date.now() - startTime },
        };
      }

      result.stages.vision = `done - ${vision.products.length} products`;
      result.timing.vision = Date.now() - stageStart;

      // Deduplicate: vision often detects the same product multiple times
      const deduped = this.deduplicateProducts(vision.products);
      console.log(`[Orchestrator] Deduplicated: ${vision.products.length} → ${deduped.length} unique products`);

      // Stage 4: Nutrition lookup + verification (merged for speed)
      onProgress('nutrition', `Looking up ${deduped.length} products...`);
      stageStart = Date.now();

      const enriched = await this.nutrition.lookup(deduped);

      // Pass ALL products to health evaluation (both verified OFF and AI estimated)
      const verifiedCount = enriched.filter(p => p.verification?.status === 'verified').length;
      const estimatedCount = enriched.length - verifiedCount;
      console.log(`[Orchestrator] Proceeding with ${enriched.length} products (${verifiedCount} verified, ${estimatedCount} AI estimated)`);

      result.stages.nutrition = 'done';
      result.timing.nutrition = Date.now() - stageStart;

      // Stage 5: Health evaluation
      onProgress('health', 'Evaluating health scores...');
      stageStart = Date.now();

      const evaluated = this.health.evaluate(enriched);

      result.stages.health = 'done';
      result.timing.health = Date.now() - stageStart;

      // Stage 6: Overlay generation
      onProgress('overlay', 'Creating visual overlay...');
      stageStart = Date.now();

      const overlayData = this.overlay.generate(evaluated);

      result.stages.overlay = 'done';
      result.timing.overlay = Date.now() - stageStart;

      // Stage 7: UI configuration
      onProgress('ui', 'Preparing display...');
      stageStart = Date.now();

      const uiConfig = this.ui.generateUIConfig(overlayData);

      result.stages.ui = 'done';
      result.timing.ui = Date.now() - stageStart;

      // Complete
      result.timing.total = Date.now() - startTime;
      result.success = true;
      result.products = evaluated;
      result.overlayData = overlayData;
      result.uiConfig = uiConfig;

      console.log(`[Orchestrator] Scan complete in ${result.timing.total}ms`);
      console.log(`[Orchestrator] Stages:`, result.timing);

      return result;
    } catch (err) {
      console.error('[Orchestrator] Pipeline error:', err);
      result.error = `Scan failed: ${err.message}`;
      result.timing.total = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Deduplicate products detected by vision — fuzzy matching.
   */
  deduplicateProducts(products) {
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const deduped = [];

    for (const product of products) {
      const pName = normalize(product.name);
      const pBrand = (product.brand || '').toLowerCase().trim();

      let isDup = false;
      for (const existing of deduped) {
        const eName = normalize(existing.name);
        const eBrand = (existing.brand || '').toLowerCase().trim();

        // Exact name match
        if (pName.join(' ') === eName.join(' ')) {
          isDup = true;
          break;
        }

        // Fuzzy: same brand + significant word overlap
        if (pBrand === eBrand && pBrand.length > 0) {
          const shorter = pName.length < eName.length ? pName : eName;
          const longer = pName.length < eName.length ? eName : pName;
          const longerSet = new Set(longer);
          const overlap = shorter.filter(w => longerSet.has(w)).length;
          if (overlap >= shorter.length * 0.6) {
            console.log(`[Orchestrator] Dedup: "${product.name}" ≈ "${existing.name}"`);
            isDup = true;
            break;
          }
        }
      }

      if (!isDup) {
        deduped.push({ ...product });
      }
    }

    deduped.forEach((p, i) => { p.id = i; });
    return deduped;
  }
}

module.exports = Orchestrator;
