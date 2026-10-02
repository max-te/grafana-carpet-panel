import './bootData';
import { getThemeById, ThemeContext } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Box, GlobalStyles, PortalContainer, RadioButtonGroup, Stack, Tab, TabsBar, Text } from '@grafana/ui';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { installRuntime } from './runtime';
import { type Scenario, scenarios } from './scenarios';

installRuntime();

function useHash(): string {
  const [hash, setHash] = React.useState(() => window.location.hash.slice(1));
  React.useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash.slice(1));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);
  return hash;
}

const ScenarioView: React.FC<{ scenario: Scenario }> = ({ scenario }) => {
  const [scene] = React.useState(() => scenario.build());
  return <scene.Component model={scene} />;
};

const ScenesHarness: React.FC = () => {
  const hash = useHash();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const scenario = scenarios.find((s) => s.id === hash) ?? scenarios[0]!;
  const [themeId, setThemeId] = React.useState<'light' | 'dark'>('light');
  const theme = getThemeById(themeId);
  const changeTheme = (id: 'light' | 'dark') => {
    // VizPanel processes fields against the global theme, not the context
    config.theme2 = getThemeById(id);
    setThemeId(id);
  };

  return (
    <ThemeContext value={theme}>
      <GlobalStyles />
      <PortalContainer />
      <Box padding={2}>
        <Stack direction="column" gap={2}>
          <Stack justifyContent="space-between" alignItems="center">
            <TabsBar>
              {scenarios.map((s) => (
                <Tab key={s.id} label={s.title} href={`#${s.id}`} active={s === scenario} />
              ))}
            </TabsBar>
            <RadioButtonGroup
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={themeId}
              onChange={changeTheme}
            />
          </Stack>
          <Text color="secondary">{scenario.description}</Text>
          <ScenarioView key={`${scenario.id}-${themeId}`} scenario={scenario} />
        </Stack>
      </Box>
    </ThemeContext>
  );
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('No root element found');
}
createRoot(container).render(
  <React.StrictMode>
    <ScenesHarness />
  </React.StrictMode>
);
