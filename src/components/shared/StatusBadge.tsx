import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

export type StatusBadgeVariant =
  | 'active'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'meta';

export interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  title?: string;
}

function resolveStatusClass(variant: StatusBadgeVariant): string {
  if (variant === 'active') return 'status-pill-active';
  if (variant === 'inactive') return 'status-pill-inactive';
  if (variant === 'meta') return 'meta-pill';
  return `ais-itr-badge ais-itr-badge--${variant}`;
}

export const StatusBadge: React.FC<Readonly<StatusBadgeProps>> = ({
  variant = 'meta',
  label,
  icon,
  children,
  className = '',
  title,
}) => {
  const badgeClass = resolveStatusClass(variant);

  let defaultIcon: React.ReactNode = null;
  if (variant === 'active') {
    defaultIcon = <CheckCircle2 className="btn-icon-xs" size={12} />;
  } else if (variant === 'inactive') {
    defaultIcon = <CircleDashed className="btn-icon-xs" size={12} />;
  }

  return (
    <span className={`${badgeClass} ${className}`.trim()} title={title}>
      {icon ?? defaultIcon}
      {label ?? children}
    </span>
  );
};
