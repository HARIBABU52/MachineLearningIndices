"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Cell
} from "recharts";
import {
  TrendingUp,
  Percent,
  Activity,
  AlertTriangle,
  Calendar,
  Grid,
  Play,
  RotateCcw,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Info
} from "lucide-react";
import {
  CleanRecord,
  SummaryStats,
  calculateSummaryStats,
  generateMonthlyHeatmap,
  generateHistogram,
  runMonteCarlo,
  CRASH_SCENARIOS,
  HeatmapRow
} from "@/utils/analytics";

interface DashboardProps {
  initialData: CleanRecord[];
}

export default function Dashboard({ initialData }: DashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "technical" | "risk" | "heatmap" | "simulations" | "table">("overview");
  const [timeframe, setTimeframe] = useState<"1M" | "6M" | "1Y" | "5Y" | "ALL">("1Y");
  
  // Monte Carlo parameters
  const [simDays, setSimDays] = useState(252);
  const [simPathsCount, setSimPathsCount] = useState(5);
  const [simulations, setSimulations] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter data based on timeframe
  const filteredData = useMemo(() => {
    if (initialData.length === 0) return [];
    const latestTimestamp = initialData[initialData.length - 1].timestamp;
    
    let cutOffTimestamp = 0;
    const msInDay = 24 * 60 * 60 * 1000;
    
    switch (timeframe) {
      case "1M":
        cutOffTimestamp = latestTimestamp - 30 * msInDay;
        break;
      case "6M":
        cutOffTimestamp = latestTimestamp - 182 * msInDay;
        break;
      case "1Y":
        cutOffTimestamp = latestTimestamp - 365 * msInDay;
        break;
      case "5Y":
        cutOffTimestamp = latestTimestamp - 5 * 365 * msInDay;
        break;
      case "ALL":
      default:
        return initialData;
    }
    
    return initialData.filter(d => d.timestamp >= cutOffTimestamp);
  }, [initialData, timeframe]);

  // Calculations for active filtered dataset
  const stats: SummaryStats = useMemo(() => {
    return calculateSummaryStats(filteredData);
  }, [filteredData]);

  // Overall full historical heatmap
  const heatmapData = useMemo(() => {
    return generateMonthlyHeatmap(initialData);
  }, [initialData]);

  // Return distribution histogram
  const histogramData = useMemo(() => {
    return generateHistogram(filteredData, 0.005);
  }, [filteredData]);

  // Run Monte Carlo Simulation when parameters change
  const triggerSimulation = () => {
    if (filteredData.length === 0) return;
    const latestRecord = filteredData[filteredData.length - 1];
    
    // Use CAGR and volatility from filtered timeframe to project
    const results = runMonteCarlo(
      latestRecord.price,
      stats.cagr,
      stats.volatility,
      simDays,
      simPathsCount
    );

    // Reformat for Recharts multiple line plotting
    const chartData = Array.from({ length: simDays + 1 }, (_, dayIndex) => {
      const dataPoint: any = { day: dayIndex };
      results.forEach(path => {
        dataPoint[path.name] = path.data[dayIndex]?.price || latestRecord.price;
      });
      return dataPoint;
    });

    setSimulations(chartData);
  };

  // Run simulation initially once data is loaded
  useEffect(() => {
    if (filteredData.length > 0) {
      triggerSimulation();
    }
  }, [filteredData, simDays, simPathsCount]);

  // Format percentage helper
  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  // Format large numbers
  const formatNumber = (val: number) => {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val);
  };

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const sorted = [...filteredData].reverse(); // Show newest first in table
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-white">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="text-zinc-400">Loading S&P 500 Analytics Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased selection:bg-indigo-500 selection:text-white pb-12">
      {/* Top Header Banner */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                S&P 500 Market Intelligence
              </h1>
              <p className="text-xs text-indigo-400 font-mono font-medium">ADVANCED QUANTITATIVE ANALYTICS</p>
            </div>
          </div>
          
          {/* Timeframe Selectors */}
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner">
            {(["1M", "6M", "1Y", "5Y", "ALL"] as const).map(tf => (
              <button
                key={tf}
                onClick={() => {
                  setTimeframe(tf);
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all duration-200 ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* KPI Cards Row */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CAGR Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-indigo-500/40 hover:bg-zinc-900/60 shadow-lg shadow-black/30">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">CAGR Return</span>
              <div className="p-2 rounded-lg bg-zinc-800 text-indigo-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-300 transition-colors">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-zinc-100">
                {formatPercent(stats.cagr)}
              </span>
              <span className="text-xs font-medium font-mono text-zinc-500">annualized</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              <span>Historical average growth compound</span>
            </p>
          </div>

          {/* Volatility Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-indigo-500/40 hover:bg-zinc-900/60 shadow-lg shadow-black/30">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-all duration-300"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Annualized Volatility</span>
              <div className="p-2 rounded-lg bg-zinc-800 text-violet-400 group-hover:bg-violet-500/10 group-hover:text-violet-300 transition-colors">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-zinc-100">
                {formatPercent(stats.volatility)}
              </span>
              <span className="text-xs font-medium font-mono text-zinc-500">standard deviation</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
              <Info className="h-3 w-3 text-violet-400" />
              <span>Dispersion of daily returns</span>
            </p>
          </div>

          {/* Max Drawdown Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-indigo-500/40 hover:bg-zinc-900/60 shadow-lg shadow-black/30">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-rose-500/5 blur-2xl group-hover:bg-rose-500/10 transition-all duration-300"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Maximum Drawdown</span>
              <div className="p-2 rounded-lg bg-zinc-800 text-rose-400 group-hover:bg-rose-500/10 group-hover:text-rose-300 transition-colors">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-rose-400">
                {formatPercent(stats.maxDrawdown)}
              </span>
              <span className="text-xs font-medium font-mono text-zinc-500">peak-to-trough drop</span>
            </div>
            <p className="mt-2 text-xs text-rose-400/90 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              <span>Largest loss from historical peak</span>
            </p>
          </div>

          {/* Sharpe Ratio Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-indigo-500/40 hover:bg-zinc-900/60 shadow-lg shadow-black/30">
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Sharpe Ratio (3% Rf)</span>
              <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-300 transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-zinc-100">
                {stats.sharpeRatio.toFixed(2)}
              </span>
              <span className="text-xs font-medium font-mono text-zinc-500">risk-adjusted return</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
              <Info className="h-3 w-3 text-emerald-400" />
              <span>Return per unit of risk</span>
            </p>
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="flex flex-wrap gap-2 border-b border-zinc-850 pb-2">
          {[
            { id: "overview", label: "Market Overview", icon: Activity },
            { id: "technical", label: "Technical Indicators", icon: TrendingUp },
            { id: "risk", label: "Risk & Drawdown", icon: AlertTriangle },
            { id: "heatmap", label: "Returns Matrix Heatmap", icon: Grid },
            { id: "simulations", label: "Simulation Playground", icon: Play },
            { id: "table", label: "Raw Dataset Table", icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-indigo-400 border border-zinc-700 shadow-md"
                    : "text-zinc-400 hover:text-zinc-150 hover:bg-zinc-900/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </section>

        {/* Dynamic Analytics Tab View */}
        <section className="space-y-6">
          
          {/* Tab 1: Overview Chart & Performance Summary */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Stock Chart (Interactive Area Chart) */}
              <div className="lg:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">S&P 500 Historical Performance</h3>
                    <p className="text-xs text-zinc-400">Closing price with Moving Average Overlays</p>
                  </div>
                </div>
                
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="dateStr"
                        tickFormatter={(v) => {
                          const parts = v.split("-");
                          return parts.length === 3 ? `${parts[1]}/${parts[2].slice(2)}` : v;
                        }}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${formatNumber(v)}`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        orientation="right"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        labelStyle={{ color: "#a1a1aa", fontWeight: "bold" }}
                        formatter={(val: any) => [`$${formatNumber(Number(val))}`, "Value"]}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area
                        type="monotone"
                        dataKey="price"
                        name="S&P 500 Price"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#priceGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        name="50-day SMA"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sma200"
                        name="200-day SMA"
                        stroke="#ec4899"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sidebar stats breakdown */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg flex flex-col justify-between">
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-zinc-100">Performance Metrics</h3>
                  
                  <div className="divide-y divide-zinc-800">
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Total Records Analyzed</span>
                      <span className="text-sm font-semibold font-mono text-zinc-150">{formatNumber(filteredData.length)} days</span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Start Price</span>
                      <span className="text-sm font-semibold font-mono text-zinc-150">${formatNumber(filteredData[0]?.price || 0)}</span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Latest Price</span>
                      <span className="text-sm font-semibold font-mono text-zinc-150">${formatNumber(filteredData[filteredData.length - 1]?.price || 0)}</span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Total Period Return</span>
                      <span className={`text-sm font-semibold font-mono flex items-center gap-1 ${
                        ((filteredData[filteredData.length - 1]?.price - filteredData[0]?.price) / filteredData[0]?.price) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {formatPercent((filteredData[filteredData.length - 1]?.price - filteredData[0]?.price) / filteredData[0]?.price)}
                      </span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Positive Session Days</span>
                      <span className="text-sm font-semibold font-mono text-emerald-400">{formatPercent(stats.winRate)}</span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Best Trading Day</span>
                      <span className="text-sm font-semibold font-mono text-emerald-400">+{formatPercent(stats.bestDay)}</span>
                    </div>
                    <div className="py-3.5 flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Worst Trading Day</span>
                      <span className="text-sm font-semibold font-mono text-rose-400">{formatPercent(stats.worstDay)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-800 bg-zinc-950/40 p-4 rounded-xl">
                  <div className="flex gap-3">
                    <TrendingUp className="h-5 w-5 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">System Insight</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Analyzing S&P 500 records reveals a compound annual growth rate of <strong className="text-indigo-300">{formatPercent(stats.cagr)}</strong> with risk-adjusted Sharpe performance of <strong className="text-indigo-300">{stats.sharpeRatio.toFixed(2)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Technical Indicators (RSI & MACD) */}
          {activeTab === "technical" && (
            <div className="grid grid-cols-1 gap-6">
              {/* RSI Chart */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">Relative Strength Index (RSI - 14)</h3>
                  <p className="text-xs text-zinc-400">Momentum oscillator showing overbought (&gt;70) and oversold (&lt;30) signals</p>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="dateStr"
                        tickFormatter={(v) => {
                          const parts = v.split("-");
                          return parts.length === 3 ? `${parts[1]}/${parts[2].slice(2)}` : v;
                        }}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        ticks={[30, 50, 70]}
                        orientation="right"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        formatter={(val: any) => [Number(val).toFixed(2), "RSI"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="rsi"
                        name="RSI"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      {/* Overbought and Oversold lines */}
                      <Line dataKey={() => 70} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                      <Line dataKey={() => 30} stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MACD Chart */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">MACD (Moving Average Convergence Divergence)</h3>
                  <p className="text-xs text-zinc-400">Trend-following momentum indicator displaying relationship between two moving averages</p>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="dateStr"
                        tickFormatter={(v) => {
                          const parts = v.split("-");
                          return parts.length === 3 ? `${parts[1]}/${parts[2].slice(2)}` : v;
                        }}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                      />
                      <YAxis tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} orientation="right" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        formatter={(val: any) => [Number(val).toFixed(2), "Value"]}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="macdHist" name="MACD Histogram" fill="#a1a1aa">
                        {filteredData.map((entry, index) => {
                          const value = entry.macdHist || 0;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={value >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}
                            />
                          );
                        })}
                      </Bar>
                      <Line type="monotone" dataKey="macd" name="MACD Line" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="macdSignal" name="Signal Line" stroke="#ec4899" strokeWidth={1.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Risk & Volatility Charts */}
          {activeTab === "risk" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Underwater Drawdown Chart */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-rose-400">Historical Underwater Drawdown</h3>
                  <p className="text-xs text-zinc-400">Percentage decline from historical peak prices</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="dateStr"
                        tickFormatter={(v) => {
                          const parts = v.split("-");
                          return parts.length === 3 ? `${parts[1]}/${parts[2].slice(2)}` : v;
                        }}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                      />
                      <YAxis
                        tickFormatter={(v) => formatPercent(v)}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        orientation="right"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        formatter={(val: any) => [formatPercent(Number(val)), "Drawdown"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="drawdown"
                        name="Drawdown %"
                        stroke="#ef4444"
                        strokeWidth={1}
                        fill="rgba(239, 68, 68, 0.15)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Returns distribution Histogram */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">Daily Return Distribution</h3>
                  <p className="text-xs text-zinc-400">Frequency distribution of daily percentage change session outcomes</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="binLabel"
                        tick={{ fill: "#71717a", fontSize: 8, angle: -45, textAnchor: "end" }}
                        height={50}
                      />
                      <YAxis tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} orientation="right" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        formatter={(val: any) => [val, "Days Count"]}
                      />
                      <Bar dataKey="count" name="Frequency" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Heatmap Matrix */}
          {activeTab === "heatmap" && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg overflow-x-auto">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-zinc-100">S&P 500 Monthly Returns Heatmap Matrix</h3>
                <p className="text-xs text-zinc-400">Grid visualization of S&P 500 performance by year and month</p>
              </div>

              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-2">Year</th>
                    <th className="py-3 px-2 text-right">Jan</th>
                    <th className="py-3 px-2 text-right">Feb</th>
                    <th className="py-3 px-2 text-right">Mar</th>
                    <th className="py-3 px-2 text-right">Apr</th>
                    <th className="py-3 px-2 text-right">May</th>
                    <th className="py-3 px-2 text-right">Jun</th>
                    <th className="py-3 px-2 text-right">Jul</th>
                    <th className="py-3 px-2 text-right">Aug</th>
                    <th className="py-3 px-2 text-right">Sep</th>
                    <th className="py-3 px-2 text-right">Oct</th>
                    <th className="py-3 px-2 text-right">Nov</th>
                    <th className="py-3 px-2 text-right">Dec</th>
                    <th className="py-3 px-3 text-right bg-zinc-800/40 rounded-t-lg">Annual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-xs font-mono">
                  {heatmapData.map((row) => {
                    const getHeatmapColor = (val: number) => {
                      if (!val || val === 0) return "rgba(39, 39, 42, 0.4)";
                      if (val > 0) {
                        const opacity = Math.min(0.1 + val * 3, 0.75);
                        return `rgba(16, 185, 129, ${opacity})`;
                      } else {
                        const opacity = Math.min(0.1 + Math.abs(val) * 3, 0.75);
                        return `rgba(239, 68, 68, ${opacity})`;
                      }
                    };

                    const monthsKeys = [
                      "jan", "feb", "mar", "apr", "may", "jun",
                      "jul", "aug", "sep", "oct", "nov", "dec"
                    ] as const;

                    return (
                      <tr key={row.year} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-2.5 px-2 font-bold text-zinc-300">{row.year}</td>
                        
                        {monthsKeys.map(key => {
                          const val = row[key];
                          return (
                            <td
                              key={key}
                              style={{ backgroundColor: getHeatmapColor(val) }}
                              className="py-2.5 px-2 text-right font-medium text-zinc-100 rounded-sm border border-zinc-950/20"
                            >
                              {val !== 0 ? `${(val * 100).toFixed(2)}%` : "-"}
                            </td>
                          );
                        })}

                        <td
                          style={{ backgroundColor: getHeatmapColor(row.total) }}
                          className="py-2.5 px-3 text-right font-bold text-white bg-zinc-800/20"
                        >
                          {row.total !== 0 ? `${(row.total * 100).toFixed(2)}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 5: Simulations & Stress Tests */}
          {activeTab === "simulations" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Monte Carlo Simulator Card */}
              <div className="lg:col-span-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">Monte Carlo Future Projection Simulation</h3>
                    <p className="text-xs text-zinc-400">1-Year random walk price projection paths using Geometric Brownian Motion</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Simulation Days</label>
                      <input
                        type="number"
                        value={simDays}
                        onChange={(e) => setSimDays(Math.max(10, Math.min(756, Number(e.target.value))))}
                        className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Paths Count</label>
                      <input
                        type="number"
                        value={simPathsCount}
                        onChange={(e) => setSimPathsCount(Math.max(2, Math.min(10, Number(e.target.value))))}
                        className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    
                    <button
                      onClick={triggerSimulation}
                      className="mt-4 flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs tracking-wider transition-all duration-200"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulations}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="day" name="Day" tick={{ fill: "#71717a", fontSize: 10 }} />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${formatNumber(v)}`}
                        tickLine={false}
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        orientation="right"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        formatter={(val: any) => [`$${formatNumber(Number(val))}`, "Projected Price"]}
                      />
                      {Array.from({ length: simPathsCount }, (_, i) => (
                        <Line
                          key={i}
                          type="monotone"
                          dataKey={`Path ${i + 1}`}
                          stroke={["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#a855f7", "#3b82f6"][i % 7]}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Crash Scenario Stress Tests */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-bold text-zinc-100">Stress Test Scenarios</h3>
                  </div>
                  <p className="text-xs text-zinc-400">How the current index levels would respond to historical financial crises</p>
                  
                  <div className="space-y-4 mt-4">
                    {CRASH_SCENARIOS.map((crash, index) => {
                      const latestPrice = filteredData[filteredData.length - 1]?.price || 0;
                      const simulatedDropPrice = latestPrice * (1 + crash.decline);
                      
                      return (
                        <div key={index} className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 hover:border-zinc-800 transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-zinc-200">{crash.name}</h4>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{crash.period}</p>
                            </div>
                            <span className="text-xs font-bold font-mono text-rose-400">{formatPercent(crash.decline)}</span>
                          </div>
                          
                          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{crash.description}</p>
                          
                          <div className="mt-3 flex justify-between items-center border-t border-zinc-900 pt-2 text-[11px] font-mono">
                            <span className="text-zinc-500">Current implied target:</span>
                            <span className="font-bold text-zinc-300">${formatNumber(simulatedDropPrice)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Raw Dataset Table */}
          {activeTab === "table" && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
              <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Historical Records Index</h3>
                  <p className="text-xs text-zinc-400">Searchable and sorted data logs of S&P 500 values</p>
                </div>
                
                <div className="text-xs font-mono text-zinc-400">
                  Showing {itemsPerPage * (currentPage - 1) + 1} - {Math.min(itemsPerPage * currentPage, filteredData.length)} of {formatNumber(filteredData.length)} records
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Close Price</th>
                      <th className="py-3 px-4 text-right">Open</th>
                      <th className="py-3 px-4 text-right">High</th>
                      <th className="py-3 px-4 text-right">Low</th>
                      <th className="py-3 px-4 text-right">Daily Change %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-sm font-mono text-zinc-200">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-zinc-300">{row.dateStr}</td>
                        <td className="py-3.5 px-4 text-right font-bold">${formatNumber(row.price)}</td>
                        <td className="py-3.5 px-4 text-right">${formatNumber(row.open)}</td>
                        <td className="py-3.5 px-4 text-right text-emerald-400/90">${formatNumber(row.high)}</td>
                        <td className="py-3.5 px-4 text-right text-rose-400/90">${formatNumber(row.low)}</td>
                        <td className={`py-3.5 px-4 text-right font-bold ${
                          row.change >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {row.change >= 0 ? "+" : ""}
                          {formatPercent(row.change)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-850">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold rounded-lg text-xs transition duration-200"
                >
                  Previous
                </button>
                <div className="text-xs font-mono text-zinc-400">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold rounded-lg text-xs transition duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Sub-component cell helper for Recharts MACD Histogram
