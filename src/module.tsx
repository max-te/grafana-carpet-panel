import { FieldType, PanelPlugin } from '@grafana/data';
import { HeatmapColorMode, HeatmapColorScale, type CarpetPanelOptions } from './types';
import { CarpetPanel } from './components/CarpetPanel';
import { colorSchemes } from './palettes';

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
        filter: (field) => field.type === FieldType.number,
        // TODO: Add support for categorical data
      },
    })
    .addUnitPicker({
      path: 'valueField.unit',
      name: 'Unit',
      description: 'Unit of the value field',
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

  // TODO: Add options for tooltip customization (format, additional fields, etc.)
  // TODO: Consider adding legend options for better data interpretation

  return builder;
});
