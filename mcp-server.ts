#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { executeQuery } from './db/connection.js';
import { generateChart, ChartConfig } from './chart-generator.js';

// Date parsing helper
function parseDateInput(input: string): string {
  if (input === 'today') {
    return formatDate(new Date());
  }
  if (input === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(input)) {
    throw new Error('Date must be in MM/DD/YYYY format');
  }
  return input;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Tool implementations
async function getWeight(args: any) {
  const { date, start_date, end_date } = args;

  let query = 'SELECT date, weight, body_fat FROM markers WHERE ';
  const conditions: string[] = [];

  if (date) {
    const parsedDate = parseDateInput(date);
    conditions.push(`date = '${parsedDate}'`);
  } else if (start_date && end_date) {
    const parsedStart = parseDateInput(start_date);
    const parsedEnd = parseDateInput(end_date);
    conditions.push(`date >= '${parsedStart}' AND date <= '${parsedEnd}'`);
  } else {
    throw new Error('Must provide either date or both start_date and end_date');
  }

  conditions.push('(weight IS NOT NULL OR body_fat IS NOT NULL)');
  query += conditions.join(' AND ') + ' ORDER BY date';

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { records: [], summary: null };
  }

  const records = result.values.map((row: any) => ({
    date: row[0],
    weight: row[1],
    body_fat: row[2],
  }));

  // Calculate summary for date ranges
  let summary = null;
  if (records.length > 1) {
    const weights = records.map((r: any) => r.weight).filter((w: any) => w != null);
    if (weights.length > 0) {
      summary = {
        avg_weight: weights.reduce((a: number, b: number) => a + b, 0) / weights.length,
        min_weight: Math.min(...weights),
        max_weight: Math.max(...weights),
        weight_change: weights[weights.length - 1] - weights[0],
      };
    }
  }

  return { records, summary };
}

async function getCalories(args: any) {
  const { date, start_date, end_date } = args;

  let query = `
    SELECT
      date,
      food_calories,
      exercise_calories,
      calorie_budget,
      tdee
    FROM calories
    WHERE `;

  if (date) {
    const parsedDate = parseDateInput(date);
    query += `date = '${parsedDate}'`;
  } else if (start_date && end_date) {
    const parsedStart = parseDateInput(start_date);
    const parsedEnd = parseDateInput(end_date);
    query += `date >= '${parsedStart}' AND date <= '${parsedEnd}'`;
  } else {
    throw new Error('Must provide either date or both start_date and end_date');
  }

  query += ' ORDER BY date';

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { records: [], summary: null };
  }

  const records = result.values.map((row: any) => {
    const food = row[1] || 0;
    const exercise = row[2] || 0;
    const budget = row[3] || 0;
    return {
      date: row[0],
      food_calories: row[1],
      exercise_calories: row[2],
      calorie_budget: row[3],
      tdee: row[4],
      net_calories: food - exercise,
      surplus_deficit: food - budget,
    };
  });

  // Calculate summary for date ranges
  let summary = null;
  if (records.length > 1) {
    const validRecords = records.filter((r: any) => r.food_calories != null);
    if (validRecords.length > 0) {
      summary = {
        avg_food_calories: validRecords.reduce((sum: number, r: any) => sum + (r.food_calories || 0), 0) / validRecords.length,
        avg_net_calories: validRecords.reduce((sum: number, r: any) => sum + r.net_calories, 0) / validRecords.length,
        total_surplus_deficit: validRecords.reduce((sum: number, r: any) => sum + r.surplus_deficit, 0),
        days_over_budget: validRecords.filter((r: any) => r.surplus_deficit > 0).length,
        days_under_budget: validRecords.filter((r: any) => r.surplus_deficit <= 0).length,
      };
    }
  }

  return { records, summary };
}

