import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  labelClassName?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Readonly<InputProps>>(
  (
    {
      label,
      error,
      hint,
      id,
      className = '',
      containerClassName = '',
      labelClassName = '',
      leftAddon,
      rightAddon,
      type = 'text',
      ...rest
    },
    ref
  ) => {
    return (
      <div className={`form-group ${containerClassName}`.trim()}>
        {label && (
          <label htmlFor={id} className={`form-label ${labelClassName}`.trim()}>
            {label}
          </label>
        )}
        <div className="flex gap-2 items-center">
          {leftAddon}
          <input
            ref={ref}
            id={id}
            type={type}
            className={`form-input flex-1 ${className}`.trim()}
            {...rest}
          />
          {rightAddon}
        </div>
        {hint && !error && (
          <span className="text-xs text-secondary mt-1 block">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-danger mt-1 block">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
