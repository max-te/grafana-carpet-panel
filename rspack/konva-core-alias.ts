// The default react-konva entry imports all of Konva, including filters.
// The core entry leaves shapes outside Konva's core to be imported where used.
// Exact match, so that react-konva/lib/* subpaths still resolve.
export const konvaCoreAlias = {
  'react-konva$': 'react-konva/lib/ReactKonvaCore',
};