async function getActivity(args: any) {
  const { date, start_date, end_date } = args;

  let query = 'SELECT date, steps, sleep_hours, exercise_minutes, exercise_count FROM activity WHERE ';

  if (date) {
    const parsedDate = parseDateInput(date);
    query += `date = '${parsedDate}'`;
  } else if (start_date && end_date) {
    const parsedStart = parseDateInput(start_date);
    const parsedEnd = parseDateInput(end_date);
    query += `date >= '${parsedStart}' AND date <= '${parsedEnd}'`;
  } else {
    throw new Error('Must provide either date or both start_date and end_date');
  }

  query += ' ORDER BY date';

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { records: [], summary: null };
  }

  const records = result.values.map((row: any) => ({
    date: row[0],
    steps: row[1],
    sleep_hours: row[2],
    exercise_minutes: row[3],
    exercise_count: row[4],
  }));

  // Calculate summary for date ranges
  let summary = null;
  if (records.length > 1) {
    const stepsData = records.filter((r: any) => r.steps != null).map((r: any) => r.steps);
    const sleepData = records.filter((r: any) => r.sleep_hours != null).map((r: any) => r.sleep_hours);
    const exerciseRecords = records.filter((r: any) => r.exercise_count > 0);

    summary = {
      avg_steps: stepsData.length > 0 ? stepsData.reduce((a: number, b: number) => a + b, 0) / stepsData.length : null,
      avg_sleep_hours: sleepData.length > 0 ? sleepData.reduce((a: number, b: number) => a + b, 0) / sleepData.length : null,
      total_exercise_minutes: exerciseRecords.reduce((sum: number, r: any) => sum + (r.exercise_minutes || 0), 0),
      days_exercised: exerciseRecords.length,
    };
  }

  return { records, summary };
}

async function getMacros(args: any) {
  const { date, start_date, end_date } = args;

  let query = 'SELECT date, protein_grams, carbs_grams, fiber_grams FROM macros WHERE ';

  if (date) {
    const parsedDate = parseDateInput(date);
    query += `date = '${parsedDate}'`;
  } else if (start_date && end_date) {
    const parsedStart = parseDateInput(start_date);
    const parsedEnd = parseDateInput(end_date);
    query += `date >= '${parsedStart}' AND date <= '${parsedEnd}'`;
  } else {
    throw new Error('Must provide either date or both start_date and end_date');
  }

  query += ' ORDER BY date';

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { records: [], summary: null };
  }

  const records = result.values.map((row: any) => ({
    date: row[0],
    protein_grams: row[1],
    carbs_grams: row[2],
    fiber_grams: row[3],
    protein_calories: row[1] ? row[1] * 4 : null,
    carb_calories: row[2] ? row[2] * 4 : null,
  }));

  // Calculate summary for date ranges
  let summary = null;
  if (records.length > 1) {
    const validRecords = records.filter((r: any) => r.protein_grams != null || r.carbs_grams != null);
    if (validRecords.length > 0) {
      summary = {
        avg_protein: validRecords.reduce((sum: number, r: any) => sum + (r.protein_grams || 0), 0) / validRecords.length,
        avg_carbs: validRecords.reduce((sum: number, r: any) => sum + (r.carbs_grams || 0), 0) / validRecords.length,
        avg_fiber: validRecords.reduce((sum: number, r: any) => sum + (r.fiber_grams || 0), 0) / validRecords.length,
      };
    }
  }

  return { records, summary };
}

