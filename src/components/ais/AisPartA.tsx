import React from 'react';
import { UserCheck } from 'lucide-react';
import type { PartAGeneralInfo } from '../../types/ais';

export interface AisPartAProps {
  data: PartAGeneralInfo | null;
  financialYear?: string;
  assessmentYear?: string;
  taxYear?: string;
  id?: string;
}

export const AisPartA: React.FC<Readonly<AisPartAProps>> = ({
  data,
  financialYear = '',
  assessmentYear = '',
  taxYear = '',
  id,
}) => {
  const ay = assessmentYear || taxYear;
  let periodLabel = 'AY 2026-27';
  if (financialYear && ay) {
    periodLabel = `FY ${financialYear} | AY ${ay}`;
  } else if (ay) {
    periodLabel = `AY ${ay}`;
  } else if (financialYear) {
    periodLabel = `FY ${financialYear}`;
  }

  return (
    <div className="ais-part-section" id={id} style={{ display: 'block' }}>
      <div className="ais-part-header">
        <div className="ais-part-title-wrap">
          <UserCheck
            className="ais-part-icon"
            style={{ color: 'var(--ksv-ds-text-brand)' }}
            size={20}
          />
          <h3
            className="ais-part-title"
            style={{
              color: 'var(--ksv-ds-text-brand)',
              fontSize: 'var(--ksv-ds-text-lg)',
              fontWeight: 'var(--ksv-ds-font-weight-bold)',
            }}
          >
            Part A - General Information
          </h3>
        </div>
        <span className="meta-pill">{periodLabel}</span>
      </div>

      <div className="ais-grid-general">
        {/* Row 1: PAN & Aadhaar */}
        <div className="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span className="ais-gen-label">Permanent Account Number (PAN)</span>
          <div className="ais-gen-value font-mono">
            {data?.pan || '—'}
          </div>
        </div>

        <div className="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span className="ais-gen-label">Aadhaar Number</span>
          <div className="ais-gen-value font-mono">
            {data?.aadhaar || '—'}
          </div>
        </div>

        {/* Row 2: Name of Assessee */}
        <div className="ais-gen-card ais-gen-col-2 ais-gen-divider-bottom">
          <span className="ais-gen-label">Name of Assessee</span>
          <div className="ais-gen-value">
            {data?.name_of_assessee || '—'}
          </div>
        </div>

        {/* Row 3: DOB & Mobile */}
        <div className="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span className="ais-gen-label">Date of Birth</span>
          <div className="ais-gen-value">
            {data?.date_of_birth || '—'}
          </div>
        </div>

        <div className="ais-gen-card ais-gen-col-1 ais-gen-divider-bottom">
          <span className="ais-gen-label">Mobile Number</span>
          <div className="ais-gen-value font-mono">
            {data?.mobile_number || '—'}
          </div>
        </div>

        {/* Row 4: E-mail Address */}
        <div className="ais-gen-card ais-gen-col-2 ais-gen-divider-bottom">
          <span className="ais-gen-label">E-mail Address</span>
          <div
            className="ais-gen-value font-mono"
            style={{ fontSize: 'var(--ksv-ds-text-sm)' }}
          >
            {data?.email_address || '—'}
          </div>
        </div>

        {/* Row 5: Address (Full Width) */}
        <div className="ais-gen-card ais-gen-col-2 ais-gen-card--address">
          <span className="ais-gen-label">Address</span>
          <div
            className="ais-gen-value"
            style={{
              fontWeight: 'var(--ksv-ds-font-weight-semibold)',
              lineHeight: 'var(--ksv-ds-leading-relaxed)',
            }}
          >
            {data?.address || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
