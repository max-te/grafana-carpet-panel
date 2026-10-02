// Must be imported before anything that loads @grafana/runtime, whose config reads it on evaluation
Object.assign(window, {
  grafanaBootData: {
    assets: { dark: '', light: '' },
    settings: {},
    user: { timezone: 'browser', weekStart: 'monday', theme: 'light' },
    navTree: [],
  },
});
