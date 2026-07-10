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
  const [timeframe, setTimeframe] = useState<"1M" | "6M" | "1Y" | "5Y" | "ALL" | "CUSTOM">("1Y");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("ema");
  const [customYear, setCustomYear] = useState<number>(2026);
  const [customMonth, setCustomMonth] = useState<string>("ALL");
  
  // Monte Carlo parameters
  const [simDays, setSimDays] = useState(252);
  const [simPathsCount, setSimPathsCount] = useState(5);
  const [simulations, setSimulations] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dynamically extract all available years in the dataset
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    initialData.forEach(d => {
      const parts = d.dateStr.split('-');
      if (parts.length === 3) {
        years.add(Number(parts[2]));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [initialData]);

  // Filter data based on timeframe
  const filteredData = useMemo(() => {
    if (initialData.length === 0) return [];
    
    if (timeframe === "CUSTOM") {
      return initialData.filter(d => {
        const parts = d.dateStr.split('-');
        if (parts.length !== 3) return false;
        const y = Number(parts[2]);
        const m = Number(parts[1]);
        
        const yearMatches = y === customYear;
        const monthMatches = customMonth === "ALL" || m === Number(customMonth);
        
        return yearMatches && monthMatches;
      });
    }

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
  }, [initialData, timeframe, customYear, customMonth]);

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

  // Calculate Volume Profile dynamically
  const volumeProfileData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const prices = filteredData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const binCount = 10;
    const binSize = range / binCount;

    const formatNum = (val: number) => {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(val);
    };

    const bins = Array.from({ length: binCount }, (_, i) => {
      const lower = minPrice + i * binSize;
      const upper = lower + binSize;
      return {
        binLabel: `$${formatNum(lower)} - $${formatNum(upper)}`,
        minVal: lower,
        maxVal: upper,
        volume: 0
      };
    });

    filteredData.forEach(d => {
      for (let i = 0; i < binCount; i++) {
        if (d.price >= bins[i].minVal && d.price < bins[i].maxVal) {
          bins[i].volume += d.volume;
          break;
        }
      }
    });

    return bins;
  }, [filteredData]);

  // Format large numbers
  const formatNumber = (val: number) => {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val);
  };

  // Format percentage helper
  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  // Generate Current Signals & Quantitative Summary of the latest day
  const latestSignals = useMemo(() => {
    if (filteredData.length === 0) return [];
    const latest = filteredData[filteredData.length - 1];
    
    // 1. EMA
    const emaStatus = latest.ema20 && latest.ema50
      ? (latest.ema20 > latest.ema50 ? "Bullish (Uptrend)" : "Bearish (Downtrend)")
      : "Neutral";
    const emaColor = emaStatus.startsWith("Bullish") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20";

    // 2. Volume
    const avgVol = filteredData.reduce((sum, d) => sum + d.volume, 0) / filteredData.length;
    const volStatus = latest.volume > avgVol * 1.1 ? "Strong Volume" : (latest.volume < avgVol * 0.9 ? "Weak Volume" : "Average Volume");
    const volColor = latest.volume > avgVol * 1.1 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : (latest.volume < avgVol * 0.9 ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700");

    // 3. VWAP
    const vwapStatus = latest.vwap
      ? (latest.price > latest.vwap ? "Bullish (Above VWAP)" : "Bearish (Below VWAP)")
      : "Neutral";
    const vwapColor = latest.price > (latest.vwap || 0) ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20";

    // 4. RSI
    let rsiStatus = "Neutral";
    let rsiColor = "bg-zinc-800 text-zinc-400 border border-zinc-700";
    if (latest.rsi) {
      if (latest.rsi > 70) {
        rsiStatus = "Overbought";
        rsiColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      } else if (latest.rsi < 30) {
        rsiStatus = "Oversold";
        rsiColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      }
    }

    // 5. MACD
    const macdStatus = latest.macdHist
      ? (latest.macdHist > 0 ? "Bullish Crossover" : "Bearish Crossover")
      : "Neutral";
    const macdColor = (latest.macdHist || 0) > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20";

    // 6. ATR
    const atrStatus = latest.atr ? `ATR: $${formatNumber(latest.atr)}` : "No Data";
    const atrColor = "bg-violet-500/10 text-violet-400 border border-violet-500/20";

    // 7. ADX
    let adxStatus = "Weak Trend";
    let adxColor = "bg-zinc-800 text-zinc-400 border border-zinc-700";
    if (latest.adx && latest.plusDI && latest.minusDI) {
      if (latest.adx > 25) {
        adxStatus = latest.plusDI > latest.minusDI ? "Strong Uptrend" : "Strong Downtrend";
        adxColor = latest.plusDI > latest.minusDI ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      } else if (latest.adx > 20) {
        adxStatus = "Moderate Trend";
        adxColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      }
    }

    // 8. Bollinger Bands
    let bbStatus = "Neutral Band";
    let bbColor = "bg-zinc-800 text-zinc-400 border border-zinc-700";
    if (latest.bbUpper && latest.bbLower) {
      if (latest.price >= latest.bbUpper * 0.98) {
        bbStatus = "Upper Band Touch";
        bbColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      } else if (latest.price <= latest.bbLower * 1.02) {
        bbStatus = "Lower Band Touch";
        bbColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      }
    }

    // 9. Stochastic
    let stochStatus = "Neutral";
    let stochColor = "bg-zinc-800 text-zinc-400 border border-zinc-700";
    if (latest.stochK) {
      if (latest.stochK > 80) {
        stochStatus = "Overbought";
        stochColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      } else if (latest.stochK < 20) {
        stochStatus = "Oversold";
        stochColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      }
    }

    // 10. Volume Profile Value Area (Price range where most volume is concentrated)
    let maxBinLabel = "";
    if (volumeProfileData.length > 0) {
      const sortedProfile = [...volumeProfileData].sort((a, b) => b.volume - a.volume);
      maxBinLabel = sortedProfile[0]?.binLabel || "";
    }

    return [
      { id: "ema", name: "EMA (20 & 50)", value: `EMA20: $${formatNumber(latest.ema20 || 0)} / EMA50: $${formatNumber(latest.ema50 || 0)}`, status: emaStatus, color: emaColor },
      { id: "volume", name: "Volume", value: `Vol: ${formatNumber(latest.volume)} (Avg: ${formatNumber(avgVol)})`, status: volStatus, color: volColor },
      { id: "vwap", name: "VWAP (20d)", value: `Price: $${formatNumber(latest.price)} / VWAP: $${formatNumber(latest.vwap || 0)}`, status: vwapStatus, color: vwapColor },
      { id: "rsi", name: "RSI (14)", value: `RSI: ${latest.rsi ? latest.rsi.toFixed(2) : "N/A"}`, status: rsiStatus, color: rsiColor },
      { id: "macd", name: "MACD (12, 26, 9)", value: `MACD: ${latest.macd ? latest.macd.toFixed(2) : "N/A"} (Hist: ${latest.macdHist ? latest.macdHist.toFixed(2) : "N/A"})`, status: macdStatus, color: macdColor },
      { id: "atr", name: "ATR (14)", value: `True Range price swing volatility`, status: atrStatus, color: atrColor },
      { id: "adx", name: "ADX (14)", value: `ADX: ${latest.adx ? latest.adx.toFixed(2) : "N/A"} (+DI: ${latest.plusDI ? latest.plusDI.toFixed(1) : "N/A"} / -DI: ${latest.minusDI ? latest.minusDI.toFixed(1) : "N/A"})`, status: adxStatus, color: adxColor },
      { id: "bollinger", name: "Bollinger Bands (20,2)", value: `Upper: $${formatNumber(latest.bbUpper || 0)} / Lower: $${formatNumber(latest.bbLower || 0)}`, status: bbStatus, color: bbColor },
      { id: "stochastic", name: "Stochastic (14,3)", value: `%K: ${latest.stochK ? latest.stochK.toFixed(1) : "N/A"} / %D: ${latest.stochD ? latest.stochD.toFixed(1) : "N/A"}`, status: stochStatus, color: stochColor },
      { id: "profile", name: "Volume Profile", value: `Max Concentrated price zone`, status: maxBinLabel, color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" }
    ];
  }, [filteredData, volumeProfileData]);

  // Indicator definitions and descriptions
  const activeIndicatorInfo = useMemo(() => {
    const infos: Record<string, { title: string; desc: string; interpretation: string; helps: string }> = {
      ema: {
        title: "EMA (Exponential Moving Average 20 & 50)",
        desc: "Filters out market noise to show the primary price trend direction.",
        interpretation: "EMA20 above EMA50 indicates an uptrend (Bullish). EMA20 below EMA50 indicates a downtrend (Bearish).",
        helps: "How it helps: Helps traders identify trend start and end points without getting caught in short-term volatility whipsaws."
      },
      volume: {
        title: "Volume (Implied Activity)",
        desc: "Tracks the strength behind price movements based on daily volatility ranges.",
        interpretation: "High volume during upward price moves confirms strong buying support. Price moves on low volume suggest a weak breakout.",
        helps: "How it helps: Prevents buying into false breakouts. Valid breakouts are always backed by high activity."
      },
      vwap: {
        title: "VWAP (Volume Weighted Average Price - 20 day)",
        desc: "Reflects the true average price institutions are buying and selling at.",
        interpretation: "Price above VWAP indicates buyers are in control. Price below VWAP indicates sellers are in control.",
        helps: "How it helps: Institutions use VWAP to gauge execution quality. Buying below VWAP means you got a better-than-average price."
      },
      rsi: {
        title: "RSI (Relative Strength Index - 14)",
        desc: "Measures momentum speed and change of price movements.",
        interpretation: "Above 70 = Overbought (due for cooling or reversal). Below 30 = Oversold (potentially undervalued). Around 50 = Neutral.",
        helps: "How it helps: Highlights overextended markets, alerting traders to potential top/bottom reversal zones."
      },
      macd: {
        title: "MACD (Moving Average Convergence Divergence)",
        desc: "Reveals trend momentum strength and potential reversal crossovers.",
        interpretation: "MACD line crosses above Signal line = Bullish crossover (Buy momentum). MACD line crosses below Signal line = Bearish crossover (Sell momentum).",
        helps: "How it helps: Provides early signals of trend changes before they fully manifest in the price charts."
      },
      atr: {
        title: "ATR (Average True Range - 14)",
        desc: "Measures overall market volatility without indicating trend direction.",
        interpretation: "High ATR = Big price swings. Low ATR = Quiet, range-bound market.",
        helps: "How it helps: Essential for placing stop-losses. Set stops wider during high ATR periods to avoid being prematurely stopped out."
      },
      adx: {
        title: "ADX (Average Directional Index - 14)",
        desc: "Measures the strength of a trend regardless of whether it is going up or down.",
        interpretation: "ADX above 25 indicates a strong trend. Below 20 indicates a sideways, trendless market.",
        helps: "How it helps: Prevents trading trend-following strategies during sideways markets, saving traders from unnecessary losses."
      },
      bollinger: {
        title: "Bollinger Bands (20, 2)",
        desc: "Plots volatility bands above and below a moving average baseline.",
        interpretation: "Touch upper band = Overbought/Overextended. Touch lower band = Oversold/Undervalued. Band squeeze indicates a breakout is coming.",
        helps: "How it helps: Squeezes are often followed by violent price breakouts. Shows price extremes in relation to standard deviation."
      },
      stochastic: {
        title: "Stochastic Oscillator (14, 3)",
        desc: "Compares a closing price to its price range over a given time period.",
        interpretation: "Above 80 = Overbought (due to reverse down). Below 20 = Oversold (due to reverse up). Crossover of %K and %D serves as entry signal.",
        helps: "How it helps: Extremely effective in range-bound markets for pinpointing short-term cycle turning points."
      },
      profile: {
        title: "Volume Profile (Price-Volume Distribution)",
        desc: "Shows trading volume traded at specific price levels rather than over time.",
        interpretation: "High-volume areas = Strong support/resistance walls. Low-volume areas = Price moves quickly through them.",
        helps: "How it helps: Helps traders place highly accurate profit targets and stop-losses near structural volume walls."
      }
    };
    return infos[selectedIndicator] || infos.ema;
  }, [selectedIndicator]);

  // Run Monte Carlo Simulation when parameters change
  const triggerSimulation = () => {
    if (filteredData.length === 0) return;
    const latestRecord = filteredData[filteredData.length - 1];
    
    const results = runMonteCarlo(
      latestRecord.price,
      stats.cagr,
      stats.volatility,
      simDays,
      simPathsCount
    );

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
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner">
              {(["1M", "6M", "1Y", "5Y", "ALL", "CUSTOM"] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeframe(tf);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all duration-200 ${
                    timeframe === tf
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {timeframe === "CUSTOM" && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                <select
                  value={customYear}
                  onChange={(e) => {
                    setCustomYear(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-zinc-950 text-zinc-200 border border-zinc-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>

                <select
                  value={customMonth}
                  onChange={(e) => {
                    setCustomMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-zinc-950 text-zinc-200 border border-zinc-850 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Months</option>
                  {[
                    { val: "1", label: "January" },
                    { val: "2", label: "February" },
                    { val: "3", label: "March" },
                    { val: "4", label: "April" },
                    { val: "5", label: "May" },
                    { val: "6", label: "June" },
                    { val: "7", label: "July" },
                    { val: "8", label: "August" },
                    { val: "9", label: "September" },
                    { val: "10", label: "October" },
                    { val: "11", label: "November" },
                    { val: "12", label: "December" }
                  ].map(m => (
                    <option key={m.val} value={m.val}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
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

          {/* Tab 2: Technical Indicators Studio (10 Indicators) */}
          {activeTab === "technical" && (
            <div className="space-y-8">
              {/* Section A: Latest Signals & Quantitative Summary */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">Live Indicator Signals & Quantitative Summary</h3>
                  <p className="text-xs text-zinc-400">Current trading session indicator values and automatically generated directional status</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {latestSignals.map((sig) => (
                    <button
                      key={sig.id}
                      onClick={() => setSelectedIndicator(sig.id)}
                      className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-28 ${
                        selectedIndicator === sig.id
                          ? "bg-zinc-800/80 border-indigo-500 shadow-md shadow-indigo-500/5"
                          : "bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/40 hover:border-zinc-800"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-zinc-300 leading-tight">{sig.name}</h4>
                        <p className="text-[10px] font-mono text-zinc-500 truncate mt-1">{sig.value}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-2 self-start ${sig.color}`}>
                        {sig.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section B: Charting Studio */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* List of Indicators (Navigation) */}
                <div className="lg:col-span-1 flex flex-col gap-2 bg-zinc-900/10 p-2 rounded-2xl border border-zinc-850">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase px-3 py-1.5 tracking-wider">Select Indicator Studio</span>
                  {[
                    { id: "ema", name: "1. EMA (20 & 50)" },
                    { id: "volume", name: "2. Volume" },
                    { id: "vwap", name: "3. VWAP" },
                    { id: "rsi", name: "4. RSI (14)" },
                    { id: "macd", name: "5. MACD" },
                    { id: "atr", name: "6. ATR (14)" },
                    { id: "adx", name: "7. ADX (14)" },
                    { id: "bollinger", name: "8. Bollinger Bands" },
                    { id: "stochastic", name: "9. Stochastic Oscillator" },
                    { id: "profile", name: "10. Volume Profile" }
                  ].map((ind) => (
                    <button
                      key={ind.id}
                      onClick={() => setSelectedIndicator(ind.id)}
                      className={`text-left px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                        selectedIndicator === ind.id
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-zinc-400 hover:bg-zinc-900/40 hover:text-white"
                      }`}
                    >
                      {ind.name}
                    </button>
                  ))}
                </div>

                {/* Main Interactive Studio Chart */}
                <div className="lg:col-span-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 backdrop-blur-md shadow-lg flex flex-col justify-between">
                  <div className="mb-6 space-y-2">
                    <h3 className="text-lg font-bold text-zinc-100">{activeIndicatorInfo.title}</h3>
                    <p className="text-xs text-indigo-400 leading-relaxed font-semibold">{activeIndicatorInfo.desc}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{activeIndicatorInfo.interpretation}</p>
                    
                    <div className="bg-zinc-950/40 border border-zinc-850/60 p-3 rounded-xl flex items-start gap-2 mt-3">
                      <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-300 font-mono leading-relaxed">{activeIndicatorInfo.helps}</p>
                    </div>
                  </div>

                  <div className="h-[320px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      {selectedIndicator === "ema" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={["auto", "auto"]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [`$${formatNumber(Number(val))}`, "Price"]} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" dataKey="price" name="S&P 500 Price" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="ema20" name="20-day EMA" stroke="#f59e0b" strokeWidth={1.2} dot={false} />
                          <Line type="monotone" dataKey="ema50" name="50-day EMA" stroke="#ec4899" strokeWidth={1.2} dot={false} />
                        </LineChart>
                      ) : selectedIndicator === "volume" ? (
                        <BarChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [formatNumber(Number(val)), "Implied Activity"]} />
                          <Bar dataKey="volume" name="Trading Volume" fill="#6366f1" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      ) : selectedIndicator === "vwap" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={["auto", "auto"]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [`$${formatNumber(Number(val))}`, "Price"]} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" dataKey="price" name="S&P 500 Price" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="vwap" name="VWAP (20d)" stroke="#10b981" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      ) : selectedIndicator === "rsi" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={[0, 100]} ticks={[30, 50, 70]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [Number(val).toFixed(2), "RSI"]} />
                          <Line type="monotone" dataKey="rsi" name="RSI (14)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                          <Line dataKey={() => 70} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                          <Line dataKey={() => 30} stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                        </LineChart>
                      ) : selectedIndicator === "macd" ? (
                        <ComposedChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [Number(val).toFixed(2), "Value"]} />
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
                      ) : selectedIndicator === "atr" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "ATR"]} />
                          <Line type="monotone" dataKey="atr" name="ATR (14)" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      ) : selectedIndicator === "adx" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={[0, 100]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [Number(val).toFixed(2), "Value"]} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" dataKey="adx" name="ADX" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="plusDI" name="+DI" stroke="#10b981" strokeWidth={1} dot={false} />
                          <Line type="monotone" dataKey="minusDI" name="-DI" stroke="#ef4444" strokeWidth={1} dot={false} />
                        </LineChart>
                      ) : selectedIndicator === "bollinger" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={["auto", "auto"]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [`$${formatNumber(Number(val))}`, "Value"]} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" dataKey="price" name="S&P 500 Price" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="bbUpper" name="Upper Band" stroke="#ec4899" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                          <Line type="monotone" dataKey="bbMiddle" name="Middle Band" stroke="#f59e0b" strokeWidth={1.2} dot={false} />
                          <Line type="monotone" dataKey="bbLower" name="Lower Band" stroke="#ec4899" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        </LineChart>
                      ) : selectedIndicator === "stochastic" ? (
                        <LineChart data={filteredData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="dateStr" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis domain={[0, 100]} ticks={[20, 50, 80]} orientation="right" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [Number(val).toFixed(2), "Value"]} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" dataKey="stochK" name="%K Line" stroke="#10b981" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="stochD" name="%D Signal" stroke="#ec4899" strokeWidth={1.5} dot={false} />
                          <Line dataKey={() => 80} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                          <Line dataKey={() => 20} stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} />
                        </LineChart>
                      ) : (
                        // Volume Profile (Horizontal Distribution)
                        <BarChart data={volumeProfileData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                          <XAxis type="number" orientation="top" tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis type="category" dataKey="binLabel" tickLine={false} tick={{ fill: "#71717a", fontSize: 9 }} width={120} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#f4f4f5" }} formatter={(val: any) => [formatNumber(Number(val)), "Volume"]} />
                          <Bar dataKey="volume" name="Traded Volume" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
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
                    const getHeatmapColor = (val: number | null) => {
                      if (val === null || val === 0) return "rgba(39, 39, 42, 0.4)";
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
                              {val !== null ? `${(val * 100).toFixed(2)}%` : "-"}
                            </td>
                          );
                        })}

                        <td
                          style={{ backgroundColor: getHeatmapColor(row.total) }}
                          className="py-2.5 px-3 text-right font-bold text-white bg-zinc-800/20"
                        >
                          {row.total !== null ? `${(row.total * 100).toFixed(2)}%` : "-"}
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
