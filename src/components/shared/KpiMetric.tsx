import React from 'react';

export interface KpiMetricProps {
  title: string;
  value: string;
  icon?: React.ReactNode;
  badge?: string;
  color?: string;
  className?: string;
  id?: string;
}

export const KpiMetric: React.FC<Readonly<KpiMetricProps>> = ({
  title,
  value,
  icon,
  badge,
  color = 'var(--ksv-ds-text-brand)',
  className = '',
  id,
}) => {
  return (
    <div id={id} className={`kpi-card ${className}`.trim()}>
      <div className="kpi-icon-wrapper" style={{ color }}>
        {icon}
      </div>
      <div className="kpi-content">
        <span className="kpi-title">{title}</span>
        <div className="kpi-value">{value}</div>
        {badge ? <div className="kpi-subtext">{badge}</div> : null}
      </div>
    </div>
  );
};
