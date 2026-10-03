import { FieldType, getFieldDisplayName, type DataFrame, type Field } from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { isCategoricalField, type CellValue } from './categories';

/** One carpet band: a value field and the time field of its frame */
export interface Series {
  name: string;
  timeField: Field<number>;
  valueField: Field<CellValue>;
}

export function findTimeField(frame: DataFrame, timeFieldName: string | undefined): Field | undefined {
  return timeFieldName
    ? frame.fields.find((f) => f.name === timeFieldName || f.config.displayNameFromDS === timeFieldName)
    : frame.fields.find((f) => f.type === FieldType.time);
}

function collectSeries(
  frames: DataFrame[],
  options: CarpetPanelOptions,
  isValueField: (field: Field) => boolean
): Series[] {
  const valueFieldName = options.valueField?.name;
  return frames.flatMap((frame) => {
    const timeField = findTimeField(frame, options.timeFieldName);
    if (!timeField) {
      return [];
    }
    return frame.fields.flatMap((field) => {
      if (field === timeField || !isValueField(field)) {
        return [];
      }
      const name = getFieldDisplayName(field, frame, frames);
      if (
        valueFieldName &&
        field.name !== valueFieldName &&
        field.config.displayNameFromDS !== valueFieldName &&
        name !== valueFieldName
      ) {
        return [];
      }
      return [{ name, timeField: timeField as Field<number>, valueField: field as Field<CellValue> }];
    });
  });
}

/**
 * Finds every value field with a time field in its frame, in frame and field order.
 *
 * Number fields take precedence; categorical fields count only when there are none,
 * since both kinds cannot share one color scale.
 */
export function findSeries(frames: DataFrame[], options: CarpetPanelOptions): Series[] {
  const numberSeries = collectSeries(frames, options, (f) => f.type === FieldType.number);
  return numberSeries.length > 0 ? numberSeries : collectSeries(frames, options, isCategoricalField);
}
