"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts"

import type { TrendDataPoint } from "@/lib/data-center-types"

interface CostTrendChartProps {
  data: TrendDataPoint[]
  budgetLine?: number
}

export function CostTrendChart({ data, budgetLine = 200 }: CostTrendChartProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">每日效能与成本趋势</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `${value}元`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `${value}分钟`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend 
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>}
            />
            
            {/* Budget red line */}
            <ReferenceLine 
              yAxisId="left"
              y={budgetLine} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{ 
                value: `${budgetLine}元红线`, 
                fill: "hsl(var(--destructive))", 
                fontSize: 10,
                position: "right"
              }}
            />
            
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="costPerMinute" 
              name="单分钟成本 (元)"
              stroke="#f59e0b" 
              strokeWidth={2}
              dot={{ fill: "#f59e0b", strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="outputMinutes" 
              name="产出分钟数"
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
