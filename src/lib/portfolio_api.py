from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import robin_stocks.robinhood as r
import yfinance as yf
import requests
from concurrent.futures import ThreadPoolExecutor
from fastapi import Query
from typing import Optional
from collections import defaultdict
from fastapi.responses import JSONResponse

app = FastAPI()
load_dotenv()
# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# Helper: get 5-day price history for a symbol using yfinance
def get_5day_history(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="7d")
        
        if df.empty or 'Close' not in df.columns:
            return []

        # Round to 2 decimal places for cleaner output (optional)
        return df['Close'].round(2).tolist()
    
    except Exception as e:
        print(f"Error fetching 5-day history for {symbol}: {e}")
        return []

# Helper: call Gemini for a 1-sentence insight
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Do not print or log sensitive values
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
def get_gemini_insight(symbol, prices):
    if not GEMINI_API_KEY or not prices:
        print("[Gemini Insight] Missing API key or prices.")
        return "No insight available."
    prompt = f"Given the following trend of stock prices for {symbol}:\n{prices}\nWrite a 1-sentence insight about its trend and a speculative forecast for the next month."
    try:
        response = requests.post(
            GEMINI_API_URL + f"?key={GEMINI_API_KEY}",
            json={
                "contents": [
                    {"parts": [{"text": prompt}]}
                ]
            },
            headers={"Content-Type": "application/json"}
        )
        print(f"[Gemini Insight] Status: {response.status_code}")
        # Do not log response text as it may contain sensitive information
        data = response.json()
        return data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', 'No insight returned.')
    except Exception as e:
        print(f"[Gemini Insight] Exception: {e}")
        return "No insight available."

def get_sparkline_data(symbol):
    try:
        # Format crypto tickers for Yahoo Finance
        yf_symbol = symbol
        if symbol in ["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"] and not symbol.endswith("-USD"):
            yf_symbol = f"{symbol}-USD"
        hist = yf.Ticker(yf_symbol).history(period="7d", interval="1d")['Close']
        return {symbol: hist.dropna().tolist()}
    except Exception:
        return {symbol: []}



@app.get("/portfolio")
def get_portfolio():
    username = os.getenv("ROBINHOOD_USERNAME")
    password = os.getenv("ROBINHOOD_PASSWORD")
    if not username or not password:
        return {"error": "Missing credentials in .env"}
    # Do not print or log sensitive values
    r.login(username=username, password=password, store_session=True)
    # Stocks
    holdings_raw = r.build_holdings()
    portfolio = []
    if holdings_raw and isinstance(holdings_raw, dict):
        for symbol, info in holdings_raw.items():
            avg_price = float(info["average_buy_price"])
            current_price = float(info["price"])
            shares = float(info["quantity"])
            equity = float(info["equity"])
            percent_change = ((current_price - avg_price) / avg_price) * 100 if avg_price != 0 else 0
            portfolio.append({
                "symbol": symbol,
                "shares": shares,
                "avg_price": avg_price,
                "equity": equity,
                "current_price": current_price,
                "percent_change": round(percent_change, 2)
            })
    # Crypto
    crypto_positions = r.crypto.get_crypto_positions()
    if crypto_positions:
        for pos in crypto_positions:
            symbol = pos.get('currency', {}).get('code')
            quantity = float(pos.get('quantity', 0))
            cost_bases = pos.get('cost_bases', [])
            if cost_bases and isinstance(cost_bases, list):
                direct_cost_basis = float(cost_bases[0].get('direct_cost_basis', 0))
                direct_quantity = float(cost_bases[0].get('direct_quantity', 0))
            else:
                direct_cost_basis = 0.0
                direct_quantity = 0.0
            avg_price = (direct_cost_basis / direct_quantity) if direct_quantity else 0.0
            if symbol and quantity > 0:
                quote = r.crypto.get_crypto_quote(symbol)
                price = 0.0
                if isinstance(quote, dict) and 'mark_price' in quote:
                    price = float(quote['mark_price'])
                equity = quantity * price
                percent_change = ((price - avg_price) / avg_price) * 100 if avg_price != 0 else 0
                portfolio.append({
                    "symbol": symbol,
                    "shares": quantity,
                    "avg_price": avg_price,
                    "equity": round(equity, 2),
                    "current_price": round(price, 2),
                    "percent_change": round(percent_change, 2)
                })
    return portfolio

