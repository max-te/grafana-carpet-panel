// Schemes from d3-scale-chromatic
// https://github.com/d3/d3-scale-chromatic
// This is the same mapping of the d3 color-maps as the official Grafana Heatmap panel uses, to provide a consistent UX.
// https://github.com/grafana/grafana/blob/3d9989a04af12dbe5bf366f9d6e44867dd758ac7/public/app/plugins/panel/heatmap/palettes.ts
export const colorSchemes = [
  // Diverging
  { name: 'BrBG', invert: 'always' },
  { name: 'PiYG', invert: 'always' },
  { name: 'PRGn', invert: 'always' },
  { name: 'PuOr', invert: 'always' },
  { name: 'RdBu', invert: 'always' },
  { name: 'RdGy', invert: 'always' },
  { name: 'RdYlBu', invert: 'always' },
  { name: 'RdYlGn', invert: 'always' },
  { name: 'Spectral', invert: 'always' },

  // Sequential (Single Hue)
  { name: 'Blues', invert: 'dark' },
  { name: 'Greens', invert: 'dark' },
  { name: 'Greys', invert: 'dark' },
  { name: 'Oranges', invert: 'dark' },
  { name: 'Purples', invert: 'dark' },
  { name: 'Reds', invert: 'dark' },

  // Sequential (Multi-Hue)
  { name: 'Turbo', invert: 'light' },
  { name: 'Cividis', invert: 'light' },
  { name: 'Viridis', invert: 'light' },
  { name: 'Magma', invert: 'light' },
  { name: 'Inferno', invert: 'light' },
  { name: 'Plasma', invert: 'light' },
  { name: 'Warm', invert: 'light' },
  { name: 'Cool', invert: 'light' },
  { name: 'CubehelixDefault', invert: 'light' },
  { name: 'BuGn', invert: 'dark' },
  { name: 'BuPu', invert: 'dark' },
  { name: 'GnBu', invert: 'dark' },
  { name: 'OrRd', invert: 'dark' },
  { name: 'PuBuGn', invert: 'dark' },
  { name: 'PuBu', invert: 'dark' },
  { name: 'PuRd', invert: 'dark' },
  { name: 'RdPu', invert: 'dark' },
  { name: 'YlGnBu', invert: 'dark' },
  { name: 'YlGn', invert: 'dark' },
  { name: 'YlOrBr', invert: 'dark' },
  { name: 'YlOrRd', invert: 'dark' },

  // Cyclical
  { name: 'Rainbow', invert: 'always' },
  { name: 'Sinebow', invert: 'always' },
];
