# Chart Generation Example

## Before: Manual HTML Generation (Slow)

Claude Desktop would manually write HTML like this:

```bash
cd /home/claude && cat > protein_surplus_chart.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Protein vs Calorie Surplus</title>
    <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
    <style>
        body { ... }
        /* 30+ lines of HTML/CSS/JS */
    </style>
</head>
...
EOF
```

**Problems:**
- Verbose (100+ lines of code)
- Slow to generate
- Error-prone
- Hard to modify

## After: MCP Tool (Fast)

With the `create_chart` MCP tool, Claude Desktop simply calls:

```typescript
// Claude would call this MCP tool:
create_chart({
  title: "Protein vs Calorie Surplus",
  xaxis_title: "Protein (g)",
  yaxis_title: "Calorie Surplus",
  traces: [
    {
      x: [120, 135, 140, 125, 130],
      y: [200, -50, 100, -100, 0],
      name: "Daily Data",
      mode: "markers",
      type: "scatter"
    }
  ]
})
```

**Benefits:**
- ✅ 5 lines instead of 100+
- ✅ Instant generation
- ✅ Auto-opens in browser
- ✅ Clean, reusable
- ✅ Works with any data format

## Example: Using with Your LoseIt Data

```typescript
// Get data first
const calories = get_calories({
  start_date: "11/01/2024",
  end_date: "11/30/2024"
})

// Extract dates and values
const dates = calories.records.map(r => r.date)
const surplus = calories.records.map(r => r.surplus_deficit)

// Create chart instantly
create_chart({
  title: "November Calorie Surplus/Deficit",
  xaxis_title: "Date",
  yaxis_title: "Calories",
  traces: [
    {
      x: dates,
      y: surplus,
      name: "Surplus/Deficit",
      mode: "lines+markers",
      type: "scatter"
    }
  ]
})
```

## Multiple Series Example

```typescript
// Compare weight and calories over time
create_chart({
  title: "Weight vs Calories",
  xaxis_title: "Date",
  yaxis_title: "Value",
  traces: [
    {
      x: dates,
      y: weights,
      name: "Weight (lbs)",
      mode: "lines",
      type: "scatter"
    },
    {
      x: dates,
      y: calories,
      name: "Calories / 10",
      mode: "lines",
      type: "scatter"
    }
  ]
})
```

## Setup

Your MCP server is already configured! Just restart Claude Desktop to pick up the new tool:

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. The `create_chart` tool will be available

## Testing

You can test it by asking Claude Desktop:

> "Get my calories for the last 30 days and create a chart showing my daily surplus/deficit"

Claude will:
1. Call `get_calories` to fetch your data
2. Call `create_chart` with the formatted data
3. Chart automatically opens in your browser
