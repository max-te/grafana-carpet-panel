import {
  EventBusSrv,
  FieldConfigProperty,
  LoadingState,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  valueMappingsOverrideProcessor,
  type ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { setAppEvents, setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { sceneUtils } from '@grafana/scenes';
import { from, map } from 'rxjs';
import { plugin } from '../../src/module';
import { CarpetTestDataSource } from './dataSource';

export const carpetPluginId = 'maxte-carpet-panel';

/** Stands in for the services Grafana installs at startup, as far as scenes depends on them. */
export function installRuntime() {
  // Option builders require registered editors; the harness never renders them
  standardEditorsRegistry.setInit(() =>
    [
      'boolean',
      'color',
      'dashboard-uid',
      'field-name',
      'multi-select',
      'number',
      'radio',
      'select',
      'slider',
      'strings',
      'text',
      'timezone',
      'unit',
    ].map((id) => ({ id, name: id, editor: () => null }))
  );
  // Grafana registers every standard field option at startup; the panel enables only mappings and thresholds
  standardFieldConfigEditorRegistry.setInit(() => [
    {
      id: 'mappings',
      path: 'mappings',
      name: 'Value mappings',
      editor: () => null,
      override: () => null,
      process: valueMappingsOverrideProcessor,
      shouldApply: () => true,
      defaultValue: [],
    },
    {
      id: FieldConfigProperty.Thresholds,
      path: FieldConfigProperty.Thresholds,
      name: 'Thresholds',
      editor: () => null,
      override: () => null,
      process: (value: ThresholdsConfig) => value,
      shouldApply: () => true,
      defaultValue: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
    },
  ]);
  setAppEvents(new EventBusSrv());
  setPluginImportUtils({
    importPanelPlugin: (id) => Promise.reject(new Error(`Panel plugin ${id} is not available in the harness`)),
    getPanelPluginFromCache: () => undefined,
  });
  setRunRequest((dataSource, request) =>
    from(dataSource.query(request)).pipe(
      map((response) => ({ state: LoadingState.Done, series: response.data, timeRange: request.range }))
    )
  );
  sceneUtils.registerRuntimePanelPlugin({ pluginId: carpetPluginId, plugin });
  sceneUtils.registerRuntimeDataSource({ dataSource: new CarpetTestDataSource() });
}
