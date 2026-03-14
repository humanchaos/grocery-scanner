/**
 * ✅ Health Evaluator Agent
 * Scores products as healthy/moderate/unhealthy based on configurable rules.
 */

const healthRules = require('../config/healthRules.json');

class HealthAgent {
  constructor() {
    this.name = 'HealthAgent';
    this.rules = healthRules;
  }

  /**
   * Evaluate health of all products
   * @param {Array} products - Products enriched with nutrition data
   * @returns {Array} Products with health scores and verdicts
   */
  evaluate(products) {
    console.log(`[Health] Evaluating ${products.length} products...`);

    return products.map(product => {
      const nutrition = product.nutrition;
      const scores = {};
      const reasons = [];

      // If no nutrition data available, mark as unknown
      if (nutrition.data_quality === 'none') {
        return {
          ...product,
          health: {
            score: null,
            verdict: 'unknown',
            color: '#6b7280',
            label: 'No Data',
            reasons: ['Nutrition data not available'],
            breakdown: {},
          },
        };
      }

      // Score each criteria
      scores.sugar = this.scoreNumeric(nutrition.sugar_100g, 'sugar_per_100g', 'Sugar', reasons);
      scores.saturated_fat = this.scoreNumeric(nutrition.saturated_fat_100g, 'saturated_fat_per_100g', 'Saturated fat', reasons);
      scores.sodium = this.scoreNumeric(nutrition.sodium_100g, 'sodium_per_100g', 'Sodium', reasons);
      scores.additives = this.scoreNumeric(nutrition.additives_count, 'additives_count', 'Additives', reasons);
      scores.nutri_score = this.scoreCategory(nutrition.nutri_score, 'nutri_score', 'Nutri-Score', reasons);
      scores.nova_group = this.scoreCategory(nutrition.nova_group, 'nova_group', 'NOVA group', reasons);

      // Calculate weighted composite score
      const weights = this.rules.weights;
      let totalWeight = 0;
      let weightedSum = 0;

      for (const [key, weight] of Object.entries(weights)) {
        if (scores[key] !== null) {
          weightedSum += scores[key] * weight;
          totalWeight += weight;
        }
      }

      const compositeScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

      // Determine verdict
      let verdict, color, label;
      const verdicts = this.rules.verdicts;

      if (compositeScore === null) {
        verdict = 'unknown';
        color = '#6b7280';
        label = 'No Data';
      } else if (compositeScore >= verdicts.healthy.min_score) {
        verdict = 'healthy';
        color = verdicts.healthy.color;
        label = verdicts.healthy.label;
      } else if (compositeScore >= verdicts.moderate.min_score) {
        verdict = 'moderate';
        color = verdicts.moderate.color;
        label = verdicts.moderate.label;
      } else {
        verdict = 'unhealthy';
        color = verdicts.unhealthy.color;
        label = verdicts.unhealthy.label;
      }

      return {
        ...product,
        health: {
          score: compositeScore,
          verdict,
          color,
          label,
          summary: this.generateSummary(verdict, nutrition, reasons),
          reasons,
          breakdown: scores,
        },
      };
    });
  }

  /**
   * Generate a plain-language, easy-to-understand summary.
   * No numbers, no science — just a clear explanation.
   */
  generateSummary(verdict, nutrition, reasons) {
    if (verdict === 'unknown') return 'Not enough data to assess this product.';

    const concerns = [];
    const positives = [];

    // Sugar assessment
    if (nutrition.sugar_100g != null) {
      if (nutrition.sugar_100g > 15) concerns.push('high in sugar');
      else if (nutrition.sugar_100g > 5) concerns.push('moderate sugar content');
      else positives.push('low in sugar');
    }

    // Fat assessment
    if (nutrition.saturated_fat_100g != null) {
      if (nutrition.saturated_fat_100g > 5) concerns.push('high in saturated fat');
      else if (nutrition.saturated_fat_100g > 2) concerns.push('some saturated fat');
      else positives.push('low in saturated fat');
    }

    // Sodium assessment
    if (nutrition.sodium_100g != null) {
      const sodiumMg = nutrition.sodium_100g * 1000;
      if (sodiumMg > 600) concerns.push('very salty');
      else if (sodiumMg > 300) concerns.push('fairly salty');
    }

    // Processing level
    const nova = nutrition.nova_group;
    if (nova === 4) concerns.push('ultra-processed');
    else if (nova === 3) concerns.push('somewhat processed');
    else if (nova === 1) positives.push('minimally processed');

    // Fiber
    if (nutrition.fiber_100g != null && nutrition.fiber_100g >= 6) {
      positives.push('good source of fiber');
    }

    // Additives
    if (nutrition.additives_count > 3) concerns.push('contains many additives');

    // Build the sentence
    let summaryText = '';
    if (verdict === 'healthy') {
      if (positives.length > 0) {
        summaryText = `A good choice — ${this.joinReadable(positives)}.`;
      } else {
        summaryText = 'A solid, healthy option.';
      }
    } else if (verdict === 'unhealthy') {
      if (concerns.length > 0) {
        summaryText = `Not recommended — ${this.joinReadable(concerns)}.`;
      } else {
        summaryText = 'This product has significant health concerns.';
      }
    } else {
      // Moderate
      if (concerns.length > 0 && positives.length > 0) {
        summaryText = `${this.capitalize(this.joinReadable(concerns))}, but ${this.joinReadable(positives)}.`;
      } else if (concerns.length > 0) {
        summaryText = `${this.capitalize(this.joinReadable(concerns))} — consume in moderation.`;
      } else {
        summaryText = 'An okay choice, but not the healthiest option.';
      }
    }

    if (nutrition.data_quality === 'estimated') {
      return `✨ AI Estimated: ${summaryText}`;
    }

    return summaryText;
  }

  /**
   * Join items with commas and "and" for the last item
   */
  joinReadable(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Score a numeric nutritional value
   * @returns {number|null} Score 0-100 (100 = healthiest)
   */
  scoreNumeric(value, ruleKey, label, reasons) {
    if (value === null || value === undefined) return null;

    const threshold = this.rules.thresholds[ruleKey];
    if (!threshold) return null;

    if (value <= threshold.healthy) {
      return 100;
    } else if (value <= threshold.moderate) {
      // Scale between 40-70
      const ratio = (value - threshold.healthy) / (threshold.moderate - threshold.healthy);
      reasons.push(`${label}: ${value}${threshold.unit}/100g (moderate)`);
      return Math.round(70 - ratio * 30);
    } else {
      // Scale between 0-40
      const overshoot = value / threshold.moderate;
      const score = Math.max(0, Math.round(40 - (overshoot - 1) * 20));
      reasons.push(`⚠️ ${label}: ${value}${threshold.unit}/100g (high)`);
      return score;
    }
  }

  /**
   * Score a categorical value (nutri_score, nova_group)
   * @returns {number|null} Score 0-100
   */
  scoreCategory(value, ruleKey, label, reasons) {
    if (value === null || value === undefined) return null;

    const threshold = this.rules.thresholds[ruleKey];
    if (!threshold) return null;

    const normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;

    if (threshold.healthy.includes(normalizedValue)) {
      return 100;
    } else if (threshold.moderate.includes(normalizedValue)) {
      reasons.push(`${label}: ${String(value).toUpperCase()} (moderate)`);
      return 55;
    } else if (threshold.unhealthy.includes(normalizedValue)) {
      reasons.push(`⚠️ ${label}: ${String(value).toUpperCase()} (poor)`);
      return 15;
    }

    return null;
  }
}

module.exports = HealthAgent;
