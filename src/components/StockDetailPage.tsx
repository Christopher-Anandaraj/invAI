"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from "axios";
import ReactMarkdown from "react-markdown";

interface StockDetailPageProps {
  symbol: string;
  onBack: () => void;
  aiInsight?: string;
}

interface StockData {
  symbol: string;
  longName?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  dividend: number;
  dividendYield: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  currentPrice: number; // For real-time updates on hover
  // Additional key stats
  aum?: number;
  thirtyDayYield?: number;
  averageVolume?: number;
  highToday?: number;
  lowToday?: number;
  openPrice?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface StockSummary {
  info: any;
  fundamentals: {
    pe_ratio?: number;
    market_cap?: number;
    volume?: number;
    "52w_high"?: number;
    "52w_low"?: number;
    expense_ratio?: number;
    yield?: number;
  };
  dividends: Record<string, number>;
  splits: Record<string, number>;
  news: Array<{
    title: string;
    link: string;
    publisher: string;
    published: number;
    summary: string;
  }>;
}

interface ChartData {
  date: string;
  price: number;
  volume: number;
}

// Custom Tooltip for LineChart
const CustomTooltip = ({ active, label, coordinate }: any) => {
  if (!active || !label || !coordinate || typeof coordinate.x !== 'number') return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: coordinate.x + 10,
        top: -15, // Fixed vertical position (adjust as needed)
        transform: 'translate(-50%, 0)',
        pointerEvents: 'none',
        zIndex: 10,
        minWidth: 100,
      }}
      className="text-white text-xs font-mono"
    >
      {label}
    </div>
  );
};

