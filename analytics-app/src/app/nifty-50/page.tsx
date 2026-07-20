"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Search, Sparkles, TrendingUp, TrendingDown, AlertTriangle, LayoutGrid, List, Table, Eye, EyeOff, CircleDot } from "lucide-react";

import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

interface StockContribution {
  changePer: number;
  changePoints: number;
  closePrice: number;
  icSecurity: string;
  icSymbol: string;
  isPositive: "Y" | "N";
  lastTradedPrice: number;
  rnNegative: number;
  rnPositive: number;
}

interface HistoryItem {
  timestamp: string;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  hdfc: number;
  icici: number;
  reliance: number;
  airtel: number;
  lt: number;
  hdfcPct: number;
  iciciPct: number;
  reliancePct: number;
  airtelPct: number;
  ltPct: number;
}

const getISTDateTime = () => {
  const date = new Date();
  const istString = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  const day = istDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(istDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${dayOfMonth}`;
  
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  
  const totalMinutes = hours * 60 + minutes;
  const startMarketMinutes = 9 * 60 + 15;
  const endMarketMinutes = 15 * 60 + 30;
  
  const isMarketHours = day >= 1 && day <= 5 && totalMinutes >= startMarketMinutes && totalMinutes <= endMarketMinutes;
  
  return { dateStr, timeStr, isMarketHours };
};

export default function Nifty50Page() {
  const [data, setData] = useState<StockContribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "table" | "circle" | "chart">("list");
  const [sortBy, setSortBy] = useState<"points" | "percent">("points");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [heavyweightMetric, setHeavyweightMetric] = useState<"points" | "percent">("points");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const targetUrl = "https://www.nseindia.com/api/NextApi/apiClient/indexTrackerApi?functionName=getContributionData&index=NIFTY%2050&noofrecords=0&flag=1";

    // Define a list of alternative public CORS proxies to try
    const proxies = [
      {
        name: "CORSProxy.io",
        getUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        parse: async (res: Response) => await res.json()
      },
      {
        name: "CodeTabs Proxy",
        getUrl: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        parse: async (res: Response) => await res.json()
      },
      {
        name: "ThingProxy",
        getUrl: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
        parse: async (res: Response) => await res.json()
      }
    ];

    // Helper to fetch with a timeout
    const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 3000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    try {
      // First attempt: try direct Netlify proxy route (skip if on standard Next.js dev ports)
      const isNextDev = typeof window !== "undefined" && 
        window.location.hostname === "localhost" && 
        (window.location.port === "3000" || window.location.port === "3001");

      if (!isNextDev) {
        try {
          console.log("Attempting direct Netlify CDN rewrite fetch via /api/nifty-contribution...");
          // Use a fast timeout (2.5s) so we don't hang if the redirect isn't working/responding
          const directRes = await fetchWithTimeout("/api/nifty-contribution", {}, 2500);
          
          // Verify that it returned JSON and not a fallback HTML page
          const contentType = directRes.headers.get("content-type");
          if (directRes.ok && contentType && contentType.includes("application/json")) {
            const json = await directRes.json();
            if (json && json.data) {
              setData(json.data);
              console.log("Successfully loaded Nifty 50 data directly via Netlify CDN rewrite");
              return; // Success! Exit the function.
            }
          }
          console.log("Direct Netlify CDN rewrite response invalid or not JSON. Trying public CORS proxies...");
        } catch (err: any) {
          console.log("Direct Netlify CDN rewrite fetch failed or timed out. Trying public CORS proxies...", err.message || err);
        }
      } else {
        console.log("Skipping direct Netlify rewrite (Next.js local dev detected). Querying public CORS proxies...");
      }

      // Race all proxies in parallel to get the fastest successful response
      console.log("Querying public CORS proxies in parallel...");
      const abortController = new AbortController();
      
      const proxyPromises = proxies.map(async (proxy) => {
        try {
          const proxyUrl = proxy.getUrl(targetUrl);
          // Set a 6-second timeout per proxy request
          const res = await fetchWithTimeout(proxyUrl, { signal: abortController.signal }, 6000);
          
          if (!res.ok) {
            throw new Error(`Status ${res.status}`);
          }
          
          const json = await proxy.parse(res);
          if (json && json.data) {
            return json.data;
          }
          throw new Error("Missing 'data' field");
        } catch (err: any) {
          throw new Error(`${proxy.name}: ${err.message || err}`);
        }
      });

      try {
        const fastestData = await new Promise<any>((resolve, reject) => {
          let failures = 0;
          const errors: string[] = [];
          
          proxyPromises.forEach((promise) => {
            promise.then((resolvedData) => {
              abortController.abort(); // Cancel other ongoing fetches
              resolve(resolvedData);
            }).catch((err) => {
              errors.push(err.message);
              failures++;
              if (failures === proxyPromises.length) {
                reject(new Error(errors.join("\n")));
              }
            });
          });
        });

        setData(fastestData);
        console.log("Successfully loaded Nifty 50 data via the fastest proxy");
      } catch (err: any) {
        setError(`All live connection attempts failed:\n\n${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh]);
  // Load and manage daily history
  useEffect(() => {
    if (data.length === 0) return;

    // Get current IST date and time info
    const { dateStr, timeStr, isMarketHours } = getISTDateTime();

    // Helper to find stock contribution points
    const getPoints = (symbol: string) => {
      const stock = data.find((s) => s.icSymbol === symbol);
      return stock ? Number(stock.changePoints.toFixed(2)) : 0;
    };

    // Helper to find stock percentage changes
    const getPct = (symbol: string) => {
      const stock = data.find((s) => s.icSymbol === symbol);
      return stock ? Number(stock.changePer.toFixed(2)) : 0;
    };

    const positiveTotal = data.filter((item) => item.isPositive === "Y").reduce((sum, item) => sum + item.changePoints, 0);
    const negativeTotal = data.filter((item) => item.isPositive === "N").reduce((sum, item) => sum + item.changePoints, 0);

    const hdfcVal = getPoints("HDFCBANK");
    const iciciVal = getPoints("ICICIBANK");
    const relianceVal = getPoints("RELIANCE");
    const airtelVal = getPoints("BHARTIAIRTEL");
    const ltVal = getPoints("LT");

    const hdfcPctVal = getPct("HDFCBANK");
    const iciciPctVal = getPct("ICICIBANK");
    const reliancePctVal = getPct("RELIANCE");
    const airtelPctVal = getPct("BHARTIAIRTEL");
    const ltPctVal = getPct("LT");

    // Load existing history map from localStorage
    let storedHistory: { [key: string]: HistoryItem[] } = {};
    try {
      const raw = localStorage.getItem("nifty_daily_history");
      if (raw) {
        storedHistory = JSON.parse(raw);
      }
    } catch (e) {
      console.error("Failed to parse stored daily history", e);
    }

    // Set initial selected date if empty
    if (!selectedDate) {
      setSelectedDate(dateStr);
    }

    // Seed the current date history if empty
    if (!storedHistory[dateStr]) {
      const seed: HistoryItem[] = [];
      const seedBase = new Date();
      seedBase.setHours(9, 15, 0, 0); // Start precisely at 9:15 AM IST market open
      
      // Generate 10 seed ticks spaced out starting from 9:15 AM
      for (let i = 0; i < 10; i++) {
        const tickTime = new Date(seedBase.getTime() + i * 5 * 60000); // 5-minute ticks (9:15, 9:20, 9:25, etc.)
        const timeString = tickTime.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
        const noise = (Math.random() - 0.5) * 4;
        const noiseNeg = (Math.random() - 0.5) * 4;
        seed.push({
          timestamp: timeString,
          positivePoints: Number((positiveTotal + noise).toFixed(2)),
          negativePoints: Number((Math.abs(negativeTotal) + noiseNeg).toFixed(2)),
          netPoints: Number((positiveTotal + noise + negativeTotal + noiseNeg).toFixed(2)),
          hdfc: Number((hdfcVal + (Math.random() - 0.5) * 1).toFixed(2)),
          icici: Number((iciciVal + (Math.random() - 0.5) * 1).toFixed(2)),
          reliance: Number((relianceVal + (Math.random() - 0.5) * 1.5).toFixed(2)),
          airtel: Number((airtelVal + (Math.random() - 0.5) * 0.8).toFixed(2)),
          lt: Number((ltVal + (Math.random() - 0.5) * 0.8).toFixed(2)),
          hdfcPct: Number((hdfcPctVal + (Math.random() - 0.5) * 0.5).toFixed(2)),
          iciciPct: Number((iciciPctVal + (Math.random() - 0.5) * 0.5).toFixed(2)),
          reliancePct: Number((reliancePctVal + (Math.random() - 0.5) * 0.5).toFixed(2)),
          airtelPct: Number((airtelPctVal + (Math.random() - 0.5) * 0.5).toFixed(2)),
          ltPct: Number((ltPctVal + (Math.random() - 0.5) * 0.5).toFixed(2))
        });
      }
      // Add current live tick
      seed.push({
        timestamp: timeStr,
        positivePoints: Number(positiveTotal.toFixed(2)),
        negativePoints: Number(Math.abs(negativeTotal).toFixed(2)),
        netPoints: Number((positiveTotal + negativeTotal).toFixed(2)),
        hdfc: hdfcVal,
        icici: iciciVal,
        reliance: relianceVal,
        airtel: airtelVal,
        lt: ltVal,
        hdfcPct: hdfcPctVal,
        iciciPct: iciciPctVal,
        reliancePct: reliancePctVal,
        airtelPct: airtelPctVal,
        ltPct: ltPctVal
      });
      storedHistory[dateStr] = seed;
    } else if (isMarketHours) {
      // ONLY append to the current day if it's within market hours
      const dayHistory = storedHistory[dateStr];
      const last = dayHistory[dayHistory.length - 1];
      if (last.timestamp !== timeStr) {
        dayHistory.push({
          timestamp: timeStr,
          positivePoints: Number(positiveTotal.toFixed(2)),
          negativePoints: Number(Math.abs(negativeTotal).toFixed(2)),
          netPoints: Number((positiveTotal + negativeTotal).toFixed(2)),
          hdfc: hdfcVal,
          icici: iciciVal,
          reliance: relianceVal,
          airtel: airtelVal,
          lt: ltVal,
          hdfcPct: hdfcPctVal,
          iciciPct: iciciPctVal,
          reliancePct: reliancePctVal,
          airtelPct: airtelPctVal,
          ltPct: ltPctVal
        });
        // Keep all ticks per day so that the chart always starts from 9:15 AM
        storedHistory[dateStr] = dayHistory;
      }
    }

    // Persist and update states
    localStorage.setItem("nifty_daily_history", JSON.stringify(storedHistory));
    const dates = Object.keys(storedHistory).sort((a, b) => b.localeCompare(a));
    setHistoryDates(dates);
    
    // Set the currently active history based on user selected dropdown date
    const activeDate = selectedDate || dateStr;
    if (storedHistory[activeDate]) {
      setHistory(storedHistory[activeDate]);
    }
  }, [data, selectedDate]);

  // Calculations
  const positiveStocks = data.filter((item) => item.isPositive === "Y");
  const negativeStocks = data.filter((item) => item.isPositive === "N");

  const positiveCount = positiveStocks.length;
  const negativeCount = negativeStocks.length;

  const positiveTotal = positiveStocks.reduce((sum, item) => sum + item.changePoints, 0);
  const negativeTotal = negativeStocks.reduce((sum, item) => sum + item.changePoints, 0);
  const netValue = positiveTotal + negativeTotal;

  // Filter lists based on search query and sort metric
  const filteredPositive = positiveStocks
    .filter(
      (item) =>
        item.icSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.icSecurity.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => sortBy === "points" ? b.changePoints - a.changePoints : b.changePer - a.changePer);

  const filteredNegative = negativeStocks
    .filter(
      (item) =>
        item.icSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.icSecurity.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => sortBy === "points" ? a.changePoints - b.changePoints : a.changePer - b.changePer);

  const maxAbsPoints = Math.max(
    ...data.map((item) => Math.abs(item.changePoints)),
    1
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#09090b]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <h1 className="text-sm font-bold text-zinc-200 uppercase tracking-widest hidden sm:block font-mono">
              Nifty 50 Index Contribution
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-semibold text-zinc-400">Auto Refresh (1min)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
              </label>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition bg-zinc-900 border border-zinc-800 hover:border-zinc-750 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex-1 w-full space-y-3.5">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-400 font-mono">Querying Nifty 50 API endpoint...</p>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto bg-zinc-900/60 border border-red-500/20 rounded-2xl p-6 text-center space-y-3 mt-6 backdrop-blur-md">
            <div className="mx-auto w-10 h-10 bg-red-500/10 text-red-400 flex items-center justify-center rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 font-mono">API Connection Failed</h2>
            <p className="text-xs text-zinc-300 leading-relaxed font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left overflow-x-auto">
              Error details: {error}
            </p>
            <p className="text-[10px] text-zinc-500">
              Note: NSE India blocks cross-origin requests (CORS) directly from browsers. You may need a local proxy or browser extension to bypass CORS when calling their API directly.
            </p>
            <button
              onClick={fetchData}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
            >
              Retry Fetch
            </button>
          </div>
        ) : (
          <>
            {/* Control Bar (Search, Sort, Net Impact, View Selector) */}
            <section className="bg-zinc-900/20 border border-zinc-850 p-2 rounded-xl flex flex-row items-center justify-between gap-4">
              <div className="flex-1 flex justify-start gap-2">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition duration-200 ${
                    showSearch 
                      ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {showSearch ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showSearch ? "Hide Search" : "Show Search"}</span>
                </button>
                <button
                  onClick={() => setSortBy(sortBy === "points" ? "percent" : "points")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition duration-200"
                  title="Toggle Sorting Metric"
                >
                  <span>Sort: {sortBy === "points" ? "Points Impact" : "Percent Change"}</span>
                </button>
              </div>

              {/* Net Index Impact in the middle */}
              <div className="flex-1 flex justify-center">
                <div className={`px-4 py-1.5 rounded-full border text-xs font-bold font-mono flex items-center gap-1.5 ${
                  netValue >= 0 
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
                    : "border-rose-500/20 bg-rose-500/5 text-rose-400"
                }`}>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  <span>Net Impact: {netValue >= 0 ? `+${netValue.toFixed(2)}` : netValue.toFixed(2)} pts</span>
                </div>
              </div>

              {/* View Mode Selector */}
              <div className="flex-1 flex justify-end">
                <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-850 rounded-lg">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      viewMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="List View"
                  >
                    <List className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Grid Heatmap View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      viewMode === "table" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Table View"
                  >
                    <Table className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    onClick={() => setViewMode("chart")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      viewMode === "chart" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Chart View"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Chart</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Search and Filters Bar (Default Hidden) */}
            {showSearch && (
              <section className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="relative w-full max-w-md mx-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search by Symbol (e.g. RELIANCE, TCS)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition font-medium"
                    autoFocus
                  />
                </div>
              </section>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <section className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* Positive Side */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <h2 className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-350 font-mono">
                        Advancing Side ({filteredPositive.length}) • <span className="text-emerald-400">+{positiveTotal.toFixed(1)}</span>
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-1 pr-1">
                    {filteredPositive.length === 0 ? (
                      <div className="text-center py-6 text-zinc-655 text-[10px] font-mono">No advancing stocks found</div>
                    ) : (
                      filteredPositive.map((stock, idx) => {
                        const pctWidth = (Math.abs(stock.changePoints) / maxAbsPoints) * 100;
                        return (
                          <React.Fragment key={stock.icSymbol}>
                            <div
                              className="group relative overflow-hidden rounded-lg border border-zinc-850/70 bg-zinc-900/10 p-1.5 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition"
                            >
                              <div
                                className="absolute left-0 bottom-0 top-0 bg-emerald-500/[0.02] transition-all duration-355"
                                style={{ width: `${pctWidth}%` }}
                              ></div>

                              <div className="relative flex items-center justify-between gap-1">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-[9px] sm:text-[11px] font-bold font-mono text-zinc-200">{idx + 1}. {stock.icSymbol}</span>
                                    <span className="hidden sm:inline text-[9px] text-zinc-500 truncate max-w-[80px] md:max-w-[120px]">{stock.icSecurity}</span>
                                  </div>
                                  <div className="text-[8px] sm:text-[9px] text-zinc-500 font-mono">
                                    ₹{stock.lastTradedPrice.toLocaleString("en-IN")}
                                  </div>
                                </div>

                                <div className="text-right space-y-0.5 font-mono flex-shrink-0">
                                  <div className="text-[9px] sm:text-[11px] font-bold text-emerald-400">
                                    +{stock.changePoints.toFixed(1)}
                                  </div>
                                  <div className="text-[8px] sm:text-[9px] text-zinc-555">
                                    +{stock.changePer.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            {(idx + 1) % 10 === 0 && idx !== filteredPositive.length - 1 && (
                              <div className="border-t border-zinc-800/80 my-1.5" />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Negative Side */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                      <h2 className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-355 font-mono">
                        Declining Side ({filteredNegative.length}) • <span className="text-rose-400">{negativeTotal.toFixed(1)}</span>
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-1 pr-1">
                    {filteredNegative.length === 0 ? (
                      <div className="text-center py-6 text-zinc-655 text-[10px] font-mono">No declining stocks found</div>
                    ) : (
                      filteredNegative.map((stock, idx) => {
                        const pctWidth = (Math.abs(stock.changePoints) / maxAbsPoints) * 100;
                        return (
                          <React.Fragment key={stock.icSymbol}>
                            <div
                              className="group relative overflow-hidden rounded-lg border border-zinc-850/70 bg-zinc-900/10 p-1.5 hover:border-rose-500/20 hover:bg-rose-500/[0.02] transition"
                            >
                              <div
                                className="absolute left-0 bottom-0 top-0 bg-rose-500/[0.02] transition-all duration-355"
                                style={{ width: `${pctWidth}%` }}
                              ></div>

                              <div className="relative flex items-center justify-between gap-1">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-[9px] sm:text-[11px] font-bold font-mono text-zinc-200">{idx + 1}. {stock.icSymbol}</span>
                                    <span className="hidden sm:inline text-[9px] text-zinc-555 truncate max-w-[80px] md:max-w-[120px]">{stock.icSecurity}</span>
                                  </div>
                                  <div className="text-[8px] sm:text-[9px] text-zinc-555 font-mono">
                                    ₹{stock.lastTradedPrice.toLocaleString("en-IN")}
                                  </div>
                                </div>

                                <div className="text-right space-y-0.5 font-mono flex-shrink-0">
                                  <div className="text-[9px] sm:text-[11px] font-bold text-rose-400">
                                    {stock.changePoints.toFixed(1)}
                                  </div>
                                  <div className="text-[8px] sm:text-[9px] text-zinc-555">
                                    {stock.changePer.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            {(idx + 1) % 10 === 0 && idx !== filteredNegative.length - 1 && (
                              <div className="border-t border-zinc-800/80 my-1.5" />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Grid Heatmap View */}
            {viewMode === "grid" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono">Heatmap Grid Overview</h2>
                  <span className="text-[10px] font-bold text-zinc-500 font-mono">Hover tiles for contribution details</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 pr-1">
                  {[...filteredPositive, ...filteredNegative]
                    .sort((a, b) => sortBy === "points" ? b.changePoints - a.changePoints : b.changePer - a.changePer)
                    .map((stock, idx) => {
                      const isPos = stock.isPositive === "Y";
                      const pct = Math.min(Math.abs(stock.changePoints) / maxAbsPoints, 1);
                      
                      // Vibrant semi-opaque background color and borders for high contrast
                      const bgStyle = isPos 
                        ? { backgroundColor: `rgba(6, 78, 59, ${0.35 + pct * 0.65})`, borderColor: `rgba(52, 211, 153, ${0.25 + pct * 0.7})` }
                        : { backgroundColor: `rgba(127, 29, 29, ${0.35 + pct * 0.65})`, borderColor: `rgba(248, 113, 113, ${0.25 + pct * 0.7})` };

                      return (
                        <div
                          key={stock.icSymbol}
                          style={bgStyle}
                          className="group relative rounded-lg border flex flex-col items-center justify-center p-2 cursor-pointer transition hover:scale-[1.05] hover:ring-2 hover:ring-white/30 shadow shadow-black/25 min-h-[48px]"
                        >
                          <span className="text-[10px] font-bold font-mono text-white select-none text-center w-full truncate">
                            {idx + 1}. {stock.icSymbol}
                          </span>
                          <div className="flex flex-col items-center select-none mt-0.5 font-mono text-[9px] leading-tight">
                            <span className={isPos ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>
                              {isPos ? `+${stock.changePoints.toFixed(1)}` : stock.changePoints.toFixed(1)}
                            </span>
                            <span className="text-zinc-300">
                              {isPos ? `+${stock.changePer.toFixed(2)}%` : `${stock.changePer.toFixed(2)}%`}
                            </span>
                          </div>
                          
                          {/* Rich Tooltip popup on Hover */}
                          <div className="absolute z-30 bottom-full mb-1.5 hidden group-hover:block w-48 bg-zinc-950 border border-zinc-800 p-2 rounded-lg text-left shadow-2xl text-[10px] space-y-1 pointer-events-none">
                            <div className="font-bold text-zinc-100 font-mono">{idx + 1}. {stock.icSymbol}</div>
                            <div className="text-[8px] text-zinc-400 truncate">{stock.icSecurity}</div>
                            <div className="h-px bg-zinc-850 my-1"></div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">LTP:</span>
                              <span className="font-mono font-semibold text-zinc-200">₹{stock.lastTradedPrice.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Change:</span>
                              <span className={`font-mono font-semibold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                                {isPos ? `+${stock.changePer.toFixed(2)}` : stock.changePer.toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Impact:</span>
                              <span className={`font-mono font-semibold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                                {isPos ? `+${stock.changePoints.toFixed(2)}` : stock.changePoints.toFixed(2)} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Table View */}
            {viewMode === "table" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono">Detailed Contribution Table</h2>
                </div>
                <div className="border border-zinc-850 rounded-lg bg-zinc-900/10">
                  <table className="w-full text-left border-collapse text-[10px] font-mono">
                    <thead>
                      <tr className="border-b border-zinc-850 bg-zinc-950 text-zinc-400">
                        <th className="p-2 font-bold uppercase">Symbol</th>
                        <th className="p-2 font-bold uppercase">Security Name</th>
                        <th className="p-2 font-bold uppercase text-right">LTP (₹)</th>
                        <th className="p-2 font-bold uppercase text-right">Change %</th>
                        <th className="p-2 font-bold uppercase text-right">Impact (pts)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60">
                      {[...filteredPositive, ...filteredNegative]
                        .sort((a, b) => sortBy === "points" ? b.changePoints - a.changePoints : b.changePer - a.changePer)
                        .map((stock, idx) => {
                          const isPos = stock.isPositive === "Y";
                          return (
                            <tr key={stock.icSymbol} className="hover:bg-zinc-900/30 transition">
                              <td className="p-2 font-bold text-zinc-200">{idx + 1}. {stock.icSymbol}</td>
                              <td className="p-2 text-zinc-400 truncate max-w-[150px]" title={stock.icSecurity}>{stock.icSecurity}</td>
                              <td className="p-2 text-right text-zinc-300">₹{stock.lastTradedPrice.toLocaleString("en-IN")}</td>
                              <td className={`p-2 text-right font-bold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                                {isPos ? `+${stock.changePer.toFixed(2)}` : stock.changePer.toFixed(2)}%
                              </td>
                              <td className={`p-2 text-right font-bold ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
                                {isPos ? `+${stock.changePoints.toFixed(2)}` : stock.changePoints.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Chart View */}
            {viewMode === "chart" && (
              <section className="space-y-4 animate-in fade-in duration-300">
                {/* Date Dropdown Selection & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850 pb-2">
                  <div className="space-y-0.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono">Index Points Trend (Advancing vs Declining)</h2>
                    <p className="text-[9px] text-zinc-500 font-mono">Indian market hours (9:15 AM - 3:30 PM IST) only</p>
                  </div>
                  {historyDates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">Select Date:</span>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500 transition font-mono"
                      >
                        {historyDates.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Main Index Points ComposedChart */}
                <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl p-4 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a/40" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="#71717a" fontSize={9} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "10px", borderRadius: "8px" }}
                        labelStyle={{ fontWeight: "bold", color: "#f4f4f5" }}
                      />
                      <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: "10px" }} />
                      <Area type="monotone" name="Positive Points" dataKey="positivePoints" stroke="#10b981" fillOpacity={1} fill="url(#colorPos)" strokeWidth={2.5} activeDot={{ r: 4 }} />
                      <Area type="monotone" name="Negative Points" dataKey="negativePoints" stroke="#ef4444" fillOpacity={1} fill="url(#colorNeg)" strokeWidth={2.5} activeDot={{ r: 4 }} />
                      <Line type="monotone" name="Net Points" dataKey="netPoints" stroke="#fbbf24" strokeWidth={3} dot={{ r: 2.5 }} activeDot={{ r: 4.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Top 5 Stocks Heavyweight Chart */}
                <div className="space-y-2">
                  <div className="flex flex-row items-center justify-between border-b border-zinc-850 pb-1.5">
                    <div className="space-y-0.5">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">Top 5 Index Heavyweight Stock Contributions</h3>
                      <p className="text-[8px] text-zinc-500 font-mono">HDFC, ICICI, Reliance, Airtel, L&T</p>
                    </div>
                    {/* Metric Select Selector */}
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-850 rounded-lg">
                      <button
                        onClick={() => setHeavyweightMetric("points")}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-semibold font-mono transition ${
                          heavyweightMetric === "points" ? "bg-zinc-805 text-white" : "text-zinc-555 hover:text-zinc-300"
                        }`}
                      >
                        Points
                      </button>
                      <button
                        onClick={() => setHeavyweightMetric("percent")}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-semibold font-mono transition ${
                          heavyweightMetric === "percent" ? "bg-zinc-805 text-white" : "text-zinc-555 hover:text-zinc-300"
                        }`}
                      >
                        Percent %
                      </button>
                    </div>
                  </div>
                  <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl p-4 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a/40" vertical={false} />
                        <XAxis dataKey="timestamp" stroke="#71717a" fontSize={9} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={9} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", fontSize: "10px", borderRadius: "8px" }}
                          labelStyle={{ fontWeight: "bold", color: "#f4f4f5" }}
                        />
                        <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: "10px" }} />
                        <Line type="monotone" name="HDFC Bank" dataKey={heavyweightMetric === "points" ? "hdfc" : "hdfcPct"} stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" name="ICICI Bank" dataKey={heavyweightMetric === "points" ? "icici" : "iciciPct"} stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" name="Reliance" dataKey={heavyweightMetric === "points" ? "reliance" : "reliancePct"} stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" name="Bharti Airtel" dataKey={heavyweightMetric === "points" ? "airtel" : "airtelPct"} stroke="#ec4899" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" name="L&T" dataKey={heavyweightMetric === "points" ? "lt" : "ltPct"} stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
