import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getEpcisEvents } from '@/lib/epcisStore';

type RouteData = {
  count: number;
  source_info: { id: string; name: string; coords: [number, number] };
  target_info: { id: string; name: string; coords: [number, number] };
  epc_list: string[];
};

type Coord = { lat: number; lon: number };

let cachedLocations: Record<string, Coord> | null = null;
let cachedLocMtime: number | null = null;

async function loadLocations() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'location_list2.csv');
  const stat = await fs.stat(filePath);
  if (cachedLocations && cachedLocMtime === stat.mtimeMs) return cachedLocations;

  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.trim().split(/\r?\n/);
  const map: Record<string, Coord> = {};
  for (let i = 1; i < lines.length; i++) {
    const [locationId, scanLocation, lat, lon] = lines[i].split(',');
    const name = (scanLocation || '').trim();
    const id = (locationId || '').trim();
    const latNum = Number.parseFloat(lat);
    const lonNum = Number.parseFloat(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) continue;
    if (name) map[name] = { lat: latNum, lon: lonNum };
    if (id) map[id] = { lat: latNum, lon: lonNum };
  }

  cachedLocations = map;
  cachedLocMtime = stat.mtimeMs;
  return map;
}

export async function GET() {
  try {
    const events = getEpcisEvents();
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json([]);
    }

    const locations = await loadLocations();

    const byEpc = new Map<string, any[]>();
    events.forEach((event) => {
      const code = String(event?.epcCode ?? event?.epc_code ?? '').trim();
      if (!code) return;
      if (!byEpc.has(code)) byEpc.set(code, []);
      byEpc.get(code)!.push(event);
    });

    const segmentMap = new Map<string, { data: RouteData; epcSet: Set<string> }>();

    for (const [epc, list] of byEpc.entries()) {
      const withIndex = list.map((item, index) => ({ item, index }));
      withIndex.sort((a, b) => {
        const ta = new Date(a.item?.eventTime ?? a.item?.event_time ?? 0).getTime();
        const tb = new Date(b.item?.eventTime ?? b.item?.event_time ?? 0).getTime();
        if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
        return a.index - b.index;
      });

      for (let i = 0; i < withIndex.length - 1; i++) {
        const from = withIndex[i].item;
        const to = withIndex[i + 1].item;

        const fromName = String(from?.scanLocation ?? from?.scan_location ?? '').trim();
        const fromId = String(from?.locationId ?? from?.location_id ?? '').trim();
        const toName = String(to?.scanLocation ?? to?.scan_location ?? '').trim();
        const toId = String(to?.locationId ?? to?.location_id ?? '').trim();

        const fromCoord = locations[fromName] || locations[fromId];
        const toCoord = locations[toName] || locations[toId];
        if (!fromCoord || !toCoord) continue;
        if (fromCoord.lat === toCoord.lat && fromCoord.lon === toCoord.lon) continue;

        const key = `${fromCoord.lon},${fromCoord.lat}|${toCoord.lon},${toCoord.lat}`;
        if (!segmentMap.has(key)) {
          segmentMap.set(key, {
            data: {
              count: 0,
              source_info: {
                id: fromId || fromName,
                name: fromName || fromId,
                coords: [fromCoord.lon, fromCoord.lat],
              },
              target_info: {
                id: toId || toName,
                name: toName || toId,
                coords: [toCoord.lon, toCoord.lat],
              },
              epc_list: [],
            },
            epcSet: new Set<string>(),
          });
        }

        const entry = segmentMap.get(key)!;
        entry.data.count += 1;
        entry.epcSet.add(epc);
      }
    }

    const routes: RouteData[] = [];
    for (const entry of segmentMap.values()) {
      entry.data.epc_list = Array.from(entry.epcSet);
      routes.push(entry.data);
    }

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Failed to build routes from EPCIS events:', error);
    return NextResponse.json({ error: 'Failed to build routes' }, { status: 500 });
  }
}
