-- MySQL schema for invAI portfolio database
-- Create database
CREATE DATABASE IF NOT EXISTS invai;
USE invai;

-- Create portfolio table with the specified fields
CREATE TABLE IF NOT EXISTS portfolio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255),
    shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    avg_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    current_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    equity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    equity_change DECIMAL(20, 8) NOT NULL DEFAULT 0,
    percent_change DECIMAL(10, 4) NOT NULL DEFAULT 0,
    intraday_percent_change DECIMAL(10, 4) NOT NULL DEFAULT 0,
    pe_ratio DECIMAL(10, 4),
    portfolio_percentage DECIMAL(10, 4),
    asset_type ENUM('stock', 'crypto', 'etf', 'bond', 'etp', 'other') NOT NULL DEFAULT 'stock',
    market VARCHAR(50) NOT NULL DEFAULT 'NASDAQ',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_symbol (symbol),
    INDEX idx_asset_type (asset_type),
    INDEX idx_market (market),
    INDEX idx_last_updated (last_updated)
);

-- Example insert (this will be handled by the Python code)
-- INSERT INTO portfolio (symbol, name, shares, avg_price, current_price, equity, equity_change, percent_change, intraday_percent_change, pe_ratio, portfolio_percentage, asset_type, market) 
-- VALUES ('AAPL', 'Apple Inc.', 10.0, 150.00, 155.00, 1550.00, 50.00, 3.33, 0.00, 25.5, 15.2, 'stock', 'NASDAQ');

-- View to see portfolio summary
CREATE VIEW portfolio_summary AS
SELECT 
    symbol,
    name,
    shares,
    avg_price,
    current_price,
    equity,
    equity_change,
    percent_change,
    intraday_percent_change,
    pe_ratio,
    portfolio_percentage,
    asset_type,
    market,
    last_updated,
    (equity * percent_change / 100) as gain_loss
FROM portfolio
ORDER BY equity DESC;
