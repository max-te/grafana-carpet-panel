# Changelog

## 0.13.0 — 2026-06-25

### Breaking

- **React**: Upgrade react, react-dom 18.3.1 → 19.2.4 (matching Grafana 13's runtime).
  Upgrade react-konva 18.2.16 → 19.2.5, react-konva-utils 1.1.3 → 2.0.0.
- **Grafana**: Upgrade @grafana/data, @grafana/runtime, @grafana/ui 12.4.0 → 13.1.0.
  Minimum Grafana version changed to 13.1.0.
- **Config**: Remove `.npmrc` — `react-data-grid` exotic subdep resolved upstream
  in @grafana/ui@13.1.0 (grafana/grafana#124873).

### Maintenance

- **TS**: Upgrade TypeScript 4.8.4 → ^5.8.0 — resolves all `@typescript-eslint/no-unsafe-*`
  false positives from typescript-eslint.
- **ESLint**: Upgrade @eslint-react/eslint-plugin 1.x → 5.x, eslint-webpack-plugin 4.x → 6.x,
  eslint-plugin-deprecation 2.x → 3.x. Integrate @grafana/eslint-config v10, adopt peer deps
  (eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-jsdoc, @stylistic/eslint-plugin,
  eslint-config-prettier). Remove @types/eslint (eslint 10 bundles own types).
- **Deps**: Update safe minor/patch deps — biome 2.5.1, playwright 1.61.1, rspack 1.7.12,
  vitest 4.1.9, typescript-eslint 8.62.0, happy-dom 20.10.6, ts-checker-rspack-plugin 1.4.0.
- **Lint**: Fix `satisfies never` parse error in useColorScale.ts; fix 22 lint issues surfaced
  by grafana config (eqeqeq, curly, hook deps, display-name, array-type, no-inferrable-types).
- **Format**: Apply biome formatting pass.