@app.get("/asset-insights")
def asset_insights(request: Request):
    symbol = request.query_params.get("symbol")

    if not symbol:
        return {"error": "Symbol query param is required."}

    # Format crypto tickers for Yahoo Finance
    yf_symbol = symbol
    if symbol in ["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"] and not symbol.endswith("-USD"):
        yf_symbol = f"{symbol}-USD"

    prices = get_5day_history(yf_symbol)
    insight = get_gemini_insight(yf_symbol, prices)

    return {"insight": insight} 

@app.get("/sparklines")
def get_sparklines(symbols: Optional[str] = Query(None, description="Comma-separated list of symbols")):
    print(f"[DEBUG] /sparklines called with symbols: {symbols}")
    if not symbols:
        return {}
    symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
    results = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        for result in executor.map(get_sparkline_data, symbol_list):
            results.update(result)
    return results

def get_sector_allocation(symbols):
    sector_allocation = defaultdict(float)
    total_equity = 0

    # Get portfolio data to access actual share quantities
    username = os.getenv("ROBINHOOD_USERNAME")
    password = os.getenv("ROBINHOOD_PASSWORD")
    if not username or not password:
        return {"error": "Missing credentials in .env"}
    
    r.login(username=username, password=password, store_session=True)
    
    # Get stock holdings
    holdings_raw = r.build_holdings()
    portfolio_data = {}
    
    if holdings_raw and isinstance(holdings_raw, dict):
        for symbol, info in holdings_raw.items():
            shares = float(info["quantity"])
            equity = float(info["equity"])
            portfolio_data[symbol] = {"shares": shares, "equity": equity}
    
    # Get crypto holdings
    crypto_positions = r.crypto.get_crypto_positions()
    if crypto_positions:
        for pos in crypto_positions:
            symbol = pos.get('currency', {}).get('code')
            quantity = float(pos.get('quantity', 0))
            if symbol and quantity > 0:
                quote = r.crypto.get_crypto_quote(symbol)
                price = 0.0
                if isinstance(quote, dict) and 'mark_price' in quote:
                    price = float(quote['mark_price'])
                equity = quantity * price
                portfolio_data[symbol] = {"shares": quantity, "equity": equity}

    # Calculate sector allocation using actual portfolio data
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            sector = info.get("sector", "Other")
            
            # Use actual equity from portfolio if available, otherwise use current price
            if symbol in portfolio_data:
                equity = portfolio_data[symbol]["equity"]
            else:
                price = info.get("regularMarketPrice", 0)
                equity = price  # fallback to 1 share if not in portfolio
            
            sector_allocation[sector] += equity
            total_equity += equity
        except Exception as e:
            print(f"Error for {symbol}: {e}")

    # Convert to percentage
    sector_percent = {k: round((v / total_equity) * 100, 2) for k, v in sector_allocation.items()}

    return sector_percent

@app.get("/sector-allocation")
def get_sector_allocation_endpoint(symbols: Optional[str] = Query(None, description="Comma-separated list of symbols")):
    print(f"[DEBUG] /sector-allocation called with symbols: {symbols}")
    if not symbols:
        return {}
    symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
    return get_sector_allocation(symbol_list)

def get_full_stock_summary(symbol):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "info": info,
            "fundamentals": {
                "pe_ratio": info.get("trailingPE"),
                "market_cap": info.get("marketCap"),
                "volume": info.get("volume"),
                "52w_high": info.get("fiftyTwoWeekHigh"),
                "52w_low": info.get("fiftyTwoWeekLow"),
                "expense_ratio": info.get("annualReportExpenseRatio"),
                "yield": info.get("yield"),
            },
            "dividends": ticker.dividends.tail(5).to_dict() if not ticker.dividends.empty else {},
            "splits": ticker.splits.tail(5).to_dict() if not ticker.splits.empty else {},
            "news": ticker.news[:5] if ticker.news else [],
        }
    except Exception as e:
        print(f"Error fetching full stock summary for {symbol}: {e}")
        return {
            "info": {},
            "fundamentals": {},
            "dividends": {},
            "splits": {},
            "news": []
        }

