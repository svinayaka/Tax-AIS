import React, { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  CheckCircle,
  Receipt,
  TrendingUp,
  BadgeDollarSign,
  Info,
} from 'lucide-react';
import type { AisDeveloperSchema } from '../../types/ais';
import { formatInr } from '../../lib/dom-utils';
import { AisPartA } from './AisPartA';
import { AisDeductorCard } from './AisDeductorCard';
import { AisTaxPaymentCard } from './AisTaxPaymentCard';
import { ModalDialog, Button } from '../shared';

export interface AisDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AisDeveloperSchema | null;
  targetSectionId?: string | null;
}

export const AisDetailsModal: React.FC<Readonly<AisDetailsModalProps>> = ({
  isOpen,
  onClose,
  data,
  targetSectionId,
}) => {
  const modalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && targetSectionId) {
      const timer = setTimeout(() => {
        const targetEl = document.getElementById(targetSectionId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetEl.classList.add('ais-section-highlight');
          setTimeout(() => {
            targetEl.classList.remove('ais-section-highlight');
          }, 1800);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, targetSectionId]);

  if (!isOpen || !data) return null;

  const partA = data.part_a_general_info || {
    name_of_assessee: '',
    pan: '',
    aadhaar: '',
    date_of_birth: '',
    mobile_number: '',
    email_address: '',
    address: '',
  };
  const partB1 = data.part_b1_tds_tcs_transactions || [];
  const partB2 = data.part_b2_sft_transactions || [];
  const partB3 = data.part_b3_tax_payments || [];
  const partB4 = data.part_b4_demand_refunds || [];

  const footer = (
    <Button
      id="btnCloseAisModalFooter"
      variant="secondary"
      onClick={onClose}
    >
      Close
    </Button>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      backdropId="aisModalBackdrop"
      cardClassName="modal-card--ais-details"
      bodyClassName="modal-body--ais-scroll"
      bodyRef={modalBodyRef}
      closeBtnId="btnCloseAisModal"
      titleId="aisModalTitle"
      title="Annual Information Statement (AIS) — Part A & Part B"
      subtitle="Extracted Assessee Profile & Tax Ledger Breakdown"
      icon={
        <LayoutDashboard
          className="modal-title-icon"
          style={{ color: 'var(--ksv-ds-text-brand)' }}
          size={22}
        />
      }
      footer={footer}
    >
      <div id="aisDashboardContainer" className="ais-dashboard-wrapper">
        {/* Assessee Info Banner */}
        <div className="ais-pii-banner">
          <div className="ais-pii-info">
            <ShieldCheck className="ais-pii-icon" size={20} />
            <div>
              <h4 className="ais-pii-title">
                Annual Information Statement (AIS)
              </h4>
              <p className="ais-pii-desc">
                Assessee profile (Part A) and tax transaction breakdown (Part B)
                extracted directly from Income Tax Department document.
              </p>
            </div>
          </div>
          <span className="ais-pii-badge">
            <CheckCircle className="btn-icon-xs" size={14} />
            Verified Tax Record
          </span>
        </div>

        {/* PART A: General Information */}
        <AisPartA
          id="modalSectionPartA"
          data={partA}
          financialYear={data.financial_year}
          assessmentYear={data.assessment_year}
          taxYear={data.assessment_year || data.tax_year}
        />

        {/* PART B1: TDS / TCS Transactions */}
        <div className="ais-part-section" id="modalSectionPartB1" style={{ display: 'block' }}>
          <div className="ais-part-header">
            <div className="ais-part-title-wrap">
              <Receipt
                className="ais-part-icon"
                style={{ color: 'var(--ksv-ds-color-sky-500)' }}
                size={20}
              />
              <h3 className="ais-part-title">
                Part B1 — Tax Deducted or Collected at Source (TDS / TCS)
              </h3>
            </div>
            <span className="meta-pill">
              {partB1.length} Deductor Source(s)
            </span>
          </div>

          <div className="ais-deductors-container">
            {partB1.length === 0 ? (
              <div className="ais-empty-part">
                <Info className="btn-icon-sm" size={16} />
                <span>No TDS / TCS transactions recorded for this period.</span>
              </div>
            ) : (
              partB1.map((deductor, idx) => (
                <AisDeductorCard
                  key={`${deductor.information_code}-${idx}`}
                  deductor={deductor}
                />
              ))
            )}
          </div>
        </div>

        {/* PART B2: SFT Transactions */}
        <div className="ais-part-section" id="modalSectionPartB2" style={{ display: 'block' }}>
          <div className="ais-part-header">
            <div className="ais-part-title-wrap">
              <TrendingUp
                className="ais-part-icon"
                style={{ color: 'var(--ksv-ds-color-violet-500)' }}
                size={20}
              />
              <h3 className="ais-part-title">
                Part B2 — Specified Financial Transactions (SFT)
              </h3>
            </div>
            <span className="meta-pill">{partB2.length} Records</span>
          </div>

          {partB2.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Source / Reporting Entity</th>
                    <th>Amount</th>
                    <th>Transaction Date</th>
                  </tr>
                </thead>
                <tbody>
                  {partB2.map((sft, idx) => (
                    <tr key={sft.sr_no || idx}>
                      <td>{sft.sr_no || idx + 1}</td>
                      <td>
                        <span className="meta-pill">
                          {sft.information_code}
                        </span>
                      </td>
                      <td>{sft.information_description}</td>
                      <td>{sft.information_source}</td>
                      <td>
                        <strong>
                          {formatInr(sft.amount ?? sft.transaction_amount ?? 0)}
                        </strong>
                      </td>
                      <td>{sft.transaction_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ais-empty-part">
              <CheckCircle
                className="btn-icon-sm"
                style={{ color: 'var(--ksv-ds-status-success-icon)' }}
                size={16}
              />
              <span>
                No Specified Financial Transactions (SFT) present in this Tax Year.
              </span>
            </div>
          )}
        </div>

        {/* PART B3: Payment of Taxes */}
        <AisTaxPaymentCard
          id="modalSectionPartB3"
          payments={partB3}
        />

        {/* PART B4: Demand and Refund */}
        <div className="ais-part-section" id="modalSectionPartB4" style={{ display: 'block' }}>
          <div className="ais-part-header">
            <div className="ais-part-title-wrap">
              <BadgeDollarSign
                className="ais-part-icon"
                style={{ color: 'var(--ksv-ds-color-amber-500)' }}
                size={20}
              />
              <h3 className="ais-part-title">
                Part B4 — Information Relating to Demand and Refund
              </h3>
            </div>
            <span className="meta-pill">{partB4.length} Records</span>
          </div>

          {partB4.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Financial Year</th>
                    <th>Nature of Refund</th>
                    <th>Refund Amount</th>
                    <th>Date of Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {partB4.map((ref, idx) => (
                    <tr key={idx}>
                      <td>
                        {ref.financial_year || ref.assessment_year || ''}
                      </td>
                      <td>{ref.nature_of_refund || ref.nature || ''}</td>
                      <td>
                        <strong>
                          {formatInr(ref.refund_amount ?? ref.amount ?? 0)}
                        </strong>
                      </td>
                      <td>
                        {ref.date_of_payment || ref.date_of_issuance || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ais-empty-part">
              <CheckCircle
                className="btn-icon-sm"
                style={{ color: 'var(--ksv-ds-status-success-icon)' }}
                size={16}
              />
              <span>No Demands or Refunds Present for this Tax Year.</span>
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  );
};
