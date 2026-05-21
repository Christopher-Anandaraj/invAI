# invAI — AI-Powered Investment Dashboard

> A personal portfolio dashboard that connects to Robinhood, enriches holdings with real-time market data, and surfaces AI-generated insights powered by Google Gemini.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Live Portfolio** | Pulls stocks & crypto directly from your Robinhood account |
| 📈 **Sparklines** | 7-day price trend charts for every holding |
| 🤖 **AI Insights** | Per-asset Gemini analysis with trend summaries and forecasts |
| 📰 **News Feed** | Latest headlines per ticker via Finnhub |
| 🥧 **Sector Allocation** | Breakdown of portfolio weight by sector |
| 🔒 **Server-side API calls** | All secrets stay server-side — nothing is exposed to the browser |
| ⚡ **Smart Caching** | Portfolio data is cached in MySQL, keeping the UI snappy |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│  (React 19 · Tailwind CSS · Recharts · Lucide)       │
│                                                      │
│  /dashboard  ──►  API Routes (/api/*)                │
└───────────────────────┬──────────────────────────────┘
                        │ HTTP
┌───────────────────────▼──────────────────────────────┐
│              FastAPI Backend (Python)                │
│                                                      │
│  Robinhood (robin-stocks)  ──►  MySQL (portfolio)    │
│  Yahoo Finance (yfinance)  ──►  Gemini API           │
│  Finnhub API               ──►  /sparklines          │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- MySQL 8+

### 1 — Clone & install

```bash
git clone https://github.com/Christopher-Anandaraj/invAI.git
cd invAI

# Frontend
npm install

# Backend
pip install -r requirements.txt
```

### 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# Robinhood
ROBINHOOD_USERNAME=your_email@example.com
ROBINHOOD_PASSWORD=your_password

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Finnhub
FINNHUB_API_KEY=your_finnhub_api_key

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=invai

# Next.js (production only)
BACKEND_URL=https://your-backend-domain.com
```

> ⚠️ **Never commit `.env` to source control.** It is already in `.gitignore`.

### 3 — Set up the database

```bash
mysql -u root -p < mysql_schema.sql
```

See [setup_database.md](./setup_database.md) for detailed instructions.

### 4 — Run in development

```bash
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — FastAPI backend
python run_backend.py
```

- Frontend → [http://localhost:3000](http://localhost:3000)
- Backend API → [http://localhost:8000](http://localhost:8000)

---

## 📁 Project Structure

```
invAI/
├── src/
│   ├── app/
│   │   ├── api/                  # Next.js server-side API routes
│   │   │   ├── portfolio/        # Portfolio data proxy
│   │   │   ├── asset-insights/   # Gemini AI insights
│   │   │   └── login/            # Robinhood auth (+ 2FA)
│   │   ├── dashboard/            # Main dashboard page
│   │   └── page.tsx              # Landing / bot-check page
│   ├── components/
│   │   ├── PortfolioDashboard.tsx  # Main dashboard component
│   │   └── StockDetailPage.tsx     # Individual asset view
│   └── lib/
│       ├── portfolio_api.py        # FastAPI app (core backend)
│       ├── robinhood_auth.py       # Login & 2FA flow
│       ├── robinhood_portfolio.py  # Portfolio helpers
│       └── sql.py                  # MySQL CRUD helpers
├── backend/
│   └── routes/sparklines.py
├── .env.example                  # Template — copy to .env
├── mysql_schema.sql              # Database schema
├── run_backend.py                # Backend entry point
└── requirements.txt
```

---

## 🔑 API Keys Required

| Service | Purpose | Get one |
|---|---|---|
| **Google Gemini** | AI trend insights | [aistudio.google.com](https://aistudio.google.com) |
| **Finnhub** | Stock news feed | [finnhub.io](https://finnhub.io) |
| **Robinhood** | Portfolio data (your own account) | — |

---

## 🛡️ Security

All sensitive credentials are loaded exclusively from environment variables.  
No keys are bundled into client-side JavaScript.  
See [SECURITY.md](./SECURITY.md) for the full policy.

---

## 🧰 Tech Stack

**Frontend**
- [Next.js 15](https://nextjs.org) (App Router + Turbopack)
- [React 19](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Recharts](https://recharts.org) · [Lucide React](https://lucide.dev)

**Backend**
- [FastAPI](https://fastapi.tiangolo.com)
- [robin-stocks](https://robin-stocks.readthedocs.io)
- [yfinance](https://pypi.org/project/yfinance)
- [PyMySQL](https://pymysql.readthedocs.io)

**AI / Data**
- [Google Gemini 2.5 Flash](https://ai.google.dev)
- [Finnhub](https://finnhub.io)
- [Yahoo Finance](https://finance.yahoo.com)
