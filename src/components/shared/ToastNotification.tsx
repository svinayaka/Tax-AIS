import React from 'react';
import { CheckCircle, AlertCircle, ShieldCheck, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastVariant;
}

export interface ToastNotificationProps {
  id: string;
  message: string;
  type?: ToastVariant;
  onDismiss?: (id: string) => void;
  className?: string;
}

function renderToastIcon(type: ToastVariant) {
  if (type === 'success') {
    return <CheckCircle className="toast-icon" size={16} />;
  }
  if (type === 'error') {
    return <AlertCircle className="toast-icon" size={16} />;
  }
  return <ShieldCheck className="toast-icon" size={16} />;
}

export const ToastNotification: React.FC<Readonly<ToastNotificationProps>> = ({
  id,
  message,
  type = 'info',
  onDismiss,
  className = '',
}) => {
  return (
    <div className={`toast toast-${type} ${className}`.trim()}>
      {renderToastIcon(type)}
      <span className="toast-message flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="btn-modal-close"
          style={{ width: 'var(--ksv-ds-space-4)', height: 'var(--ksv-ds-space-4)', padding: 0 }}
          aria-label="Dismiss toast"
          onClick={() => onDismiss(id)}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export interface ToastContainerProps {
  toasts: readonly ToastItem[];
  onDismiss?: (id: string) => void;
  className?: string;
}

export const ToastContainer: React.FC<Readonly<ToastContainerProps>> = ({
  toasts,
  onDismiss,
  className = '',
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className={`toast-container ${className}`.trim()}>
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
