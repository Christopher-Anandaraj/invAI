import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
  const backendUrl = symbol
    ? `${BACKEND_URL}/asset-insights?symbol=${encodeURIComponent(symbol)}`
    : `${BACKEND_URL}/asset-insights`;
  try {
    const res = await fetch(backendUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch asset insights from backend' }, { status: 500 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Backend not reachable' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set in environment variables' }, { status: 500 });
    }

    const response = await fetch(
      GEMINI_API_URL + `?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to get sentiment analysis' }, { status: 500 });
    }
    
    const data = await response.json();
    const insight = data.candidates?.[0]?.content?.parts?.[0]?.text || "No sentiment analysis available.";
    
    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process sentiment analysis' }, { status: 500 });
  }
} 