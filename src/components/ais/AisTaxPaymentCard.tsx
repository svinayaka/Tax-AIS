import React from 'react';
import { CreditCard, Info } from 'lucide-react';
import type { PartB3TaxPayment } from '../../types/ais';
import { formatInr } from '../../lib/dom-utils';

export interface AisTaxPaymentCardProps {
  payments: PartB3TaxPayment[] | null;
  id?: string;
}

export const AisTaxPaymentCard: React.FC<Readonly<AisTaxPaymentCardProps>> = ({
  payments,
  id,
}) => {
  const list = payments ?? [];

  return (
    <div className="ais-part-section" id={id} style={{ display: 'block' }}>
      <div className="ais-part-header">
        <div className="ais-part-title-wrap">
          <CreditCard
            className="ais-part-icon"
            style={{ color: 'var(--ksv-ds-color-emerald-500)' }}
            size={20}
          />
          <h3 className="ais-part-title">
            Part B3 — Details of Tax Payments (Challans)
          </h3>
        </div>
        <span className="meta-pill">{list.length} Challan(s)</span>
      </div>

      {list.length > 0 ? (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>FY</th>
                <th>Major Head</th>
                <th>Minor Head</th>
                <th>Tax Amount</th>
                <th>Total Challan</th>
                <th>BSR Code</th>
                <th>Date of Deposit</th>
                <th>Challan Serial #</th>
              </tr>
            </thead>
            <tbody>
              {list.map((ch, idx) => (
                <tr key={`${ch.challan_serial_number}-${idx}`}>
                  <td>
                    <span className="meta-pill font-mono">{ch.financial_year}</span>
                  </td>
                  <td>{ch.major_head}</td>
                  <td>
                    <span
                      className="meta-pill"
                      style={{ fontSize: 'var(--ksv-ds-text-2xs)' }}
                    >
                      {ch.minor_head}
                    </span>
                  </td>
                  <td
                    style={{
                      color: 'var(--ksv-ds-status-success-icon)',
                      fontWeight: 'var(--ksv-ds-font-weight-bold)',
                    }}
                  >
                    {formatInr(ch.tax_amount)}
                  </td>
                  <td>
                    <strong>
                      {formatInr(ch.total_challan_amount || ch.tax_amount)}
                    </strong>
                  </td>
                  <td className="font-mono">{ch.bsr_code}</td>
                  <td>{ch.date_of_deposit}</td>
                  <td className="font-mono">{String(ch.challan_serial_number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ais-empty-part">
          <Info className="btn-icon-sm" size={16} />
          <span>No Tax Payment challans recorded for this period.</span>
        </div>
      )}
    </div>
  );
};
