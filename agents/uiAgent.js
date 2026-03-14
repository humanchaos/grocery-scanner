/**
 * 🎨 UI/UX Agent
 * Controls presentation, layout decisions, and accessibility.
 * Generates dynamic UI configuration based on scan results.
 */

class UIAgent {
  constructor() {
    this.name = 'UIAgent';
  }

  /**
   * Generate UI configuration based on scan results
   * @param {object} scanResult - Complete scan result with overlays
   * @returns {object} UI configuration for the frontend
   */
  generateUIConfig(scanResult) {
    const products = scanResult.overlays || [];
    const productCount = products.length;

    console.log(`[UI] Generating UI config for ${productCount} products...`);

    // Determine layout based on product count
    const layout = this.determineLayout(productCount);

    // Generate product cards with accessibility
    const cards = products.map(overlay => this.generateProductCard(overlay));

    // Calculate summary stats
    const stats = this.calculateStats(products);

    return {
      layout,
      cards,
      stats,
      theme: this.getTheme(),
      accessibility: this.getAccessibilityConfig(),
      animations: this.getAnimationConfig(productCount),
    };
  }

  /**
   * Determine optimal layout based on product count and screen context
   */
  determineLayout(productCount) {
    if (productCount <= 3) {
      return { mode: 'expanded', columns: 1, cardSize: 'large' };
    } else if (productCount <= 8) {
      return { mode: 'grid', columns: 2, cardSize: 'medium' };
    } else {
      return { mode: 'compact', columns: 2, cardSize: 'small' };
    }
  }

  /**
   * Generate an accessible product card configuration
   */
  generateProductCard(overlay) {
    const info = overlay.productInfo;
    const health = info.verdict;

    return {
      id: overlay.id,
      name: info.name,
      brand: info.brand,
      // Color-blind safe: use patterns + icons, not just color
      indicator: {
        color: overlay.style.strokeColor,
        icon: overlay.style.icon,
        pattern: this.getPatternForVerdict(health),
        ariaLabel: `${info.name} by ${info.brand}: ${overlay.label.text} - score ${overlay.label.score || 'unavailable'}`,
      },
      score: overlay.label.score,
      verdict: overlay.label.text,
      reasons: info.reasons || [],
      nutritionHighlights: this.extractHighlights(info.nutrition),
    };
  }

  /**
   * Color-blind safe patterns for each verdict
   */
  getPatternForVerdict(verdict) {
    switch (verdict) {
      case 'healthy': return 'solid-circle';     // ● filled circle
      case 'moderate': return 'half-circle';     // ◐ half-filled
      case 'unhealthy': return 'crossed-circle'; // ⊘ crossed
      default: return 'empty-circle';            // ○ empty
    }
  }

  /**
   * Extract the most important nutrition highlights for display
   */
  extractHighlights(nutrition) {
    if (!nutrition || nutrition.data_quality === 'none') return [];

    const highlights = [];

    if (nutrition.sugar_100g != null) {
      highlights.push({ label: 'Sugar', value: `${nutrition.sugar_100g}g`, per: '/100g' });
    }
    if (nutrition.saturated_fat_100g != null) {
      highlights.push({ label: 'Sat. Fat', value: `${nutrition.saturated_fat_100g}g`, per: '/100g' });
    }
    if (nutrition.sodium_100g != null) {
      highlights.push({ label: 'Sodium', value: `${(nutrition.sodium_100g * 1000).toFixed(0)}mg`, per: '/100g' });
    }
    if (nutrition.nutri_score) {
      highlights.push({ label: 'Nutri-Score', value: nutrition.nutri_score.toUpperCase(), per: '' });
    }
    if (nutrition.nova_group) {
      highlights.push({ label: 'NOVA', value: `${nutrition.nova_group}`, per: '/4' });
    }
    if (nutrition.additives_count != null) {
      highlights.push({ label: 'Additives', value: `${nutrition.additives_count}`, per: '' });
    }

    return highlights;
  }

  /**
   * Calculate overall scan stats
   */
  calculateStats(overlays) {
    const total = overlays.length;
    const healthy = overlays.filter(o => o.productInfo.verdict === 'healthy').length;
    const moderate = overlays.filter(o => o.productInfo.verdict === 'moderate').length;
    const unhealthy = overlays.filter(o => o.productInfo.verdict === 'unhealthy').length;
    const unknown = overlays.filter(o => o.productInfo.verdict === 'unknown').length;

    return {
      total,
      healthy,
      moderate,
      unhealthy,
      unknown,
      healthyPercentage: total > 0 ? Math.round((healthy / total) * 100) : 0,
    };
  }

  /**
   * Dark theme configuration
   */
  getTheme() {
    return {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      border: '#334155',
      glassBg: 'rgba(30, 41, 59, 0.8)',
      glassBlur: '12px',
    };
  }

  /**
   * Accessibility configuration
   */
  getAccessibilityConfig() {
    return {
      usePatterns: true,
      useIcons: true,
      highContrast: false,
      fontSize: { base: '16px', small: '14px', large: '20px' },
      minTouchTarget: '44px', // WCAG minimum
    };
  }

  /**
   * Animation configuration
   */
  getAnimationConfig(productCount) {
    return {
      scanline: { duration: '2s', easing: 'ease-in-out' },
      cardReveal: {
        duration: '0.4s',
        stagger: Math.min(0.1, 1.5 / productCount), // Don't take too long for many products
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      overlayFade: { duration: '0.6s', easing: 'ease-out' },
    };
  }
}

module.exports = UIAgent;
