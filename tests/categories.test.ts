import { describe, it, expect } from 'vitest';
import { createTheme, FieldType, MappingType } from '@grafana/data';
import { makeCategoryColors } from '../src/components/categories';

const theme = createTheme();
const paletteColor = (index: number) =>
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  theme.visualization.getColorByName(theme.visualization.palette[index]!);

describe('makeCategoryColors', () => {
  it('assigns palette colors to strings in ascending order, skipping nulls', () => {
    const colors = makeCategoryColors(
      { type: FieldType.string, values: ['idle', null, 'busy', 'idle', 'away'], config: {} },
      theme
    );
    expect([...colors]).toEqual([
      ['away', paletteColor(0)],
      ['busy', paletteColor(1)],
      ['idle', paletteColor(2)],
    ]);
  });

  it('prefers the color of a value mapping', () => {
    const colors = makeCategoryColors(
      {
        type: FieldType.string,
        values: ['away', 'busy', 'idle'],
        config: {
          mappings: [
            { type: MappingType.ValueToText, options: { busy: { color: 'red' }, idle: { text: 'Idle' } } },
            { type: MappingType.RegexToText, options: { pattern: '/^a/', result: { color: '#123456' } } },
          ],
        },
      },
      theme
    );
    expect(colors.get('away')).toBe('#123456');
    expect(colors.get('busy')).toBe(theme.visualization.getColorByName('red'));
    // A mapping without a color leaves the category its palette color
    expect(colors.get('idle')).toBe(paletteColor(2));
  });

  it('keeps Grafana colors for booleans', () => {
    const colors = makeCategoryColors({ type: FieldType.boolean, values: [true, false], config: {} }, theme);
    expect(colors.get(true)).toBe(theme.visualization.getColorByName('green'));
    expect(colors.get(false)).toBe(theme.visualization.getColorByName('red'));
  });

  it('uses the colors of an enum', () => {
    const colors = makeCategoryColors(
      { type: FieldType.enum, values: [1, 0], config: { type: { enum: { text: ['off', 'on'], color: ['blue'] } } } },
      theme
    );
    expect([...colors.keys()]).toEqual([0, 1]);
    expect(colors.get(0)).toBe(theme.visualization.getColorByName('blue'));
    expect(colors.get(0)).toMatch(/^#/);
    expect(colors.get(1)).toBe(paletteColor(1));
  });
});
