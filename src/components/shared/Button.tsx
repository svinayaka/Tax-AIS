import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function resolveButtonClass(variant: ButtonVariant, size?: ButtonSize, className = ''): string {
  const parts = ['btn'];
  if (variant === 'primary') parts.push('btn-primary');
  else if (variant === 'secondary') parts.push('btn-secondary');
  else if (variant === 'ghost') parts.push('btn-ghost');
  else if (variant === 'icon') parts.push('btn-icon');

  if (size === 'xs') parts.push('btn-xs');
  else if (size === 'sm') parts.push('btn-sm');

  if (className) parts.push(className);
  return parts.join(' ');
}

export const Button = forwardRef<HTMLButtonElement, Readonly<ButtonProps>>(
  (
    {
      variant = 'secondary',
      size,
      icon,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const btnClass = resolveButtonClass(variant, size, className);

    return (
      <button ref={ref} type={type} className={btnClass} {...rest}>
        {icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
