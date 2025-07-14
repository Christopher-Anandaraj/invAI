import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
  const backendRes = await fetch(`${BACKEND_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
} 