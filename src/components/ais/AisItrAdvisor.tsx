import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  ListChecks,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import type { ItrClassificationResult } from '../../types/ais';
import { formatInr } from '../../lib/dom-utils';

export interface AisItrAdvisorProps {
  data: ItrClassificationResult | null;
  onItrFormChanged?: (effectiveForm: string, isEligibleForItr1: boolean) => void;
  id?: string;
}

function getBadgeVariant(isElevated: boolean, recommendedForm?: string): string {
  if (isElevated) return 'warning';
  if (recommendedForm === 'ITR-1') return 'success';
  if (recommendedForm === 'ITR-2') return 'info';
  return 'warning';
}

function getHeadlineVariant(recommendedForm?: string): string {
  if (recommendedForm === 'ITR-1') return 'success';
  if (recommendedForm === 'ITR-2') return 'info';
  return 'warning';
}

export const AisItrAdvisor: React.FC<Readonly<AisItrAdvisorProps>> = ({
  data,
  onItrFormChanged,
  id,
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Reset checked IDs when data changes
  useEffect(() => {
    setCheckedIds(new Set());
  }, [data]);

  const isBaseItr1 = data?.recommendedForm === 'ITR-1';
  const isElevated = checkedIds.size > 0 && isBaseItr1;
  const effectiveForm = isElevated ? 'ITR-2' : data?.recommendedForm || 'ITR-1';
  const isEligibleForItr1 = !isElevated && isBaseItr1;

  useEffect(() => {
    if (data && onItrFormChanged) {
      onItrFormChanged(effectiveForm, isEligibleForItr1);
    }
  }, [data, effectiveForm, isEligibleForItr1, onItrFormChanged]);

  if (!data) return null;

  const badgeVariant = getBadgeVariant(isElevated, data.recommendedForm);
  const headlineVariant = getHeadlineVariant(data.recommendedForm);
  const disqualifiers = data.disqualifiersFromItr1 || [];
  const eligibleFactors = data.eligibleFactors || [];
  const checklist = data.checklist || [];

  const handleCheckboxChange = (checkId: string, isChecked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.add(checkId);
      } else {
        next.delete(checkId);
      }
      return next;
    });
  };

  return (
    <div
      className="ais-part-section ais-itr-advisor-section"
      id={id}
      style={{ display: 'block' }}
    >
      <div className="ais-part-header">
        <div className="ais-itr-header-badges">
          <span
            id="itrDynamicBadge"
            className={`ais-itr-badge ais-itr-badge--${badgeVariant}`}
          >
            {isElevated
              ? 'ITR-2 (Elevated by Checklist)'
              : data.targetWorkspace || data.recommendedForm}
          </span>
          {data.calculatedTotalIncome > 0 && (
            <span className="meta-pill">
              Parsed Income: {formatInr(data.calculatedTotalIncome)}
            </span>
          )}
          <span className="meta-pill">
            {data.confidence === 'high' ? 'Verified from AIS' : 'Provisional'}
          </span>
        </div>
      </div>

      <div className={`ais-itr-headline-card ais-itr-headline--${headlineVariant}`}>
        <div className="ais-itr-headline-title">{data.headline}</div>
        <p className="ais-itr-headline-desc">{data.summaryReason}</p>
      </div>

      {disqualifiers.length > 0 && (
        <div className="ais-itr-disqualifiers-box">
          <div className="ais-itr-box-title">
            <AlertTriangle
              className="ais-itr-box-icon"
              style={{ color: 'var(--ksv-ds-status-warning-icon)' }}
              size={18}
            />
            <span>Statutory Disqualifiers from Form ITR-1 (Sahaj)</span>
          </div>
          <ul className="ais-itr-list">
            {disqualifiers.map((item, idx) => (
              <li
                key={idx}
                className="ais-itr-list-item ais-itr-list-item--disqualifier"
              >
                <XCircle className="ais-itr-item-icon" size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eligibleFactors.length > 0 && (
        <div className="ais-itr-factors-box">
          <div className="ais-itr-box-title">
            <CheckCircle2
              className="ais-itr-box-icon"
              style={{ color: 'var(--ksv-ds-status-success-icon)' }}
              size={18}
            />
            <span>Verified Allowable Income Streams in AIS</span>
          </div>
          <ul className="ais-itr-list">
            {eligibleFactors.map((factor, idx) => (
              <li
                key={idx}
                className="ais-itr-list-item ais-itr-list-item--eligible"
              >
                <Check className="ais-itr-item-icon" size={16} />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interactive Verification Checklist (Exclusively rendered when provisionally ITR-1) */}
      {data.recommendedForm === 'ITR-1' && checklist.length > 0 && (
        <div className="ais-itr-checklist-box">
          <div className="ais-itr-box-title">
            <ListChecks
              className="ais-itr-box-icon"
              style={{ color: 'var(--ksv-ds-text-brand)' }}
              size={18}
            />
            <span>External Statutory Checklist (Parameters Outside AIS)</span>
          </div>
          <p className="ais-itr-checklist-desc">
            AIS contains transactions reported by banks and deductors. Check any
            condition below that applies to your filing year:
          </p>

          {isElevated && (
            <div id="itrChecklistCallout" className="ais-itr-elevation-callout">
              <AlertCircle
                className="ais-itr-box-icon"
                style={{ color: 'var(--ksv-ds-status-warning-icon)' }}
                size={18}
              />
              <span>
                <strong>ITR-2 Required:</strong> One or more checked criteria exceed
                ITR-1 statutory limits. You must file Form ITR-2 (or ITR-3).
              </span>
            </div>
          )}

          <div className="ais-itr-checklist-items">
            {checklist.map((item) => {
              const isChecked = checkedIds.has(item.id);
              return (
                <label
                  key={item.id}
                  className="ais-itr-checklist-row"
                  htmlFor={`chk_${item.id}`}
                >
                  <input
                    type="checkbox"
                    id={`chk_${item.id}`}
                    data-checklist-id={item.id}
                    className="ais-itr-checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      handleCheckboxChange(item.id, e.target.checked)
                    }
                  />
                  <div className="ais-itr-checklist-content">
                    <div className="ais-itr-question">{item.question}</div>
                    <div className="ais-itr-impact">{item.impactIfYes}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
