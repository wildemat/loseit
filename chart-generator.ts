import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { chromium } from 'playwright';

export interface ChartData {
  x: any[];
  y: any[];
  name?: string;
  type?: 'scatter' | 'bar' | 'line';
  mode?: 'lines' | 'markers' | 'lines+markers';
}

export interface ChartConfig {
  title: string;
  xaxis_title?: string;
  yaxis_title?: string;
  chart_type?: 'scatter' | 'bar' | 'line';
  traces: ChartData[];
  width?: number;
  height?: number;
}

export async function generateChart(config: ChartConfig, openInBrowser = true): Promise<{ filepath: string; imageData?: string }> {
  const {
    title,
    xaxis_title = 'X',
    yaxis_title = 'Y',
    traces,
    width = 1000,
    height = 600,
  } = config;

  // Build Plotly traces
  const plotlyTraces = traces.map(trace => {
    return {
      x: trace.x,
      y: trace.y,
      name: trace.name || '',
      type: trace.type || 'scatter',
      mode: trace.mode || 'lines+markers',
    };
  });

  const html = `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        #chart {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 20px;
        }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const data = ${JSON.stringify(plotlyTraces, null, 2)};

        const layout = {
            title: '${title}',
            xaxis: { title: '${xaxis_title}' },
            yaxis: { title: '${yaxis_title}' },
            width: ${width},
            height: ${height},
            hovermode: 'closest'
        };

        Plotly.newPlot('chart', data, layout);
    </script>
</body>
</html>`;

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlFilename = `chart-${timestamp}.html`;
  const htmlFilepath = join(tmpdir(), htmlFilename);
  const pngFilename = `chart-${timestamp}.png`;
  const pngFilepath = join(tmpdir(), pngFilename);

  // Write HTML file
  writeFileSync(htmlFilepath, html, 'utf-8');

  // Generate PNG screenshot using Playwright
  let imageData: string | undefined;
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: {
        width: width + 100,
        height: height + 100,
      },
    });

    await page.goto(`file://${htmlFilepath}`);

    // Wait for Plotly to render
    await page.waitForFunction(() => {
      const element = document.querySelector('#chart .plotly');
      return element !== null;
    }, { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: pngFilepath, fullPage: false });
    await browser.close();

    // Read the PNG as base64
    const imageBuffer = readFileSync(pngFilepath);
    imageData = imageBuffer.toString('base64');
  } catch (error) {
    console.error('Failed to generate PNG:', error);
    // Continue without image data
  }

  // Optionally open in browser
  if (openInBrowser) {
    try {
      const command = process.platform === 'darwin' ? 'open'
                    : process.platform === 'win32' ? 'start'
                    : 'xdg-open';
      execSync(`${command} "${htmlFilepath}"`, { stdio: 'ignore' });
    } catch (error) {
      console.error('Failed to open browser:', error);
    }
  }

  return { filepath: pngFilepath, imageData };
}
