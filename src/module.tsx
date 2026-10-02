import { FieldType, PanelPlugin, FieldNamePickerBaseNameMode } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { HeatmapColorMode, HeatmapColorScale, HourFormat, type CarpetPanelOptions } from './types';
import { CarpetPanel } from './components/CarpetPanel';
import { colorSchemes } from './palettes';
import { useSchemeGradientStops } from './components/useColorScale';
import React from 'react';

export const plugin = new PanelPlugin<CarpetPanelOptions>(CarpetPanel).setPanelOptions((builder) => {
  builder
    .addFieldNamePicker({
      path: 'timeFieldName',
      name: 'Time field name',
      settings: {
        filter: (field) => field.type === FieldType.time,
      },
    })
    .addFieldNamePicker({
      path: 'valueField.name',
      name: 'Value field name',
      settings: {
        baseNameMode: FieldNamePickerBaseNameMode.ExcludeBaseNames,
        filter: (field) => field.type === FieldType.number,
        // TODO: Add support for categorical data
      },
    })
    .addUnitPicker({
      path: 'valueField.unit',
      name: 'Unit',
      description: 'Unit of the value field',
    })
    .addNumberInput({
      path: 'valueField.decimals',
      name: 'Decimals',
      description: 'Decimal places of the value field',
      settings: {
        placeholder: 'auto',
        min: 0,
        max: 10,
        integer: true,
      },
    })
    .addSliderInput({
      path: 'gapWidth',
      name: 'Gap',
      defaultValue: 0,
      description: 'Gap between cells',
      settings: {
        min: 0,
        max: 10,
        step: 0.5,
      },
    })
    .addBooleanSwitch({
      path: 'hatchGaps',
      name: 'Hatch data gaps',
      defaultValue: true,
      description: 'Hatch the parts of the time range without data',
    });

  builder
    .addBooleanSwitch({
      path: 'axes.showX',
      name: 'Show X axis',
      defaultValue: true,
      category: ['Axes'],
    })
    .addBooleanSwitch({
      path: 'axes.showY',
      name: 'Show Y axis',
      defaultValue: false,
      category: ['Axes'],
    })
    .addRadio({
      path: 'axes.hourFormat',
      name: 'Hour format',
      defaultValue: HourFormat.Auto,
      category: ['Axes'],
      settings: {
        options: [
          { label: 'Auto', value: HourFormat.Auto, description: 'Follow the browser locale' },
          { label: '24h', value: HourFormat.H24 },
          { label: '12h', value: HourFormat.H12 },
        ],
      },
      showIf: (opts) => opts.axes?.showY === true,
    });

  const category = ['Colors'];

  // TODO: Consider adding a custom color mode that allows users to define their own color stops
  builder.addRadio({
    path: `color.mode`,
    name: 'Mode',
    defaultValue: HeatmapColorMode.Scheme,
    category,
    settings: {
      options: [
        { label: 'Scheme', value: HeatmapColorMode.Scheme },
        { label: 'Opacity', value: HeatmapColorMode.Opacity },
      ],
    },
  });

  builder.addColorPicker({
    path: `color.fill`,
    name: 'Color',
    defaultValue: 'green',
    category,
    showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
  });

  builder.addRadio({
    path: `color.scale`,
    name: 'Scale',
    defaultValue: HeatmapColorScale.Linear,
    category,
    settings: {
      options: [
        { label: 'Exponential', value: HeatmapColorScale.Exponential },
        { label: 'Linear', value: HeatmapColorScale.Linear },
      ],
    },
    showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
  });

  builder.addSliderInput({
    path: 'color.exponent',
    name: 'Exponent',
    defaultValue: 1,
    category,
    settings: {
      min: 0.1, // 1 for on/off?
      max: 2,
      step: 0.1,
    },
    showIf: (opts) =>
      opts.color.mode === HeatmapColorMode.Opacity && opts.color.scale === HeatmapColorScale.Exponential,
  });

  builder.addSelect({
    path: `color.scheme`,
    name: 'Scheme',
    description: '',
    defaultValue: colorSchemes[0]?.name,
    category,
    settings: {
      options: colorSchemes.map((scheme) => ({
        value: scheme.name,
        label: scheme.name,
        component: () => <GradientViz scheme={scheme.name} />,
      })),
    },
    showIf: (opts) => opts.color.mode !== HeatmapColorMode.Opacity,
  });

  builder.addBooleanSwitch({
    path: 'color.reverse',
    name: 'Reverse',
    defaultValue: false,
    category,
  });

  builder
    .addNumberInput({
      path: 'color.min',
      name: 'Start color scale from value',
      defaultValue: undefined,
      settings: {
        placeholder: 'Auto (min)',
      },
      category,
    })
    .addNumberInput({
      path: 'color.max',
      name: 'End color scale at value',
      defaultValue: undefined,
      settings: {
        placeholder: 'Auto (max)',
      },
      category,
    });

  // A cell holds a single value, so the multi-series tooltip modes do not apply
  commonOptionsBuilder.addTooltipOptions(builder, true);

  builder
    .addBooleanSwitch({
      path: 'legend.show',
      name: 'Show legend',
      defaultValue: false,
      category: ['Legend'],
    })
    .addRadio({
      path: 'legend.placement',
      name: 'Placement',
      defaultValue: 'bottom',
      category: ['Legend'],
      settings: {
        options: [
          { label: 'Bottom', value: 'bottom' },
          { label: 'Right', value: 'right' },
        ],
      },
      showIf: (opts) => opts.legend?.show === true,
    });

  return builder;
});

const GradientViz = ({ scheme }: { scheme: string }) => {
  const stops = useSchemeGradientStops(scheme);
  return (
    <div
      style={{
        height: '8px',
        width: '100%',
        margin: '2px 0',
        borderRadius: '3px',
        opacity: 1,
        background: `linear-gradient(90deg, ${stops.join(',')})`,
      }}
    />
  );
};
