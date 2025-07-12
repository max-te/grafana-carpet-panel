# Carpet Panel

![Grafana 11+](https://img.shields.io/badge/Grafana-11+-F2F4F9?style=for-the-badge&logo=grafana&logoColor=orange&labelColor=F2F4F9)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

<!-- Once published, these badges can be uncommented and updated with the correct plugin ID
![Downloads](https://img.shields.io/badge/dynamic/json?logo=grafana&query=$.downloads&url=https://grafana.com/api/plugins/maxte-carpet-panel&label=Downloads&color=F47A20)
![Version](https://img.shields.io/badge/dynamic/json?logo=grafana&query=$.version&url=https://grafana.com/api/plugins/maxte-carpet-panel&label=Version&prefix=v&color=F47A20)
-->

The Carpet Panel is a Grafana visualization plugin that displays data as a carpet plot (also known as a time heatmap). It's a spiritual successor to Marcus Olsson's [Hourly Heatmap panel](https://grafana.com/grafana/plugins/marcusolsson-hourly-heatmap-panel/), with improved performance for large time ranges and more consistent spacing between grid cells.

Carpet plots are ideal for visualizing patterns across time periods, such as:
- Daily usage patterns over weeks or months
- Hourly system metrics across days
- Recurring patterns in time series data

![Screenshot](https://github.com/max-te/grafana-carpet-panel/blob/main/src/img/screenshot.png?raw=true)

## Getting Started

1. Add a new panel to your dashboard
2. Select "Carpet-Panel" from the visualization options
3. Configure your query to return time series data
4. In the panel options:
   - Select the time field for your data
   - Select the value field to display
   - Adjust style options as desired

<!-- Add more sections as needed once the plugin is more mature -->
