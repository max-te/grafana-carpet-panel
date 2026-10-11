import React from 'react';
import { FieldType, type PanelProps } from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { PanelDataErrorView } from '@grafana/runtime';
import { isCategoricalField } from '../color/categories';
import { findSeries, findTimeField } from '../series';
import { CarpetView } from './CarpetView';

export type Props = PanelProps<CarpetPanelOptions>;

export const CarpetPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  timeRange,
  timeZone,
  onChangeTimeRange,
}) => {
  if (data.series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        message="No series"
        needsTimeField
        needsNumberField
      />
    );
  }
  const series = findSeries(data.series, options);
  if (series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsTimeField={!data.series.some((frame) => findTimeField(frame, options.timeFieldName))}
        needsNumberField={
          !data.series.some((frame) => frame.fields.some((f) => f.type === FieldType.number || isCategoricalField(f)))
        }
      />
    );
  }
  if (series.some(({ timeField }) => timeField.type !== FieldType.time)) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsTimeField />;
  }

  const displayedSeries = series.map(({ valueField, ...rest }) => ({
    ...rest,
    valueField: {
      ...valueField,
      config: {
        ...valueField.config,
        unit: options.valueField?.unit || valueField.config.unit,
        decimals: options.valueField?.decimals ?? valueField.config.decimals,
        min: options.color.min,
        max: options.color.max,
      },
    },
  }));

  return (
    <CarpetView
      options={options}
      series={displayedSeries}
      width={width}
      height={height}
      timeRange={timeRange}
      timeZone={timeZone}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};


