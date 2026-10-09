import React from 'react';
import { KpiMetric, type KpiMetricProps } from '../shared';

export type AisKpiCardProps = KpiMetricProps;

export const AisKpiCard: React.FC<Readonly<AisKpiCardProps>> = (props) => {
  return <KpiMetric {...props} />;
};
