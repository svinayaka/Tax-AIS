import React from 'react';
import { Info } from 'lucide-react';
import type { PartB1TdsTcsTransaction } from '../../types/ais';
import { formatInr } from '../../lib/dom-utils';
import { StatusBadge } from '../shared';

export interface AisDeductorCardProps {
  deductor: PartB1TdsTcsTransaction | null;
}

export const AisDeductorCard: React.FC<Readonly<AisDeductorCardProps>> = ({ deductor }) => {
  if (!deductor) return null;

  const lineItems = deductor.line_items ?? [];
  const total = deductor.total_amount_credited ?? deductor.total_amount ?? 0;

  const activeItems = lineItems.filter(
    (item) => (item.status || '').toLowerCase() !== 'inactive'
  );
  const inactiveItems = lineItems.filter(
    (item) => (item.status || '').toLowerCase() === 'inactive'
  );

  const activeTds = activeItems.reduce(
    (sum, item) => sum + (item.tds_deducted || 0),
    0
  );
  const inactiveTds = inactiveItems.reduce(
    (sum, item) => sum + (item.tds_deducted || 0),
    0
  );

  return (
    <div className="ais-deductor-block" style={{ display: 'block' }}>
      <div className="ais-deductor-header">
        <div>
          <div className="ais-deductor-name">
            {deductor.information_source || 'Unknown Deductor'}
          </div>
          <div className="ais-deductor-meta">
            <strong>Code:</strong> {deductor.information_code || '—'} &bull;{' '}
            {deductor.information_description || ''}
          </div>
        </div>
        <div className="ais-deductor-metrics">
          <div
            className="ais-metric-pill"
            title="Total gross amount credited across active transactions"
          >
            <span className="ais-metric-label">Total Amount Credited</span>
            <span
              className="ais-metric-val"
              style={{
                color: 'var(--ksv-ds-text-brand)',
                fontWeight: 'var(--ksv-ds-font-weight-bold)',
              }}
            >
              {formatInr(total)}
            </span>
          </div>
          <div
            className="ais-metric-pill"
            title="Eligible TDS deducted from active transactions valid for tax credit in your return"
          >
            <span className="ais-metric-label">TDS Deducted</span>
            <span
              className="ais-metric-val"
              style={{
                color: 'var(--ksv-ds-status-warning-icon)',
                fontWeight: 'var(--ksv-ds-font-weight-bold)',
              }}
            >
              {formatInr(activeTds)}
            </span>
          </div>
          {inactiveItems.length > 0 && (
            <div
              className="ais-metric-pill ais-metric-pill--superseded ais-tooltip-wrapper"
              tabIndex={0}
            >
              <span className="ais-metric-label">
                Superseded / Inactive{' '}
                <Info
                  className="btn-icon-xs"
                  size={12}
                  style={{ color: 'var(--ksv-ds-text-tertiary)', display: 'inline', verticalAlign: 'middle' }}
                />
              </span>
              <span
                className="ais-metric-val"
                style={{
                  color: 'var(--ksv-ds-text-tertiary)',
                  fontWeight: 'var(--ksv-ds-font-weight-bold)',
                }}
              >
                {formatInr(inactiveTds)}{' '}
                <small
                  style={{
                    fontSize: 'var(--ksv-ds-text-2xs)',
                    fontWeight: 'var(--ksv-ds-font-weight-normal)',
                  }}
                >
                  ({inactiveItems.length})
                </small>
              </span>
              <div className="ais-tooltip-bubble" role="tooltip">
                <strong>Superseded / Corrected Records</strong>
                <span>
                  Under CBDT rules, inactive rows represent transactions superseded
                  or corrected by revised deductor filings. They are excluded from
                  income and tax credit computations to prevent duplicate claims.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Quarter</th>
              <th>Date of Payment / Credit</th>
              <th>Amount Paid / Credited</th>
              <th>TDS Deducted</th>
              <th>TDS Deposited</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => {
              const isInactive = (item.status || '').toLowerCase() === 'inactive';
              return (
                <tr key={item.sr_no ?? idx}>
                  <td>{item.sr_no ?? idx + 1}</td>
                  <td>
                    <span
                      className="meta-pill"
                      style={{ fontSize: 'var(--ksv-ds-text-2xs)' }}
                    >
                      {item.quarter}
                    </span>
                  </td>
                  <td>{item.date_of_payment}</td>
                  <td>
                    <strong>{formatInr(item.amount_paid_credited)}</strong>
                  </td>
                  <td style={{ color: 'var(--ksv-ds-status-warning-icon)' }}>
                    {formatInr(item.tds_deducted)}
                  </td>
                  <td style={{ color: 'var(--ksv-ds-status-success-icon)' }}>
                    {formatInr(item.tds_deposited)}
                  </td>
                  <td>
                    <StatusBadge variant={isInactive ? 'inactive' : 'active'}>
                      {item.status || 'Active'}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
