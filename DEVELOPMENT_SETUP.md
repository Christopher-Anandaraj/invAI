# Development Setup Guide

## Problem Identified
The error `{"error":"Missing credentials in .env"}` was occurring because:
1. Your frontend was trying to connect to `https://backend.chrisbuilds.dev`
2. That remote backend doesn't have your `.env` file with credentials
3. The FastAPI backend needs to run locally with your `.env` file

## Solution: Run Backend Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Backend Server
```bash
python run_backend.py
```

This will start the FastAPI server on `http://localhost:8000`

### 3. Start the Frontend (in another terminal)
```bash
npm run dev
```

This will start the Next.js frontend on `http://localhost:3000`

### 4. Test the Connection
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Environment Variables
Your `.env` file is correctly configured:
- ✅ ROBINHOOD_USERNAME: js01.christopher@gmail.com
- ✅ ROBINHOOD_PASSWORD: [correctly set]
- ✅ Database credentials: [correctly set]
- ✅ API keys: [correctly set]

## Troubleshooting

### If you still get "Missing credentials" error:
1. Make sure you're running `python run_backend.py` from the project root
2. Check that `.env` file is in the same directory as `run_backend.py`
3. Verify the backend is running on port 8000: `http://localhost:8000/docs`

### If database connection fails:
- The app will continue working without MySQL
- Database errors will be logged but won't crash the app
- Portfolio data will still be fetched from Robinhood

### If Robinhood login fails:
- Check your credentials in `.env`
- Verify your Robinhood account is active
- Check if 2FA is enabled (may need additional setup)

## Production Deployment
For production, deploy the FastAPI backend to `https://backend.chrisbuilds.dev` and ensure:
1. The remote server has the same `.env` file
2. MySQL database is accessible from the remote server
3. All dependencies are installed on the remote server