async function getFoodLogs(args: any) {
  const { date, start_date, end_date, meal, search, limit = 100 } = args;

  let query = 'SELECT date, food_name, meal, quantity, units, calories, nutrients FROM food WHERE ';
  const conditions: string[] = [];

  if (date) {
    const parsedDate = parseDateInput(date);
    conditions.push(`date = '${parsedDate}'`);
  } else if (start_date && end_date) {
    const parsedStart = parseDateInput(start_date);
    const parsedEnd = parseDateInput(end_date);
    conditions.push(`date >= '${parsedStart}' AND date <= '${parsedEnd}'`);
  }

  if (meal) {
    conditions.push(`meal = '${meal.replace(/'/g, "''")}'`);
  }

  if (search) {
    conditions.push(`food_name LIKE '%${search.replace(/'/g, "''")}%'`);
  }

  if (conditions.length === 0) {
    throw new Error('Must provide date, date range, or search criteria');
  }

  query += conditions.join(' AND ') + ` ORDER BY date LIMIT ${limit}`;

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { records: [], summary: null };
  }

  const records = result.values.map((row: any) => {
    let nutrients = {};
    try {
      // PostgreSQL returns JSONB as object directly
      nutrients = typeof row[6] === 'string' ? JSON.parse(row[6]) : row[6] || {};
    } catch (e) {
      // Ignore parse errors
    }

    return {
      date: row[0],
      food_name: row[1],
      meal: row[2],
      quantity: row[3],
      units: row[4],
      calories: row[5],
      nutrients,
    };
  });

  // Calculate summary
  const totalCalories = records.reduce((sum: number, r: any) => sum + (r.calories || 0), 0);
  const byMeal: Record<string, number> = {};
  records.forEach((r: any) => {
    if (r.meal) {
      byMeal[r.meal] = (byMeal[r.meal] || 0) + (r.calories || 0);
    }
  });

  const summary = {
    total_entries: records.length,
    total_calories: totalCalories,
    by_meal: byMeal,
  };

  return { records, summary };
}

async function getDailySummary(args: any) {
  const { date } = args;

  if (!date) {
    throw new Error('date parameter is required');
  }

  const parsedDate = parseDateInput(date);

  const query = `
    SELECT
      '${parsedDate}' as date,
      m.weight,
      m.body_fat,
      c.food_calories,
      c.exercise_calories,
      c.calorie_budget,
      c.tdee,
      a.steps,
      a.sleep_hours,
      a.exercise_minutes,
      a.exercise_count,
      mac.protein_grams,
      mac.carbs_grams,
      mac.fiber_grams
    FROM (SELECT '${parsedDate}' as date) d
    LEFT JOIN markers m ON d.date = m.date
    LEFT JOIN calories c ON d.date = c.date
    LEFT JOIN activity a ON d.date = a.date
    LEFT JOIN macros mac ON d.date = mac.date
  `;

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { date: parsedDate, message: 'No data found for this date' };
  }

  const row = result.values[0];

  // Get food summary
  const foodQuery = `SELECT COUNT(*) as count, meal, SUM(calories) as total FROM food WHERE date = '${parsedDate}' GROUP BY meal`;
  const foodResult = await executeQuery(foodQuery);

  const byMeal: Record<string, number> = {};
  let totalItems = 0;

  if (foodResult.values.length > 0) {
    foodResult.values.forEach((foodRow: any) => {
      totalItems += foodRow[0] as number;
      byMeal[foodRow[1] as string] = foodRow[2] as number;
    });
  }

  return {
    date: parsedDate,
    markers: row[1] || row[2] ? {
      weight: row[1],
      body_fat: row[2],
    } : null,
    calories: row[3] || row[4] || row[5] || row[6] ? {
      food_calories: row[3],
      exercise_calories: row[4],
      calorie_budget: row[5],
      tdee: row[6],
      net_calories: ((row[3] as number) || 0) - ((row[4] as number) || 0),
      surplus_deficit: ((row[3] as number) || 0) - ((row[5] as number) || 0),
    } : null,
    activity: row[7] || row[8] || row[9] ? {
      steps: row[7],
      sleep_hours: row[8],
      exercise_minutes: row[9],
      exercise_count: row[10],
    } : null,
    macros: row[11] || row[12] || row[13] ? {
      protein_grams: row[11],
      carbs_grams: row[12],
      fiber_grams: row[13],
    } : null,
    food_summary: totalItems > 0 ? {
      total_items: totalItems,
      by_meal: byMeal,
    } : null,
  };
}

