"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Search, Sparkles, TrendingUp, TrendingDown, AlertTriangle, LayoutGrid, List, Table, Eye, EyeOff, CircleDot } from "lucide-react";

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

export default function Nifty50Page() {
  const [data, setData] = useState<StockContribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "table" | "circle">("list");
  const [sortBy, setSortBy] = useState<"points" | "percent">("points");

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const targetUrl = "https://www.nseindia.com/api/NextApi/apiClient/indexTrackerApi?functionName=getContributionData&index=NIFTY%2050&noofrecords=0&flag=1";

    // Define a list of alternative public CORS proxies to try sequentially
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

    let lastError = "";

    try {
      for (const proxy of proxies) {
        try {
          console.log(`Attempting to fetch Nifty 50 data via ${proxy.name}...`);
          const proxyUrl = proxy.getUrl(targetUrl);
          const res = await fetch(proxyUrl);

          if (!res.ok) {
            throw new Error(`${proxy.name} returned status: ${res.status} ${res.statusText}`);
          }

          const json = await proxy.parse(res);
          if (json && json.data) {
            setData(json.data);
            console.log(`Successfully loaded Nifty 50 data via ${proxy.name}`);
            return; // Success! Exit the function.
          } else {
            throw new Error(`${proxy.name} parsed data successfully, but 'data' field is missing.`);
          }
        } catch (err: any) {
          console.warn(`${proxy.name} failed:`, err.message || err);
          lastError += `${proxy.name}: ${err.message || err}\n`;
        }
      }

      // If we reach here, all proxies failed
      setError(`All live connection attempts failed:\n\n${lastError}`);
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
                    onClick={() => setViewMode("circle")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                      viewMode === "circle" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Circle View"
                  >
                    <CircleDot className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Circle</span>
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
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Positive Side */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-350 font-mono">
                        Advancing Side ({filteredPositive.length} - {((filteredPositive.length / (data.length || 1)) * 100).toFixed(0)}%) • <span className="text-emerald-400">+{positiveTotal.toFixed(2)} pts</span>
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-1 pr-1">
                    {filteredPositive.length === 0 ? (
                      <div className="text-center py-6 text-zinc-655 text-[11px] font-mono">No advancing stocks found</div>
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

                              <div className="relative flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-[11px] font-bold font-mono text-zinc-200">{idx + 1}. {stock.icSymbol}</span>
                                    <span className="text-[9px] text-zinc-500 truncate max-w-[120px] sm:max-w-[180px]">{stock.icSecurity}</span>
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-mono">
                                    Last: ₹{stock.lastTradedPrice.toLocaleString("en-IN")}
                                  </div>
                                </div>

                                <div className="text-right space-y-0.5 font-mono">
                                  <div className="text-[11px] font-bold text-emerald-400">
                                    +{stock.changePoints.toFixed(2)} pts
                                  </div>
                                  <div className="text-[9px] text-zinc-555">
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
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-355 font-mono">
                        Declining Side ({filteredNegative.length} - {((filteredNegative.length / (data.length || 1)) * 100).toFixed(0)}%) • <span className="text-rose-400">{negativeTotal.toFixed(2)} pts</span>
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-1 pr-1">
                    {filteredNegative.length === 0 ? (
                      <div className="text-center py-6 text-zinc-655 text-[11px] font-mono">No declining stocks found</div>
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

                              <div className="relative flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-[11px] font-bold font-mono text-zinc-200">{idx + 1}. {stock.icSymbol}</span>
                                    <span className="text-[9px] text-zinc-500 truncate max-w-[120px] sm:max-w-[180px]">{stock.icSecurity}</span>
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-mono">
                                    Last: ₹{stock.lastTradedPrice.toLocaleString("en-IN")}
                                  </div>
                                </div>

                                <div className="text-right space-y-0.5 font-mono">
                                  <div className="text-[11px] font-bold text-rose-400">
                                    {stock.changePoints.toFixed(2)} pts
                                  </div>
                                  <div className="text-[9px] text-zinc-555">
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

            {/* Circle View (Single outer circle container packing all stocks) */}
            {viewMode === "circle" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 font-mono">Bubble Circle Container Packing</h2>
                  <span className="text-[10px] font-bold text-zinc-500 font-mono">All stocks packed inside one index circle</span>
                </div>
                <div className="flex justify-center items-center py-4">
                  <div className="w-[500px] h-[500px] rounded-full border border-zinc-800 bg-[#09090b]/40 backdrop-blur-md relative flex flex-wrap items-center justify-center p-12 overflow-hidden shadow-inner shadow-black/80 gap-2">
                    {[...filteredPositive, ...filteredNegative]
                      .sort((a, b) => sortBy === "points" ? b.changePoints - a.changePoints : b.changePer - a.changePer)
                      .map((stock, idx) => {
                        const isPos = stock.isPositive === "Y";
                        const absPoints = Math.abs(stock.changePoints);
                        
                        // Calculate larger bubble size (diameter in px) based on impact significance to fit symbol, pts, and %
                        const size = Math.max(56, Math.min(104, 56 + (absPoints / maxAbsPoints) * 48));
                        
                        const bgStyle = isPos 
                          ? { backgroundColor: `rgba(6, 78, 59, ${0.45 + (absPoints / maxAbsPoints) * 0.55})`, borderColor: "rgba(52, 211, 153, 0.8)", width: `${size}px`, height: `${size}px` }
                          : { backgroundColor: `rgba(127, 29, 29, ${0.45 + (absPoints / maxAbsPoints) * 0.55})`, borderColor: "rgba(248, 113, 113, 0.8)", width: `${size}px`, height: `${size}px` };

                        return (
                          <div
                            key={stock.icSymbol}
                            style={bgStyle}
                            className="group relative rounded-full border flex flex-col items-center justify-center cursor-pointer transition hover:scale-110 hover:ring-2 hover:ring-white/40 shadow-lg text-center"
                          >
                            <span className="text-[8px] font-extrabold font-mono text-white drop-shadow-sm truncate max-w-[90%] select-none leading-none">
                              {idx + 1}. {stock.icSymbol}
                            </span>
                            <div className="flex flex-col items-center select-none font-mono text-[7px] leading-none mt-0.5">
                              <span className={isPos ? "text-emerald-200 font-bold" : "text-rose-200 font-bold"}>
                                {isPos ? `+${stock.changePoints.toFixed(1)}` : stock.changePoints.toFixed(1)}
                              </span>
                              <span className="text-zinc-200 mt-[1px]">
                                {isPos ? `+${stock.changePer.toFixed(1)}%` : `${stock.changePer.toFixed(1)}%`}
                              </span>
                            </div>

                            {/* Hover Tooltip */}
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
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
