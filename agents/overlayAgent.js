/**
 * 🎯 Overlay Agent
 * Generates visual overlay instructions for annotating products on the image.
 */

class OverlayAgent {
  constructor() {
    this.name = 'OverlayAgent';
  }

  /**
   * Generate overlay instructions for the frontend canvas
   * @param {Array} products - Products with health scores and bounding boxes
   * @returns {{ overlays: Array, legend: object }}
   */
  generate(products) {
    console.log(`[Overlay] Generating overlays for ${products.length} products...`);

    const overlays = products.map((product, index) => {
      const center = product.center_xy || [0.5, 0.5];
      const health = product.health;

      // Calculate circle position (center of bounding box)
      const centerX = center[0];
      const centerY = center[1];
      const radius = 0.04; // Fixed reasonable radius since we don't have bounding box anymore

      // Determine visual style based on health verdict
      let style;
      switch (health.verdict) {
        case 'healthy':
          style = {
            strokeColor: '#22c55e',
            fillColor: 'rgba(34, 197, 94, 0.15)',
            icon: '✓',
            lineWidth: 3,
            dashPattern: [],
          };
          break;
        case 'moderate':
          style = {
            strokeColor: '#eab308',
            fillColor: 'rgba(234, 179, 8, 0.12)',
            icon: '~',
            lineWidth: 2.5,
            dashPattern: [8, 4],
          };
          break;
        case 'unhealthy':
          style = {
            strokeColor: '#ef4444',
            fillColor: 'rgba(239, 68, 68, 0.15)',
            icon: '✗',
            lineWidth: 3,
            dashPattern: [],
          };
          break;
        default: // unknown
          style = {
            strokeColor: '#6b7280',
            fillColor: 'rgba(107, 114, 128, 0.1)',
            icon: '?',
            lineWidth: 1.5,
            dashPattern: [4, 4],
          };
      }

      return {
        id: product.id,
        type: 'circle', // circle around product
        position: {
          centerX,
          centerY,
          radius,
        },
        boundingBox: null,
        style,
        label: {
          text: health.label,
          score: health.score,
          position: 'below', // label below circle
        },
        productInfo: {
          name: product.name,
          brand: product.brand,
          verdict: health.verdict,
          score: health.score,
          reasons: health.reasons,
          nutrition: product.nutrition,
        },
      };
    });

    // Resolve overlapping labels
    this.resolveOverlaps(overlays);

    return {
      overlays,
      legend: {
        healthy: { color: '#22c55e', label: 'Healthy', icon: '✓' },
        moderate: { color: '#eab308', label: 'Moderate', icon: '~' },
        unhealthy: { color: '#ef4444', label: 'Unhealthy', icon: '✗' },
        unknown: { color: '#6b7280', label: 'No Data', icon: '?' },
      },
    };
  }

  /**
   * Shift overlapping labels so they don't stack on top of each other
   */
  resolveOverlaps(overlays) {
    for (let i = 0; i < overlays.length; i++) {
      for (let j = i + 1; j < overlays.length; j++) {
        const a = overlays[i].position;
        const b = overlays[j].position;

        const dx = a.centerX - b.centerX;
        const dy = a.centerY - b.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (a.radius + b.radius) * 0.8) {
          // Shift the second label position
          overlays[j].label.position = overlays[j].label.position === 'below' ? 'above' : 'below';
        }
      }
    }
  }
}

module.exports = OverlayAgent;
