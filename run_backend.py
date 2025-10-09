#!/usr/bin/env python3
"""
Run the FastAPI backend locally
"""
import uvicorn
from src.lib.portfolio_api import app

if __name__ == "__main__":
    print("Starting FastAPI backend on http://localhost:8000")
    print("API Documentation: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
