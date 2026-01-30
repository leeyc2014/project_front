import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface EPCISEvent {
  epcCode: string;
  eventTime: string | Date;
  scanLocation: string;
  latitude?: string | number;
  longitude?: string | number;
  st?: string; // DANGER, CAUTION 등
  [key: string]: any; // 기타 추가 필드 허용
}

interface PathPoint {
  lat: number;
  lng: number;
  isAnomaly: boolean;
  desc: string;
}

// 데이터베이스 대신 인메모리 저장소를 사용합니다.
// 실제 프로덕션 환경에서는 데이터베이스(예: PostgreSQL, MongoDB)를 사용해야 합니다.
let epcisEvents: any[] = [];
let locationCache: Map<string, { lat: number; lng: number }> | null = null;

const loadLocationMap = async () => {
  if (locationCache) return locationCache;

  try {
    const csvPath = path.join(process.cwd(), 'location_list.csv');
    const raw = await fs.readFile(csvPath, 'utf-8');
    const lines = raw.trim().split(/\r?\n/);
    const map = new Map<string, { lat: number; lng: number }>();

    for (let i = 1; i < lines.length; i += 1) {
      const [scanLocation, lat, lon] = lines[i].split(',');
      if (!scanLocation || !lat || !lon) continue;
      const latNum = Number.parseFloat(lat);
      const lngNum = Number.parseFloat(lon);
      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) continue;
      map.set(scanLocation.trim(), { lat: latNum, lng: lngNum });
    }

    locationCache = map;
    return map;
  } catch (error) {
    console.error('[API] Failed to load location_list.csv:', error);
    locationCache = new Map();
    return locationCache;
  }
};

/**
 * EPCIS 이벤트 목록을 가져오는 GET 핸들러
 * 대시보드 페이지에서 호출되며, epcCode를 기준으로 데이터를 그룹화하여 반환합니다.
 */
export async function GET() {
  try {
    if (epcisEvents.length === 0) {
      return NextResponse.json([]);
    }

    const locationMap = await loadLocationMap();

    // 1. epcCode를 기준으로 이벤트를 그룹화합니다.
    // Record의 밸류 타입을 EPCISEvent[]로 지정합니다.
    const groupedByEpc = (epcisEvents as EPCISEvent[]).reduce((acc, event) => {
      const key = event.epcCode;
      if (key) {
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(event);
      }
      return acc;
    }, {} as Record<string, EPCISEvent[]>);

    // 2. 변환 로직
    const processedData = Object.values(groupedByEpc).map((group: EPCISEvent[]) => {
      // 3. 정렬 (a, b의 타입을 EPCISEvent로 명시)
      const sortedGroup = group.sort((a: EPCISEvent, b: EPCISEvent) => 
        new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()
      );
      
      const latestEvent = sortedGroup[sortedGroup.length - 1];

      // 5. 경로 생성
      const path = sortedGroup
        .map((event: EPCISEvent) => {
          const mapped = locationMap.get(event.scanLocation);
          
          // lat, lng 추출 로직
          const lat = mapped?.lat ?? (event.latitude ? Number.parseFloat(String(event.latitude)) : null);
          const lng = mapped?.lng ?? (event.longitude ? Number.parseFloat(String(event.longitude)) : null);
          
          if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
          
          return {
            lat,
            lng,
            isAnomaly: event.st === 'DANGER' || event.st === 'CAUTION',
            desc: `${event.scanLocation} (${new Date(event.eventTime).toLocaleString()})`
          };
        })
        // filter에서의 point 타입을 명확히 지정
        .filter((point): point is PathPoint => point !== null);

      return {
        ...latestEvent,
        id: latestEvent.epcCode,
        path: path,
      };
    });

    return NextResponse.json(processedData);
  } catch (error) {
    console.error("GET /api/epcis/events Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * 업로드된 CSV 데이터를 받아 저장하는 POST 핸들러
 * 업로드 페이지에서 호출됩니다.
 */
export async function POST(request: Request) {
  try {
    const newData = await request.json();
    
    if (!Array.isArray(newData)) {
      return NextResponse.json({ message: "Invalid data format. Expected an array." }, { status: 400 });
    }

    // 새로운 데이터로 기존 데이터를 교체합니다. 
    // 실제 앱에서는 데이터를 추가하거나 업데이트하는 로직이 필요할 수 있습니다.
    epcisEvents = newData;
    
    console.log(`[API] Received ${newData.length} new events. Total events: ${epcisEvents.length}`);
    
    return NextResponse.json({ message: "Data uploaded successfully" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/epcis/events Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
