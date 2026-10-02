import { EventBusSrv, LoadingState, standardEditorsRegistry } from '@grafana/data';
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
