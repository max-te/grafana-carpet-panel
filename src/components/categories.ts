import { FieldColorModeId, FieldType, getDisplayProcessor, type Field, type GrafanaTheme2 } from '@grafana/data';
import * as d3 from 'd3';

export type CellValue = number | string | boolean;

export function isNumberField(field: Field<CellValue>): field is Field<number> {
  return field.type === FieldType.number;
}

export function isCategoricalField(field: Field): boolean {
  return field.type === FieldType.string || field.type === FieldType.boolean || field.type === FieldType.enum;
}

// Grafana returns unknown color names verbatim, so no real color can collide
const UNASSIGNED_COLOR = 'carpet-unassigned';

/**
 * Colors the distinct values of a categorical field, in ascending order.
 *
 * Value mappings, enum colors and Grafana's boolean colors come first; any
 * remaining category takes the classic palette color at its position.
 */
export function makeCategoryColors(
  field: Pick<Field<CellValue | null>, 'type' | 'values' | 'config'>,
  theme: GrafanaTheme2
): Map<CellValue, string> {
  const display = getDisplayProcessor({
    field: {
      name: '',
      ...field,
      config: { ...field.config, color: { mode: FieldColorModeId.Fixed, fixedColor: UNASSIGNED_COLOR } },
    },
    theme,
  });
  const { palette } = theme.visualization;
  const categories = Array.from(new Set(field.values.filter((value) => value != null))).sort(d3.ascending);
  return new Map(
    categories.map((value, index) => {
      const color = display(value).color;
      // Enum colors come back as given, possibly as names
      return [
        value,
        theme.visualization.getColorByName(
          color && color !== UNASSIGNED_COLOR
            ? color
            : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- the palette is never empty
              palette[index % palette.length]!
        ),
      ];
    })
  );
}
