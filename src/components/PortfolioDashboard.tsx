"use client";
import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import isEqual from "lodash.isequal";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { StockDetailPage } from './StockDetailPage';

interface Holding {
  symbol: string;
  shares: number;
  avg_price: number;
  current_price: number;
  equity: number;
  percent_change: number;
}

function parseAmount(amountStr: string): number {
  // Remove $ and commas, handle parentheses for negatives
  if (!amountStr) return 0;
  let cleaned = amountStr.replace(/[$,]/g, "").trim();
  if (cleaned.startsWith("(")) {
    cleaned = "-" + cleaned.replace(/[()]/g, "");
  }
  return parseFloat(cleaned) || 0;
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function getGeminiSummary(csvText: string): Promise<string> {
  try {
    if (!GEMINI_API_KEY) {
      return "No Gemini API key set in environment.";
    }
    const prompt = `Summarize this investment report in plain English. Highlight key holdings, trends, and any unusual activity. Limit your answer to 3 sentences.\n\n${csvText}`;
    const response = await axios.post(
      GEMINI_API_URL + `?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      },
      { headers: { "Content-Type": "application/json" } }
    );
    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned.";
    // Truncate to 3 sentences max
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 3) {
      text = sentences.slice(0, 3).join(' ').trim();
    }
    return text;
  } catch (err: any) {
    return "Failed to get summary from Gemini.";
  }
}

// Helper functions for summary block
function getTotalValue(holdings: Holding[]) {
  return holdings.reduce((sum, h) => sum + (h.equity || 0), 0);
}
function getTotalInvested(holdings: Holding[]) {
  return holdings.reduce((sum, h) => sum + ((h.avg_price || 0) * (h.shares || 0)), 0);
}
function getTopGainer(holdings: Holding[]) {
  return holdings.reduce((max, h) => (h.percent_change > (max?.percent_change ?? -Infinity) ? h : max), holdings[0]);
}
function getTopLoser(holdings: Holding[]) {
  return holdings.reduce((min, h) => (h.percent_change < (min?.percent_change ?? Infinity) ? h : min), holdings[0]);
}
// Calculate day change from sparkline data
function getDayChange(holdings: Holding[], sparklineDataMap: Record<string, number[]>) {
  if (holdings.length === 0) return { value: 0, percent: 0 };
  
  let totalDayChange = 0;
  let totalPreviousValue = 0;
  
  holdings.forEach(h => {
    const sparklineData = sparklineDataMap[h.symbol];
    if (sparklineData && sparklineData.length >= 2) {
      const currentPrice = sparklineData[sparklineData.length - 1]; // Latest price
      const previousPrice = sparklineData[sparklineData.length - 2]; // Previous day price
      const dayChange = currentPrice - previousPrice;
      const dayChangeValue = dayChange * h.shares;
      
      totalDayChange += dayChangeValue;
      totalPreviousValue += previousPrice * h.shares;
    }
  });
  
  const dayChangePercent = totalPreviousValue > 0 ? (totalDayChange / totalPreviousValue) * 100 : 0;
  
  return { 
    value: totalDayChange, 
    percent: dayChangePercent 
  };
}

// Helper: simple crypto logo mapping (SVGs in public/ or emoji fallback)
const cryptoLogos: Record<string, string> = {
  BTC: '/public/btc.svg',
  ETH: '/public/eth.svg',
  DOGE: '/public/doge.svg',
  SOL: '/public/sol.svg',
  LTC: '/public/ltc.svg',
  BCH: '/public/bch.svg',
  // Add more as needed
};
function getCryptoLogo(symbol: string) {
  if (cryptoLogos[symbol]) {
    return <img src={cryptoLogos[symbol]} alt={symbol} className="inline w-5 h-5 mr-2 align-middle" />;
  }
  // fallback to emoji
  if (symbol === 'BTC') return '₿ ';
  if (symbol === 'ETH') return 'Ξ ';
  if (symbol === 'DOGE') return 'Ð ';
  if (symbol === 'SOL') return '◎ ';
  if (symbol === 'LTC') return 'Ł ';
  if (symbol === 'BCH') return 'Ƀ ';
  return '';
}

// Helper: generate mock sparkline data (random walk)
function getMockSparklineData(seed: number = 100, points: number = 12) {
  let arr = [seed];
  for (let i = 1; i < points; i++) {
    arr.push(arr[i - 1] + (Math.random() - 0.5) * 10);
  }
  return arr;
}

// Demo sector mapping (expand as needed)
const sectorMap: Record<string, string> = {
  BTC: 'Crypto', ETH: 'Crypto', DOGE: 'Crypto', SOL: 'Crypto', LTC: 'Crypto', BCH: 'Crypto',
  MSFT: 'Tech', AAPL: 'Tech', NVDA: 'Tech', GOOG: 'Tech', GOOGL: 'Tech',
  SCHD: 'Dividends', VOO: 'Tech', SPDV: 'Dividends',
  DLR: 'Real Estate',
  // Add more as needed
};
function getSector(symbol: string) {
  return sectorMap[symbol] || 'Other';
}
function getSectorData(holdings: Holding[]) {
  const sectorTotals: Record<string, number> = {};
  holdings.forEach(h => {
    const sector = getSector(h.symbol);
    sectorTotals[sector] = (sectorTotals[sector] || 0) + (h.equity || 0);
  });
  return Object.entries(sectorTotals).map(([name, value]) => ({ name, value }));
}
const sectorColors = ['#60a5fa', '#f59e42', '#34d399', '#f87171', '#a78bfa', '#fbbf24', '#818cf8'];

export function PortfolioDashboard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<string>("");
  const [header, setHeader] = useState<string>("InvAI");
  const [holdingsTitle, setHoldingsTitle] = useState<string>("Portfolio Holdings");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const prevHoldingsRef = useRef<Holding[] | null>(null);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);
  const [sectorData, setSectorData] = useState<{ name: string; value: number }[]>([]);
  const aiInsightsLoaded = useRef(false);
  const sectorDataLoaded = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [selectedInsightSymbol, setSelectedInsightSymbol] = useState<string | null>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(80); // Logo size in pixels


  React.useEffect(() => {
    if (summaryRef.current) {
      summaryRef.current.style.height = 'auto';
      summaryRef.current.style.height = summaryRef.current.scrollHeight + 'px';
    }
  }, [portfolioSummary, loadingSummary]);

  // Fetch portfolio from backend API on mount and every 1 minute
  useEffect(() => {
    let interval: NodeJS.Timeout;
    async function fetchPortfolio() {
      try {
        const res = await fetch("/api/portfolio");
        const data = await res.json();
        if (Array.isArray(data)) {
          setHoldings(data);
          setInitialLoading(false); // Set loading to false after first load
        }
      } catch (err) {
        setError("Failed to fetch portfolio from backend.");
      }
    }
    fetchPortfolio();
    interval = setInterval(fetchPortfolio, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function updateSummary() {
      if (holdings.length === 0) {
        setPortfolioSummary("");
        return;
      }
    setLoadingSummary(true);
      // Convert holdings to CSV for Gemini
      const fields = ["Symbol", "Shares", "Avg Price", "Current Price", "Equity", "% Change"];
      const rows = [fields.join(","), ...holdings.map(h => `${h.symbol},${h.shares},${h.avg_price},${h.current_price},${h.equity},${h.percent_change}`)];
      const csvText = rows.join("\n");
            const summary = await getGeminiSummary(csvText);
            setPortfolioSummary(summary);
            setLoadingSummary(false);
          }
    updateSummary();
    // Only run on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New effect: generate AI Insights and sector allocation only after holdings are loaded
  useEffect(() => {
    if (holdings.length === 0) return;
    if (!aiInsightsLoaded.current) {
      aiInsightsLoaded.current = true;
      (async () => {
        setLoadingAiInsights(true);
        const fields = ["Symbol", "Shares", "Avg Price", "Current Price", "Equity", "% Change"];
        const rows = [fields.join(","), ...holdings.map(h => `${h.symbol},${h.shares},${h.avg_price},${h.current_price},${h.equity},${h.percent_change}`)];
        const csvText = rows.join("\n");
        const prompt = `You are an AI investment assistant. Analyze this portfolio and provide a concise, direct insight or recommendation for the investor. Do not include any introductory phrases or unnecessary words—just the answer.\n\n${csvText}`;
        const summary = await getGeminiSummary(prompt);
        setAiInsights(summary);
        setLoadingAiInsights(false);
      })();
    }
    if (!sectorDataLoaded.current) {
      sectorDataLoaded.current = true;
      (async () => {
        try {
          const symbols = holdings.map(h => h.symbol).join(',');
          const response = await fetch(`http://localhost:8000/sector-allocation?symbols=${encodeURIComponent(symbols)}`);
          const data = await response.json();
          
          // Convert the backend response to the format expected by the pie chart
          const sectorDataArray = Object.entries(data).map(([name, percentage]) => ({
            name,
            value: percentage as number
          }));
          
          setSectorData(sectorDataArray);
        } catch (error) {
          console.error('Failed to fetch sector allocation:', error);
          // Fallback to local calculation if API fails
          setSectorData(getSectorData(holdings));
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // Fetch asset insights on initial load
  // Remove initial fetch of all insights
  // Add loading state for per-asset insight
  const [assetInsights, setAssetInsights] = useState<Record<string, string>>({});
  const [loadingAssetInsight, setLoadingAssetInsight] = useState<Record<string, boolean>>({});

  // Fetch insight on click
  const handleInsightClick = async (symbol: string) => {
    setSelectedInsightSymbol(symbol);
    setShowInsightModal(true);
    
    if (!assetInsights[symbol] && !loadingAssetInsight[symbol]) {
      setLoadingAssetInsight(prev => ({ ...prev, [symbol]: true }));
      try {
        const res = await fetch(`/api/asset-insights?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();
        setAssetInsights(prev => ({ ...prev, [symbol]: data.insight || data[symbol] || "No insight available." }));
      } catch {
        setAssetInsights(prev => ({ ...prev, [symbol]: "Failed to fetch insight." }));
      } finally {
        setLoadingAssetInsight(prev => ({ ...prev, [symbol]: false }));
      }
    }
  };

  // Handle stock row click
  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);
  };

  // Filtering logic
  const filteredHoldings = holdings.filter(h => {
    const matchesSearch =
      h.symbol.toLowerCase().includes(search.toLowerCase());
    const matchesAsset =
      assetFilter === "All" ||
      (assetFilter === "Stocks" && !["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"].includes(h.symbol)) ||
      (assetFilter === "Crypto" && ["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"].includes(h.symbol));
    return matchesSearch && matchesAsset;
  });
  const stocks = filteredHoldings.filter(h => !["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"].includes(h.symbol));
  const cryptos = filteredHoldings.filter(h => ["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"].includes(h.symbol));

  // Fetch real sparkline data from backend
  const [sparklineDataMap, setSparklineDataMap] = useState<Record<string, number[]>>({});

  useEffect(() => {
    async function fetchSparklines() {
      if (holdings.length === 0) return;
      
      try {
        const symbols = holdings.map(h => h.symbol);
        const response = await fetch(`http://localhost:8000/sparklines?symbols=${symbols.join(',')}`);
        const data = await response.json();
        
        const map: Record<string, number[]> = {};
        holdings.forEach(h => {
          const sparklineData = data[h.symbol] || getMockSparklineData(h.equity);
          map[h.symbol] = sparklineData;
          console.log(`Sparkline data for ${h.symbol}:`, sparklineData);
        });
        setSparklineDataMap(map);
      } catch (error) {
        // Fallback to mock data if API fails
        const map: Record<string, number[]> = {};
        holdings.forEach(h => {
          map[h.symbol] = getMockSparklineData(h.equity);
        });
        setSparklineDataMap(map);
    }
  }

    fetchSparklines();
  }, [holdings]);

  // Show stock detail page if a stock is selected
  if (selectedStock) {
    return (
      <StockDetailPage 
        symbol={selectedStock} 
        onBack={() => setSelectedStock(null)}
        aiInsight={aiInsights}
      />
    );
  }

  return (
    <div className="relative">
      {initialLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm overflow-hidden">
          {/* Falling Money Icons */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute text-green-400 text-2xl animate-bounce"
                style={{
                  left: `${(i * 5) % 100}%`,
                  animationDelay: `${(i * 0.1) % 2}s`,
                  animationDuration: `${1 + (i * 0.05) % 1}s`,
                  top: '-50px'
                }}
              >
                💰
              </div>
            ))}
            {[...Array(15)].map((_, i) => (
              <div
                key={`dollar-${i}`}
                className="absolute text-green-400 text-xl font-bold animate-bounce"
                style={{
                  left: `${(i * 6.67) % 100}%`,
                  animationDelay: `${(i * 0.13) % 2}s`,
                  animationDuration: `${0.8 + (i * 0.03) % 0.4}s`,
                  top: '-50px'
                }}
              >
                $
              </div>
            ))}
          </div>
          {/* Loading Spinner */}
          <div className="relative z-10">
            <svg className="animate-spin h-12 w-12 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        </div>
      )}
      <div className={initialLoading ? "filter blur-sm pointer-events-none select-none" : ""}>
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top Nav/Header */}
          <header className="sticky top-0 z-40 flex items-center justify-between px-45 py-4 bg-black">
            <img
              src="/project-invai.jpg"
              alt="InvAI"
              style={{ height: '100px', width: '150px' }}  // or whatever size you want
        />
            <button className="hover:bg-zinc-800 text-white px-0 py-2 rounded-lg font-medium transition-colors">
              Chris' Investment Portfolio
        </button>
      </header>
          {holdings.length > 0 && (
            <div className="sticky top-[64px] z-30 w-full h-14 flex items-center overflow-x-hidden bg-black">
              <div className="animate-marquee whitespace-nowrap px-4 flex gap-8 items-center" style={{ animation: 'marquee 30s linear infinite' }}>
                {holdings.map((h, i) => (
                  <span key={i} className="font-mono text-base md:text-lg text-white">
                    {h.symbol}: <span className={h.percent_change > 0 ? "text-green-400" : h.percent_change < 0 ? "text-red-400" : "text-blue-400"}>${h.current_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row gap-60 p-8 bg-black mt-16 justify-center items-start">
        {/* Portfolio Section */}
        <section className="flex-1 max-w-3xl">
              {/* Portfolio Summary Header and Search/Filter Bar in a row */}
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 ml-16 mb-2 max-w-7xl justify-between">
                <h2 className="text-2xl font-bold text-white">Portfolio Summary</h2>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
          <input
                    type="text"
                    placeholder="Search by symbol or keyword..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-zinc-900 text-white rounded-2xl px-3 py-2 outline-none border border-zinc-700 focus:border-blue-400 w-full md:w-64"
                  />
                  <select
                    value={assetFilter}
                    onChange={e => setAssetFilter(e.target.value)}
                    className="bg-zinc-900 text-white rounded-2xl px-3 py-2 outline-none border border-zinc-700 focus:border-blue-400"
                  >
                    <option value="All">All</option>
                    <option value="Stocks">Stocks</option>
                    <option value="Crypto">Crypto</option>
                  </select>
                </div>
              </div>
              {holdings.length > 0 && (
                <div className="ml-16 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-7xl">
                  <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col items-start">
                    <span className="text-xs text-zinc-400">Total Portfolio Value</span>
                    <span className="text-xl font-bold text-white">${getTotalValue(holdings).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col items-start">
                    <span className="text-xs text-zinc-400">Day Change</span>
                    <span className="text-xl font-bold text-white">+${getDayChange(holdings, sparklineDataMap).value.toLocaleString(undefined, { maximumFractionDigits: 2 })} (+{getDayChange(holdings, sparklineDataMap).percent.toFixed(2)}%)</span>
                  </div>
                  <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col items-start">
                    <span className="text-xs text-zinc-400">Top Gainer</span>
                    <span className="text-xl font-bold text-green-400">{getTopGainer(holdings)?.symbol}</span>
                    <span className="text-xl font-bold text-green-400">{getTopGainer(holdings)?.percent_change?.toFixed(2)}%</span>
                  </div>
                  <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col items-start">
                    <span className="text-xs text-zinc-400">Top Loser</span>
                    <span className="text-xl font-bold text-red-400">{getTopLoser(holdings)?.symbol}</span>
                    <span className="text-xl font-bold text-red-400">{getTopLoser(holdings)?.percent_change?.toFixed(2)}%</span>
                  </div>
                </div>
              )}
              {/* Portfolio Holdings Header (moved and renamed) */}
              <h2 className="ml-16 text-2xl font-bold text-white mt-8 mb-2">Holdings</h2>
              {error && <div className="text-red-400 mt-2">{error}</div>}
              {holdings.length === 0 ? (
                <div className="text-zinc-400">No holdings found.</div>
              ) : (
                <>
                  {/* Stocks Section */}
                  {stocks.length > 0 && (
                    <div className="flex flex-col gap-0 w-full max-w-7xl ml-16 mb-8">
                      <h3 className="text-lg font-bold text-white mb-2">Stocks</h3>
                      {/* Header row */}
                      <div className="flex items-center px-4 py-2 text-zinc-400 text-xs md:text-sm border-b border-zinc-700 bg-black rounded-t">
                        <div className="w-20 font-mono">Symbol</div>
                        <div className="w-24 text-right">Shares</div>
                        <div className="w-40 text-right">Current Price</div>
                        <div className="w-36 text-right">Avg. Price</div>
                        <div className="w-32 text-right">Equity</div>
                        <div className="w-40 text-right pr-0">Trend (1 week)</div>
                        <div className="w-20 text-right pr-6 pl-8">Change</div>
                        <div className="w-12 text-center pl-6">Insight</div>
                      </div>
                      {stocks.map((h, i) => (
                        <React.Fragment key={i}>
                          <div
                            className="bg-black flex items-center px-4 py-2 md:py-1 rounded-none relative cursor-pointer hover:bg-zinc-900 transition-colors"
                            style={{ borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0 }}
                            onClick={() => handleStockClick(h.symbol)}
                          >
                            <div className="w-20 font-mono text-sm md:text-base font-bold">{h.symbol}</div>
                            <div className="w-24 text-right text-sm md:text-base font-mono">{h.shares?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                            <div className="w-40 text-right text-sm md:text-base font-mono">${h.current_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-36 text-right text-sm md:text-base font-mono">${h.avg_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-32 text-right text-sm md:text-base font-mono">${h.equity?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-40 flex justify-center pl-4">
                              {sparklineDataMap[h.symbol] && sparklineDataMap[h.symbol].length > 0 ? (
                                <Sparklines data={sparklineDataMap[h.symbol]} width={60} height={20} margin={2}>
                                  <SparklinesLine color={sparklineDataMap[h.symbol][sparklineDataMap[h.symbol].length - 1] >= sparklineDataMap[h.symbol][0] ? "#34d399" : "#f87171"} style={{ fill: "none", strokeWidth: 2 }} />
                                </Sparklines>
                              ) : (
                                <div className="w-[60px] h-[20px] bg-zinc-800 rounded"></div>
              )}
            </div>
                            <div className={`w-20 text-right font-bold text-sm md:text-base font-mono ${h.percent_change > 0 ? 'text-green-400' : h.percent_change < 0 ? 'text-red-400' : 'text-zinc-200'}`}>{h.percent_change?.toFixed(2)}%</div>
                            <div className="w-12 flex justify-center pl-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInsightClick(h.symbol);
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="View AI Insight"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {i !== stocks.length - 1 && (
                            <div className="border-t border-zinc-700 mx-2" style={{ height: 1 }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  {/* Crypto Section */}
                  {cryptos.length > 0 && (
                    <div className="flex flex-col gap-0 w-full max-w-7xl ml-16 mb-8">
                      <h3 className="text-lg font-bold text-white mb-2">Cryptocurrency</h3>
                      {/* Header row */}
                      <div className="flex items-center px-4 py-2 text-zinc-400 text-xs md:text-sm border-b border-zinc-700 bg-black rounded-t">
                        <div className="w-20 font-mono">Symbol</div>
                        <div className="w-24 text-right">Shares</div>
                        <div className="w-40 text-right">Current Price</div>
                        <div className="w-36 text-right">Avg. Price</div>
                        <div className="w-32 text-right">Equity</div>
                        <div className="w-40 text-right pr-6">Trend (1 week)</div>
                        <div className="w-20 text-right pr-6 pl-4">Change</div>
                        <div className="w-30 text-center pl-4">Insight</div>
          </div>
                      {cryptos.map((h, i) => (
                        <React.Fragment key={i}>
                          <div
                            className="bg-black flex items-center px-4 py-2 md:py-1 rounded-none relative cursor-pointer hover:bg-zinc-900 transition-colors"
                            style={{ borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0 }}
                            onClick={() => handleStockClick(h.symbol)}
                          >
                            <div className="w-20 font-mono text-sm md:text-base font-bold">{h.symbol}</div>
                            <div className="w-24 text-right text-sm md:text-base font-mono">{h.shares?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                            <div className="w-40 text-right text-sm md:text-base font-mono">${h.current_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-36 text-right text-sm md:text-base font-mono">${h.avg_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-32 text-right text-sm md:text-base font-mono">${h.equity?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            <div className="w-40 flex justify-center pl-4">
                              {sparklineDataMap[h.symbol] && sparklineDataMap[h.symbol].length > 0 ? (
                                <Sparklines data={sparklineDataMap[h.symbol]} width={60} height={20} margin={2}>
                                  <SparklinesLine color={sparklineDataMap[h.symbol][sparklineDataMap[h.symbol].length - 1] >= sparklineDataMap[h.symbol][0] ? "#34d399" : "#f87171"} style={{ fill: "none", strokeWidth: 2 }} />
                                </Sparklines>
                              ) : (
                                <div className="w-[60px] h-[20px] bg-zinc-800 rounded"></div>
                              )}
                            </div>
                            <div className={`w-20 text-right font-bold text-sm md:text-base font-mono ${h.percent_change > 0 ? 'text-green-400' : h.percent_change < 0 ? 'text-red-400' : 'text-zinc-200'}`}>{h.percent_change?.toFixed(2)}%</div>
                            <div className="w-12 flex justify-center pl-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInsightClick(h.symbol);
                                }}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="View AI Insight"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {i !== cryptos.length - 1 && (
                            <div className="border-t border-zinc-700 mx-2" style={{ height: 1 }} />
                          )}
                        </React.Fragment>
                ))}
                    </div>
                  )}
                </>
          )}
        </section>
            {/* Right Sidebar: AI Insights Card only */}
            <aside className="md:w-[36rem] w-full bg-black rounded-3xl p-6 flex flex-col gap-6 border border-zinc-800 mt-0">
              {/* AI Insights Card - wraps tightly around text */}
              <div className="bg-black rounded p-4 flex flex-col items-start w-fit min-h-0 max-w-full">
                <span className="text-xs text-zinc-400 mb-1">AI Insights</span>
                {loadingAiInsights ? (
                  <span className="text-zinc-400">Generating insight...</span>
                ) : (
                  <div className="text-base text-white break-words whitespace-pre-line">
                    <ReactMarkdown>{aiInsights}</ReactMarkdown>
                  </div>
                )}
          </div>
              {/* Mini Sector Allocation Pie Chart */}
              <div className="bg-black rounded p-4 flex flex-col items-start w-full">
                <span className="text-xs text-zinc-400 mb-2">Sector Allocation</span>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sectorData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {sectorData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={sectorColors[idx % sectorColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
          </div>
        </aside>
      </main>
        </div>
      </div>
      
      {/* Insight Modal */}
      {showInsightModal && selectedInsightSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full mx-4 border border-zinc-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">AI Insight for {selectedInsightSymbol}</h3>
              <button
                onClick={() => setShowInsightModal(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-white">
              {loadingAssetInsight[selectedInsightSymbol] ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-blue-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="text-zinc-400">Generating insight...</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">
                  {assetInsights[selectedInsightSymbol] || "No insight available."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 