import robin_stocks.robinhood as r
import os
from dotenv import load_dotenv
import yfinance as yf
# Load environment variables from .env file
load_dotenv()

# Get credentials from environment variables
username = os.getenv("ROBINHOOD_USERNAME")
password = os.getenv("ROBINHOOD_PASSWORD")
if not username or not password:
    raise ValueError("Please set ROBINHOOD_USERNAME and ROBINHOOD_PASSWORD in your .env file.")
# Do not print or log sensitive values
# Login to Robinhood
r.login(
    username=username,
    password=password,
    store_session=True
)

# Fetch holdings
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

# Process crypto holdings like stocks
crypto_positions = r.crypto.get_crypto_positions()
print(crypto_positions)
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

# Print or return the combined portfolio
if portfolio:
    print(portfolio)
else:
    print("No holdings found.") 