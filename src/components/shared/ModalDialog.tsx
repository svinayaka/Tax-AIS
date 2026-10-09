import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  cardClassName?: string;
  bodyClassName?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
  backdropId?: string;
  closeBtnId?: string;
  titleId?: string;
}

export const ModalDialog: React.FC<Readonly<ModalDialogProps>> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  cardClassName = '',
  bodyClassName = '',
  bodyRef,
  backdropId,
  closeBtnId,
  titleId,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id={backdropId}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`modal-card ${cardClassName}`.trim()}>
        {(title || icon) && (
          <div className="modal-header">
            <div className="modal-header-left flex items-center gap-2">
              {icon && <div className="modal-title-icon">{icon}</div>}
              <div>
                {title && (
                  <h3 id={titleId} className="modal-title">
                    {title}
                  </h3>
                )}
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              id={closeBtnId}
              className="btn-modal-close"
              title="Close"
              aria-label="Close modal"
              onClick={onClose}
            >
              <X className="close-icon" size={18} />
            </button>
          </div>
        )}
        <div ref={bodyRef} className={`modal-body ${bodyClassName}`.trim()}>
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
