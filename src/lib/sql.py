import pymysql
import os
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Load DB credentials from .env
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "invai")


# Connect once at startup
def get_db_connection():
    try:
        return pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True
        )
    except pymysql.err.OperationalError as e:
        print(f"Database connection error: {e}")
        print("Please ensure MySQL is running and .env file has correct database credentials")
        raise

def upsert_portfolio_data(symbol, name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market):
    """
    Insert or update portfolio data in the MySQL database.
    Fields: id, symbol, name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market, last_updated
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO portfolio (symbol, name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market, last_updated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        name=%s,
                        shares=%s, 
                        avg_price=%s, 
                        current_price=%s,
                        equity=%s, 
                        equity_change=%s,
                        percent_change=%s, 
                        intraday_percent_change=%s,
                        pe_ratio=%s,
                        portfolio_percentage=%s,
                        asset_type=%s, 
                        market=%s, 
                        last_updated=%s
                """, (
                    symbol, name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market, datetime.now(),
                    name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market, datetime.now()
                ))
        finally:
            conn.close()
    except Exception as e:
        print(f"Failed to save portfolio data for {symbol}: {e}")
        print("Continuing without database storage...")

def get_portfolio_data():
    """
    Retrieve all portfolio data from the MySQL database.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM portfolio ORDER BY symbol")
                return cur.fetchall()
        finally:
            conn.close()
    except Exception as e:
        print(f"Failed to retrieve portfolio data: {e}")
        return []

def get_portfolio_by_symbol(symbol):
    """
    Retrieve portfolio data for a specific symbol.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM portfolio WHERE symbol = %s", (symbol,))
                return cur.fetchone()
        finally:
            conn.close()
    except Exception as e:
        print(f"Failed to retrieve portfolio data for {symbol}: {e}")
        return None

def delete_portfolio_entry(symbol):
    """
    Delete a portfolio entry by symbol.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM portfolio WHERE symbol = %s", (symbol,))
        finally:
            conn.close()
    except Exception as e:
        print(f"Failed to delete portfolio entry for {symbol}: {e}")

def clear_portfolio():
    """
    Clear all portfolio data.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM portfolio")
        finally:
            conn.close()
    except Exception as e:
        print(f"Failed to clear portfolio: {e}")