async function getTrends(args: any) {
  const { start_date, end_date, metrics, group_by = 'day' } = args;

  if (!start_date || !end_date) {
    throw new Error('start_date and end_date are required');
  }

  if (!metrics || metrics.length === 0) {
    throw new Error('metrics array is required');
  }

  const parsedStart = parseDateInput(start_date);
  const parsedEnd = parseDateInput(end_date);

  // Build metric selections
  const metricMap: Record<string, string> = {
    weight: 'm.weight',
    body_fat: 'm.body_fat',
    calories: 'c.food_calories',
    exercise_calories: 'c.exercise_calories',
    calorie_budget: 'c.calorie_budget',
    tdee: 'c.tdee',
    steps: 'a.steps',
    sleep_hours: 'a.sleep_hours',
    exercise_minutes: 'a.exercise_minutes',
    protein: 'mac.protein_grams',
    carbs: 'mac.carbs_grams',
    fiber: 'mac.fiber_grams',
  };

  const selections = metrics.map((m: string) => {
    const column = metricMap[m];
    if (!column) {
      throw new Error(`Unknown metric: ${m}`);
    }
    return `AVG(${column}) as ${m}`;
  }).join(', ');

  let groupByClause = '';
  let periodLabel = 'c.date';

  if (group_by === 'week') {
    // PostgreSQL: Convert date string (MM/DD/YYYY format) and format as ISO year-week
    groupByClause = `TO_CHAR(TO_DATE(c.date, 'MM/DD/YYYY'), 'IYYY-IW')`;
    periodLabel = groupByClause;
  } else if (group_by === 'month') {
    // PostgreSQL: Extract year-month from date string (MM/DD/YYYY format)
    groupByClause = `TO_CHAR(TO_DATE(c.date, 'MM/DD/YYYY'), 'YYYY-MM')`;
    periodLabel = groupByClause;
  } else {
    groupByClause = 'c.date';
  }

  const query = `
    SELECT
      ${periodLabel} as period_label,
      ${selections}
    FROM calories c
    LEFT JOIN markers m ON c.date = m.date
    LEFT JOIN activity a ON c.date = a.date
    LEFT JOIN macros mac ON c.date = mac.date
    WHERE c.date >= '${parsedStart}' AND c.date <= '${parsedEnd}'
    GROUP BY ${groupByClause}
    ORDER BY ${groupByClause}
  `;

  const result = await executeQuery(query);

  if (result.values.length === 0) {
    return { period: group_by, data: [], statistics: null };
  }

  const data = result.values.map((row: any) => {
    const record: any = { period_label: row[0] };
    metrics.forEach((metric: string, idx: number) => {
      record[metric] = row[idx + 1];
    });
    return record;
  });

  // Calculate statistics
  const statistics: any = {};
  metrics.forEach((metric: string, idx: number) => {
    const values = data.map((d: any) => d[metric]).filter((v: any) => v != null);
    if (values.length > 0) {
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      // Simple trend calculation
      let trend = 'stable';
      if (values.length >= 2) {
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;

        if (secondAvg > firstAvg * 1.05) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.95) trend = 'decreasing';
      }

      statistics[metric] = { avg, min, max, trend };
    }
  });

  return { period: group_by, data, statistics };
}

