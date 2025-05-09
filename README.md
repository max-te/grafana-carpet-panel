# Carpet Panel

This is a Grafana panel plugin that displays a carpet plot.
It's a spiritual successor to the Marcus Olsson's [Hourly Heatmap panel](https://grafana.com/grafana/plugins/marcusolsson-hourly-heatmap-panel/).
It was build with [Konva](https://konvajs.org/) and [react-konva](https://www.npmjs.com/package/react-konva), focusing on performance on large time ranges and precise rendering.

![Screenshot](src/img/screenshot.png)

## Building

This project uses [Bun](https://bun.sh/) as a package manager and build tool.
Install dependencies with `bun install` and build with `bun run build`.
