import React, { useState, useEffect, useRef } from 'react';
import { Lock, Info, Eye, EyeOff, Unlock } from 'lucide-react';
import { ModalDialog, Button } from '../shared';

export interface PasswordModalProps {
  isOpen: boolean;
  isRetry: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export const PasswordModal: React.FC<Readonly<PasswordModalProps>> = ({
  isOpen,
  isRetry,
  onSubmit,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) return;
    onSubmit(password.trim());
  };

  const footer = (
    <>
      <Button
        id="btnCancelPasswordModal"
        variant="secondary"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        id="btnSubmitPassword"
        variant="primary"
        icon={<Unlock className="btn-icon-sm" size={16} />}
        onClick={() => handleSubmit()}
      >
        <span>Unlock &amp; Extract</span>
      </Button>
    </>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onCancel}
      backdropId="passwordModalBackdrop"
      closeBtnId="btnCancelPasswordClose"
      title="Enter AIS PDF Password"
      icon={<Lock className="text-brand w-5 h-5" size={20} />}
      footer={footer}
    >
      <div className="p-3 bg-subtle rounded-md border border-subtle text-xs text-secondary leading-relaxed">
        <p className="mb-1 font-semibold text-primary">
          <Info className="w-3.5 h-3.5 inline mr-1 text-brand" size={14} />{' '}
          Standard AIS Password Format:
        </p>
        <p>
          <strong>PAN (in UPPERCASE) + Date of Birth (DDMMYYYY)</strong>
        </p>
        <p className="text-tertiary mt-1">
          Example: For PAN{' '}
          <code className="px-1 py-0.5 rounded bg-surface">ABCDE1234F</code> born on
          01-Jan-1990 &rarr;{' '}
          <code className="px-1 py-0.5 rounded bg-surface font-mono">
            ABCDE1234F01011990
          </code>
        </p>
      </div>

      <form id="passwordForm" className="form-group mt-4" onSubmit={handleSubmit}>
        <label htmlFor="aisPasswordInput" className="form-label">
          Document Password
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type={showPassword ? 'text' : 'password'}
            id="aisPasswordInput"
            className="form-input flex-1 font-mono"
            placeholder="PAN+DDMMYYYY"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            id="btnTogglePasswordVisibility"
            variant="icon"
            title="Show/Hide Password"
            aria-label="Show or hide password"
            onClick={() => setShowPassword(!showPassword)}
            icon={
              showPassword ? (
                <EyeOff className="btn-icon-sm" size={16} />
              ) : (
                <Eye className="btn-icon-sm" size={16} />
              )
            }
          />
        </div>
        {isRetry && (
          <span id="passwordErrorMsg" className="text-xs text-danger mt-1 block">
            Incorrect password. Please verify your PAN and Date of Birth.
          </span>
        )}
      </form>
    </ModalDialog>
  );
};
