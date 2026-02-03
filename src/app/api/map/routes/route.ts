import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

let cachedData: unknown | null = null;
let cachedMtime: number | null = null;

async function loadRoutes() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'rich_routes.json');
  const stat = await fs.stat(filePath);

  if (cachedData && cachedMtime === stat.mtimeMs) {
    return cachedData;
  }

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  cachedData = parsed;
  cachedMtime = stat.mtimeMs;
  return parsed;
}

export async function GET() {
  try {
    const data = await loadRoutes();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid routes data' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to read rich_routes.json:', error);
    return NextResponse.json({ error: 'Failed to load routes' }, { status: 500 });
  }
}
