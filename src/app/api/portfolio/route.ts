import { NextResponse } from 'next/server';

export async function GET() {
  // Fetch from Python backend (assume FastAPI/Flask running at localhost:8000)
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${BACKEND_URL}/portfolio`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch portfolio from backend' }, { status: 500 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Backend not reachable' }, { status: 500 });
  }
} 