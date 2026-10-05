/**
 * <ais-kpi-card> Web Component
 * Stencil-compatible Custom Element styled with @svinayaka/siddi-design-system tokens
 */
export class AisKpiCard extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'value', 'icon', 'badge', 'color'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const title = this.getAttribute('title') || '';
    const value = this.getAttribute('value') || '0';
    const icon = this.getAttribute('icon') || 'activity';
    const badge = this.getAttribute('badge') || '';
    const color = this.getAttribute('color') || 'var(--ksv-ds-text-brand)';

    this.className = 'kpi-card';
    this.innerHTML = `
      <div class="kpi-icon-wrapper" style="color: ${color};">
        <i data-lucide="${icon}" class="kpi-icon"></i>
      </div>
      <div class="kpi-content">
        <span class="kpi-title">${title}</span>
        <div class="kpi-value">${value}</div>
        ${badge ? `<div class="kpi-subtext">${badge}</div>` : ''}
      </div>
    `;
  }
}

if (!customElements.get('ais-kpi-card')) {
  customElements.define('ais-kpi-card', AisKpiCard);
}