export function StockDetailPage({ symbol, onBack }: StockDetailPageProps) {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loadingChart, setLoadingChart] = useState(true); // Only for chart/price
  const [loadingSummary, setLoadingSummary] = useState(true); // For summary/news/insight
  const [loadingPage, setLoadingPage] = useState(true); // For full-page spinner on initial load
  const [chartInteractable, setChartInteractable] = useState(false); // For delayed interaction
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredChange, setHoveredChange] = useState<number | null>(null);
  const [hoveredChangePercent, setHoveredChangePercent] = useState<number | null>(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<string>("");
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [quickInsight, setQuickInsight] = useState<string>("");
  const [loadingQuickInsight, setLoadingQuickInsight] = useState(false);
  const lastSentimentSymbol = useRef<string | null>(null);

  // Fetch summary/news/insight only on symbol change
  useEffect(() => {
    setLoadingPage(true);
    setLoadingSummary(true);
    setStockSummary(null);
    setSentimentAnalysis("");
    setQuickInsight("");
    lastSentimentSymbol.current = null;
    const fetchSummary = async () => {
      try {
        const response = await fetch(`http://localhost:8000/stock-detail?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
        const data = await response.json();
        if (data.success && data.stockSummary) {
          setStockSummary(data.stockSummary);
        }
      } catch (error) {
        setStockSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };
    fetchSummary();
  }, [symbol]);

  // Fetch chart/price data on symbol or timeframe change
  useEffect(() => {
    fetchChartData();
  }, [symbol, timeframe]);

  // After chart loads, start a 4s timer before allowing interaction
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (!loadingChart) {
      timer = setTimeout(() => setChartInteractable(true), 2000);
    } else {
      setChartInteractable(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loadingChart]);

  const fetchChartData = async () => {
    setLoadingChart(true);
    setChartData([]); // Clear chart data immediately to prevent flash of old chart
    try {
      const response = await fetch(`http://localhost:8000/stock-detail?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
      const data = await response.json();
      if (data.success) {
        const chartData = data.chartData;
        if (chartData && chartData.length > 0) {
          const prices = chartData.map((d: any) => d.price);
          const timeframeData = {
            ...data.stockData,
            high: Math.max(...prices),
            low: Math.min(...prices),
            open: chartData[0].price,
            currentPrice: data.stockData.price
          };
          setStockData(timeframeData);
        } else {
          setStockData(data.stockData);
        }
        setChartData(chartData);
      }
    } catch (error) {
      const mockChartData = generateMockChartData();
      const prices = mockChartData.map(d => d.price);
      setStockData({
        symbol,
        price: 150.25,
        change: 2.15,
        changePercent: 1.45,
        volume: 45000000,
        marketCap: 2500000000000,
        pe: 25.5,
        dividend: 0.88,
        dividendYield: 2.1,
        high: Math.max(...prices),
        low: Math.min(...prices),
        open: mockChartData[0].price,
        previousClose: 148.10,
        currentPrice: 150.25
      });
      setChartData(mockChartData);
    } finally {
      setLoadingChart(false);
      setLoadingPage(false); // Only set loadingPage to false after chart data loads
    }
  };

  // Only load sentiment analysis once per stock page open (per symbol)
  useEffect(() => {
    if (
      symbol &&
      stockSummary &&
      stockSummary.news &&
      stockSummary.news.length > 0 &&
      lastSentimentSymbol.current !== symbol
    ) {
      lastSentimentSymbol.current = symbol;
      setLoadingSentiment(true);
      getSentimentAnalysis(stockSummary.news).then(() => setLoadingSentiment(false));
    }
  }, [symbol, stockSummary]);

  // Fetch per-stock AI insight for Quick Insight card (on symbol change)
  useEffect(() => {
    const fetchQuickInsight = async () => {
      setLoadingQuickInsight(true);
      try {
        const res = await fetch(`/api/asset-insights?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();
        setQuickInsight(data.insight || "No insight available for this stock.");
      } catch (err) {
        setQuickInsight("Failed to load insight.");
      } finally {
        setLoadingQuickInsight(false);
      }
    };
    fetchQuickInsight();
  }, [symbol]);

  const generateMockChartData = (): ChartData[] => {
    const data: ChartData[] = [];
    const basePrice = 150;
    const days = timeframe === '1D' ? 24 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : 365;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      data.push({
        date: date.toLocaleDateString(),
        price: basePrice + (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 50000000) + 10000000
      });
    }
    
    return data;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  const getSentimentAnalysis = async (news: any[]) => {
    if (!news || news.length === 0) return;
    
    setLoadingSentiment(true);
    try {
      // Filter out undefined articles and extract content from the nested structure
      const validNews = news.filter(article => 
        article && 
        article.content && 
        article.content.title && 
        article.content.summary
      );
      
      if (validNews.length === 0) {
        setSentimentAnalysis("No valid news articles available for sentiment analysis.");
        return;
      }
      
      const newsText = validNews.map(article => 
        `${article.content.title}: ${article.content.summary}`
      ).join('\n\n');
      
      const prompt = `Analyze the sentiment of these news articles about ${symbol}. Provide a concise analysis of the overall market sentiment and any potential impact on the stock price. Keep it to 2-3 sentences.\n\n${newsText}`;
      
      const response = await fetch('/api/asset-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSentimentAnalysis(data.insight || "No sentiment analysis available.");
      }
    } catch (error) {
      console.error('Failed to get sentiment analysis:', error);
      setSentimentAnalysis("Failed to analyze sentiment.");
    } finally {
      setLoadingSentiment(false);
    }
  };

  // Memoize the price card to avoid unnecessary re-renders
  const priceCard = useMemo(() => {
    if (!stockData) return null;
    // Disable hover handlers if loadingChart is true
    const handleMouseMove = loadingChart ? undefined : (data: any) => {
      if (data && data.activeLabel) {
        const point = chartData.find((d) => d.date === data.activeLabel);
        if (point && stockData) {
          const change = point.price - stockData.previousClose;
          const changePercent = (change / stockData.previousClose) * 100;
          if (
            point.price !== hoveredPrice ||
            change !== hoveredChange ||
            changePercent !== hoveredChangePercent
          ) {
            setHoveredPrice(point.price);
            setHoveredChange(change);
            setHoveredChangePercent(changePercent);
          }
        }
      }
    };
    const handleMouseLeave = loadingChart ? undefined : () => {
      setHoveredPrice(null);
      setHoveredChange(null);
      setHoveredChangePercent(null);
    };
    return (
      <div className="lg:col-span-2 bg-black rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            {stockData.longName && (
              <h3 className="text-lg text-zinc-400 mb-2">{stockData.longName}</h3>
            )}
            <h2 className="text-3xl font-bold">${(hoveredPrice ?? stockData.price).toFixed(2)}</h2>
            <div className={`flex items-center gap-2 text-lg ${
              (hoveredChange !== null ? hoveredChange : stockData.change) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              <span>{(hoveredChange !== null ? hoveredChange : stockData.change) >= 0 ? '+' : ''}{(hoveredChange !== null ? hoveredChange : stockData.change).toFixed(2)}</span>
              <span>({(hoveredChangePercent !== null ? hoveredChangePercent : stockData.changePercent).toFixed(2)}%)</span>
            </div>
          </div>
          <div className="text-right text-zinc-400">
            <div>Open: ${stockData.open?.toFixed(2) ?? 'N/A'}</div>
            <div>High: ${stockData.high?.toFixed(2) ?? 'N/A'}</div>
            <div>Low: ${stockData.low?.toFixed(2) ?? 'N/A'}</div>
          </div>
        </div>
        {/* Price Chart */}
        <div className="h-64 w-11/12 relative mt-15">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              key={timeframe + '-' + (chartData ? chartData.length : 0)}
              data={Array.isArray(chartData) ? [...chartData] : [{ date: '', price: 0 }]}
              onMouseMove={chartInteractable ? handleMouseMove : undefined}
              onMouseLeave={chartInteractable ? handleMouseLeave : undefined}
            >
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                domain={['dataMin - 5', 'dataMax + 5']}
                tickFormatter={(value) => Math.round(value).toString()}
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#6B7280', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartData && chartData.length > 0 && chartData[chartData.length - 1].price > chartData[0].price ? "#10B981" : "#EF4444"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Transparent overlay for the 2s timer after loading (no spinner, no background) */}
          {!loadingChart && !chartInteractable && (
            <div className="absolute inset-0 z-10" style={{ pointerEvents: 'all', background: 'transparent' }} />
          )}
        </div>
      </div>
    );
  }, [stockData, chartData, hoveredPrice, hoveredChange, hoveredChangePercent, loadingChart, chartInteractable]);

  // In the return, show a loading spinner only when loadingPage is true
  if (loadingPage) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <svg className="animate-spin h-12 w-12 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-black border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">{symbol}</h1>
        </div>
        <div className="flex gap-2">
          {(['1D', '1W', '1M', '3M', '1Y'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeframe === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6">
        {/* Stock Overview */}
        {stockData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Price Card */}
            {priceCard}

            {/* Key Metrics */}
            <div className="bg-black rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Key Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Market Cap</span>
                  <span className="font-mono">${formatNumber(stockData.marketCap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">AUM</span>
                  <span className="font-mono">{stockData.aum ? `$${formatNumber(stockData.aum)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">P/E Ratio</span>
                  <span className="font-mono">{stockData.pe ? stockData.pe.toFixed(2) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">30-Day Yield</span>
                  <span className="font-mono">{stockData.thirtyDayYield ? `${stockData.thirtyDayYield.toFixed(2)}%` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Volume</span>
                  <span className="font-mono">{formatNumber(stockData.volume)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Average Volume</span>
                  <span className="font-mono">{stockData.averageVolume ? formatNumber(stockData.averageVolume) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">High Today</span>
                  <span className="font-mono">{stockData.highToday ? `$${stockData.highToday.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Low Today</span>
                  <span className="font-mono">{stockData.lowToday ? `$${stockData.lowToday.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Open Price</span>
                  <span className="font-mono">{stockData.openPrice ? `$${stockData.openPrice.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">52 Week High</span>
                  <span className="font-mono">{stockData.fiftyTwoWeekHigh ? `$${stockData.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">52 Week Low</span>
                  <span className="font-mono">{stockData.fiftyTwoWeekLow ? `$${stockData.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Dividend Yield</span>
                  <span className="font-mono">{stockData.dividendYield ? `${stockData.dividendYield.toFixed(2)}%` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}



        {/* Dividends and Quick Insight */}
        {(stockSummary?.dividends && Object.keys(stockSummary.dividends).length > 0) ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Recent Dividends */}
            {stockSummary?.dividends && Object.keys(stockSummary.dividends).length > 0 && (
              <div className="bg-black rounded-xl p-6 border border-zinc-800">
                <h3 className="text-lg font-bold mb-4">Recent Dividends</h3>
                <div className="space-y-3">
                  {Object.entries(stockSummary.dividends).slice(0, 5).map(([date, amount]) => (
                    <div key={date} className="flex justify-between items-center">
                      <span className="text-zinc-400">{new Date(date).toLocaleDateString()}</span>
                      <span className="font-mono text-green-400">${amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Insight */}
            <div className="bg-black rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Quick Insight</h3>
              <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none">
                {loadingQuickInsight ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Loading insight...</span>
                  </div>
                ) : (
                  <ReactMarkdown>
                    {quickInsight || "No insight available for this stock."}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Quick Insight only if no dividends */
          <div className="mt-6">
            <div className="bg-black rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-bold mb-4">Quick Insight</h3>
              <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none">
                {loadingQuickInsight ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Loading insight...</span>
                  </div>
                ) : (
                  <ReactMarkdown>
                    {quickInsight || "No insight available for this stock."}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sentiment Analysis */}
        <div className="bg-black rounded-xl p-6 border border-zinc-800 mt-6">
          <h3 className="text-lg font-bold mb-4">Sentiment Analysis</h3>
          <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none">
            {!stockSummary ? (
              <div>Loading stock summary...</div>
            ) : !stockSummary.news ? (
              <div>No news data available.</div>
            ) : stockSummary.news.length === 0 ? (
              <div>No news articles found.</div>
            ) : loadingSentiment ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Analyzing sentiment...</span>
              </div>
            ) : (
              <ReactMarkdown>
                {sentimentAnalysis || "No sentiment analysis available."}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 