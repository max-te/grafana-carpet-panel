import * as rspack from '@rspack/core';

const PLUGIN_NAME = 'BuildModeRspack';

export class BuildModeRspackPlugin {
  apply(compiler: rspack.Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        async () => {
          const assets = compilation.getAssets();
          for (const asset of assets) {
            if (asset.name.endsWith('plugin.json')) {
              const pluginJsonString = asset.source.source().toString();
              const pluginJsonWithBuildMode = JSON.stringify(
                {
                  ...JSON.parse(pluginJsonString),
                  buildMode: compilation.options.mode,
                },
                null,
                4
              );
              compilation.updateAsset(asset.name, new rspack.sources.RawSource(pluginJsonWithBuildMode));
            }
          }
        }
      );
    });
  }
}
