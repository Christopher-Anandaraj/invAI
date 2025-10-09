# Database Setup Instructions

## MySQL Setup

### 1. Install MySQL
- Download MySQL from https://dev.mysql.com/downloads/mysql/
- Install MySQL Server
- During installation, set a root password (remember this!)

### 2. Start MySQL Service
- **Windows**: Open Services (services.msc) and start "MySQL" service
- **Alternative**: Open Command Prompt as Administrator and run:
  ```
  net start mysql
  ```

### 3. Create Database and Table
Run the SQL commands from `mysql_schema.sql`:

```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE IF NOT EXISTS invai;
USE invai;

-- Create portfolio table
CREATE TABLE IF NOT EXISTS portfolio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    avg_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    equity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    current_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    percent_change DECIMAL(10, 4) NOT NULL DEFAULT 0,
    asset_type ENUM('stock', 'crypto', 'etf', 'bond', 'other') NOT NULL DEFAULT 'stock',
    market VARCHAR(50) NOT NULL DEFAULT 'NASDAQ',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_symbol (symbol),
    INDEX idx_asset_type (asset_type),
    INDEX idx_market (market),
    INDEX idx_last_updated (last_updated)
);
```

### 4. Create .env File
Create a `.env` file in your project root with:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_root_password
DB_NAME=invai

# Robinhood API Credentials
ROBINHOOD_USERNAME=your_robinhood_username
ROBINHOOD_PASSWORD=your_robinhood_password

# API Keys
GEMINI_API_KEY=your_gemini_api_key
FINNHUB_API_KEY=your_finnhub_api_key

# Backend URL (for frontend)
BACKEND_URL=http://localhost:8000
```

### 5. Test Connection
```bash
# Install Python dependencies
pip install -r requirements.txt

# Test the connection
python -c "from src.lib.sql import get_db_connection; print('Database connected successfully!')"
```

## Troubleshooting

### Error: "Can't connect to MySQL server"
1. Ensure MySQL service is running
2. Check if MySQL is listening on port 3306: `netstat -an | findstr 3306`
3. Verify credentials in `.env` file
4. Try connecting manually: `mysql -u root -p`

### Error: "Access denied for user"
1. Check username and password in `.env`
2. Ensure MySQL user has proper permissions
3. Try resetting MySQL root password if needed

### Error: "Unknown database"
1. Run the CREATE DATABASE command from step 3
2. Verify DB_NAME in `.env` matches the created database

## Alternative: Skip Database (Development)
The application will continue to work without MySQL - it will just print warnings and skip database storage. The portfolio data will still be fetched from Robinhood and returned to the frontend.