def get_finnhub_news(symbol):
    # Use the last 30 days for news
    from datetime import datetime, timedelta
    to_date = datetime.utcnow().date()
    from_date = to_date - timedelta(days=90)
    url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={from_date}&to={to_date}&token={os.environ.get('FINNHUB_API_KEY')}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        news = response.json()
        formatted = []
        for item in news[:5]:  # Limit to 5 articles
            formatted.append({
                "id": item.get("id") or item.get("datetime"),
                "content": {
                    "title": item.get("headline"),
                    "summary": item.get("summary"),
                    "pubDate": item.get("datetime"),
                    "provider": {"displayName": item.get("source")},
                    "clickThroughUrl": {"url": item.get("url")},
                }
            })
        print(formatted)
        return formatted
    except Exception as e:
        print(f"Error fetching Finnhub news: {e}")
        return []

@app.get("/stock-detail")
def get_stock_detail(symbol: str = Query(..., description="Stock symbol"), timeframe: str = Query("1M", description="Timeframe")):
    
    try:
        # Format crypto tickers for Yahoo Finance
        yf_symbol = symbol
        if symbol in ["BTC", "ETH", "DOGE", "SOL", "LTC", "BCH"] and not symbol.endswith("-USD"):
            yf_symbol = f"{symbol}-USD"
        
        ticker = yf.Ticker(yf_symbol)
        
        # Use safer approach for fetching info
        try:
            info = ticker.info
            price = info.get("currentPrice", "N/A")
        except Exception as e:
            print(f"Error fetching info for {symbol}: {e}")
            price = "N/A"
            info = {}
        
        # Get historical data based on timeframe
        period_map = {"1D": "1d", "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y"}
        period = period_map.get(timeframe, "1mo")
        
        hist = ticker.history(period=period, interval="1d" if timeframe != "1D" else "1h")
        
        # Prepare chart data
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append({
                "date": str(index)[:10],  # Convert to string and take first 10 chars (YYYY-MM-DD)
                "price": float(row['Close']),
                "volume": int(row['Volume']) if 'Volume' in row else 0
            })
        
        # Prepare stock data with safer field access
        stock_data = {
            "symbol": symbol,
            "longName": info.get("longName"),
            "price": float(info.get("regularMarketPrice", 0) or 0),
            "change": float(info.get("regularMarketChange", 0) or 0),
            "changePercent": float(info.get("regularMarketChangePercent", 0) or 0),
            "volume": int(info.get("volume", 0) or 0),
            "marketCap": int(info.get("marketCap", 0) or 0),
            "pe": float(info.get("trailingPE", 0) or 0),
            "dividend": float(info.get("dividendRate", 0) or 0),
            "dividendYield": float(info.get("dividendYield", 0) or 0),
            "high": float(info.get("dayHigh", 0) or 0),
            "low": float(info.get("dayLow", 0) or 0),
            "open": float(info.get("regularMarketOpen", 0) or 0),
            "previousClose": float(info.get("regularMarketPreviousClose", 0) or 0),
            # Additional key stats
            "aum": info.get("totalAssets"),
            "thirtyDayYield": info.get("yield"),
            "averageVolume": info.get("averageVolume"),
            "highToday": info.get("dayHigh"),
            "lowToday": info.get("dayLow"),
            "openPrice": info.get("open"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow")
        }
        
        # Get full stock summary
        stock_summary = get_full_stock_summary(yf_symbol)
        # Replace news with Finnhub news
        stock_summary["news"] = get_finnhub_news(symbol)
        
        return {
            "success": True,
            "stockData": stock_data,
            "chartData": chart_data,
            "stockSummary": stock_summary
        }
        
    except Exception as e:
        print(f"Error fetching stock detail for {symbol}: {e}")
        return {"error": f"Failed to fetch stock data for {symbol}"} 