// Main server setup
const server = new Server(
  {
    name: 'loseit-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_weight',
        description: 'Get weight and body fat measurements for a specific date or date range',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date (MM/DD/YYYY)' },
            start_date: { type: 'string', description: 'Range start (MM/DD/YYYY)' },
            end_date: { type: 'string', description: 'Range end (MM/DD/YYYY)' },
          },
        },
      },
      {
        name: 'get_calories',
        description: 'Get calorie intake, expenditure, and budget data',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date (MM/DD/YYYY)' },
            start_date: { type: 'string', description: 'Range start (MM/DD/YYYY)' },
            end_date: { type: 'string', description: 'Range end (MM/DD/YYYY)' },
          },
        },
      },
      {
        name: 'get_activity',
        description: 'Get physical activity data including steps, sleep, and exercise',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date (MM/DD/YYYY)' },
            start_date: { type: 'string', description: 'Range start (MM/DD/YYYY)' },
            end_date: { type: 'string', description: 'Range end (MM/DD/YYYY)' },
          },
        },
      },
      {
        name: 'get_macros',
        description: 'Get macronutrient intake (protein, carbs, fiber)',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date (MM/DD/YYYY)' },
            start_date: { type: 'string', description: 'Range start (MM/DD/YYYY)' },
            end_date: { type: 'string', description: 'Range end (MM/DD/YYYY)' },
          },
        },
      },
      {
        name: 'get_food_logs',
        description: 'Get detailed food log entries with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date (MM/DD/YYYY)' },
            start_date: { type: 'string', description: 'Range start (MM/DD/YYYY)' },
            end_date: { type: 'string', description: 'Range end (MM/DD/YYYY)' },
            meal: { type: 'string', description: 'Filter by meal (Breakfast, Lunch, Dinner, Snacks)' },
            search: { type: 'string', description: 'Search food names' },
            limit: { type: 'number', description: 'Maximum results (default: 100)' },
          },
        },
      },
      {
        name: 'get_daily_summary',
        description: 'Get a comprehensive summary combining all data sources for a specific date',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date (MM/DD/YYYY)', required: true },
          },
          required: ['date'],
        },
      },
      {
        name: 'get_trends',
        description: 'Get trend analysis over a date range with aggregation',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (MM/DD/YYYY)', required: true },
            end_date: { type: 'string', description: 'End date (MM/DD/YYYY)', required: true },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to track: weight, body_fat, calories, steps, protein, etc.',
            },
            group_by: { type: 'string', enum: ['day', 'week', 'month'], description: 'Aggregation period (default: day)' },
          },
          required: ['start_date', 'end_date', 'metrics'],
        },
      },
      {
        name: 'create_chart',
        description: 'Create an interactive chart from data and open it in the browser. Supports multiple traces/series.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Chart title', required: true },
            xaxis_title: { type: 'string', description: 'X-axis label' },
            yaxis_title: { type: 'string', description: 'Y-axis label' },
            traces: {
              type: 'array',
              description: 'Array of data series to plot',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'array', description: 'X-axis values' },
                  y: { type: 'array', description: 'Y-axis values' },
                  name: { type: 'string', description: 'Series name for legend' },
                  type: { type: 'string', enum: ['scatter', 'bar', 'line'], description: 'Chart type (default: scatter)' },
                  mode: { type: 'string', enum: ['lines', 'markers', 'lines+markers'], description: 'Display mode (default: lines+markers)' },
                },
                required: ['x', 'y'],
              },
            },
            width: { type: 'number', description: 'Chart width in pixels (default: 1000)' },
            height: { type: 'number', description: 'Chart height in pixels (default: 600)' },
            open_browser: { type: 'boolean', description: 'Open chart in browser (default: true)' },
          },
          required: ['title', 'traces'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    let result;
    switch (name) {
      case 'get_weight':
        result = await getWeight(args);
        break;
      case 'get_calories':
        result = await getCalories(args);
        break;
      case 'get_activity':
        result = await getActivity(args);
        break;
      case 'get_macros':
        result = await getMacros(args);
        break;
      case 'get_food_logs':
        result = await getFoodLogs(args);
        break;
      case 'get_daily_summary':
        result = await getDailySummary(args);
        break;
      case 'get_trends':
        result = await getTrends(args);
        break;
      case 'create_chart':
        const chartConfig: ChartConfig = {
          title: args?.title as string,
          xaxis_title: args?.xaxis_title as string | undefined,
          yaxis_title: args?.yaxis_title as string | undefined,
          traces: args?.traces as any[],
          width: args?.width as number | undefined,
          height: args?.height as number | undefined,
        };
        const { filepath, imageData } = await generateChart(chartConfig, args?.open_browser !== false);

        // Return image data for Claude Desktop to display
        if (imageData) {
          return {
            content: [
              {
                type: 'text',
                text: `Chart created successfully! The chart image is included below.\n\nFilepath: ${filepath}`,
              },
              {
                type: 'image',
                data: imageData,
                mimeType: 'image/png',
              },
            ],
            isError: false,
          };
        }

        result = {
          success: true,
          filepath,
          message: `Chart created and saved to: ${filepath}`,
        };
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            code: 'TOOL_ERROR',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log configuration to stderr (won't interfere with MCP protocol on stdout)
  console.error('LoseIt MCP Server started');
  console.error('Version: 1.0.0');
  console.error('Database:', process.env.DATABASE_URL || 'postgresql://loseit:password@localhost:5432/loseit');
}

main().catch(console.error);
