"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ExternalLink } from "lucide-react";

const pages = [
  { label: "Investing Indices", icon: "📈", url: "https://www.investing.com/indices", refreshable: false },
  { label: "S&P 500", icon: "🧭", url: "https://www.slickcharts.com/sp500", refreshable: true },
  { label: "S&P Heatmap", icon: "🔥", url: "https://www.slickcharts.com/sp500/heatmap", refreshable: true },
  { label: "Nasdaq 100", icon: "💹", url: "https://www.slickcharts.com/nasdaq100", refreshable: true },
  { label: "Nasdaq Heatmap", icon: "🌡️", url: "https://www.slickcharts.com/nasdaq100/heatmap", refreshable: true }
];

const externalLinks = [
  { label: "Yahoo Finance", icon: "🟣", url: "https://finance.yahoo.com/" },
  { label: "Perplexity Fin", icon: "🧠", url: "https://www.perplexity.ai/finance" },
  { label: "Discover", icon: "🔎", url: "https://www.perplexity.ai/discover" },
  { label: "Calendar", icon: "📅", url: "https://web.sensibull.com/stock-market-calendar/economic-calendar" },
  { label: "CME Simulator", icon: "🧪", url: "https://www.cmegroup.com/trading_tools/simulator" },
  { label: "TV S&P Chart", icon: "📊", url: "https://in.tradingview.com/symbols/SPCFD-SPX/" },
  { label: "TV Nasdaq Chart", icon: "💼", url: "https://www.tradingview.com/symbols/NASDAQ-NDX/" }
];

export default function USIndicesPage() {
  const [activeTab, setActiveTab] = useState(pages[0]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeUrl, setIframeUrl] = useState(pages[0].url);

  // Auto refresh effect
  useEffect(() => {
    if (!autoRefresh || !activeTab.refreshable) return;

    const interval = setInterval(() => {
      setIframeLoading(true);
      setIframeUrl(`${activeTab.url}?t=${Date.now()}`);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab]);

  const handleTabChange = (page: typeof pages[0]) => {
    setIframeLoading(true);
    setActiveTab(page);
    setIframeUrl(page.url);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#09090b]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Main Analytics
            </Link>
            <h1 className="text-xs font-bold text-zinc-200 uppercase tracking-widest hidden sm:block font-mono">
              US Market Indices Viewer
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-semibold text-zinc-400">Auto Refresh (3s)</span>
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
          </div>
        </div>
      </header>

      {/* Selector Tabs Bar */}
      <div className="bg-zinc-950/40 border-b border-zinc-850 p-2 overflow-x-auto flex items-center gap-2 scrollbar-none">
        {pages.map((page) => (
          <button
            key={page.url}
            onClick={() => handleTabChange(page)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab.url === page.url
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            <span>{page.icon}</span>
            {page.label}
          </button>
        ))}

        <div className="h-6 w-px bg-zinc-800 mx-2 shrink-0" />

        {externalLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-zinc-900/60 border border-zinc-850/60 hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-150 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <span>{link.icon}</span>
            {link.label}
            <ExternalLink className="h-3 w-3 text-zinc-500" />
          </a>
        ))}
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative bg-white min-h-[calc(100vh-120px)]">
        {iframeLoading && (
          <div className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-xs text-zinc-400 font-mono">Loading dynamic portal feed...</p>
            </div>
          </div>
        )}
        <iframe
          src={iframeUrl}
          className="w-full h-full min-h-[calc(100vh-120px)] border-none"
          onLoad={() => setIframeLoading(false)}
        />
      </div>
    </div>
  );
}
