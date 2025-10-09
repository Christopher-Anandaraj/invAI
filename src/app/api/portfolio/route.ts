import { NextResponse } from 'next/server';

export async function GET() {
  // Use local backend for development, remote for production
  const BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? process.env.BACKEND_URL || 'https://backend.chrisbuilds.dev'
    : 'http://localhost:8000';
  console.log('Using BACKEND_URL:', BACKEND_URL); // Debug log
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