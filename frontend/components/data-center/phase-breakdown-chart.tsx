"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts"

import type { PhaseBreakdown } from "@/lib/data-center-types"

interface PhaseBreakdownChartProps {
  data: PhaseBreakdown[]
}

const PHASE_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f59e0b", // amber - highlight for visual generation
  "#10b981", // emerald
  "#ec4899", // pink
]

export function PhaseBreakdownChart({ data }: PhaseBreakdownChartProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">五阶段成本消耗分布</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 5, right: 50, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
            <XAxis 
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `${value}元`}
            />
            <YAxis 
              type="category"
              dataKey="phase"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              width={75}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                if (name === "cost") return [`${value.toFixed(1)} 元`, "成本"]
                return [value, name]
              }}
            />
            <Bar 
              dataKey="cost" 
              name="成本"
              radius={[0, 4, 4, 0]}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={PHASE_COLORS[index]}
                  opacity={entry.phase === "视觉生成" ? 1 : 0.7}
                />
              ))}
              <LabelList 
                dataKey="cost" 
                position="right" 
                formatter={(value: number) => `${value.toFixed(1)}元`}
                style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary stats below chart */}
      <div className="mt-4 flex flex-wrap gap-3">
        {data.map((phase, idx) => (
          <div 
            key={phase.phase}
            className={`flex items-center gap-2 rounded-md px-2 py-1 ${phase.phase === "视觉生成" ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-secondary/30"}`}
          >
            <div 
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PHASE_COLORS[idx] }}
            />
            <span className="text-[10px] text-muted-foreground">{phase.phase}</span>
            <span className="text-[10px] font-medium text-foreground">{phase.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
