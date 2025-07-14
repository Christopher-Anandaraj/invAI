from fastapi import APIRouter, Query
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

router = APIRouter()

def get_sparkline_data(symbol):
    try:
        hist = yf.Ticker(symbol).history(period="7d", interval="1d")['Close']
        return {symbol: hist.dropna().tolist()}
    except Exception:
        return {symbol: []}

@router.get("/sparklines")
def get_sparklines(symbols: Optional[str] = Query(None, description="Comma-separated list of symbols")):
    if not symbols:
        return {}
    symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
    results = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        for result in executor.map(get_sparkline_data, symbol_list):
            results.update(result)
    return results 