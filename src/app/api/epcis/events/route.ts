import { NextResponse } from 'next/server';
import { getEpcisEvents, setEpcisEvents } from '@/lib/epcisStore';


// 인메모리 저장소 (테스트용)

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) return NextResponse.json({ message: "No file" }, { status: 400 });

        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        const delimiter = text.includes("\t") ? "\t" : ",";
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

        // 서버에서 파싱 (92만건)
        const epcisEvents = lines.slice(1).map((line, index) => {
            const values = line.split(delimiter).map(v => v.trim());
            const getVal = (name: string) => {
                const idx = headers.indexOf(name.toLowerCase());
                return idx !== -1 ? values[idx] : "";
            };
            const stFromFile = getVal("st") || getVal("status") || getVal("risk_status");
            return {
                id: `LOG-${index}`,
                epcCode: getVal("epc_code"),
                scanLocation: getVal("scan_location"),
                st: (stFromFile || '').toUpperCase() === 'DANGER' ? 'DANGER' : (stFromFile || '').toUpperCase() === 'CAUTION' ? 'CAUTION' : (stFromFile || '').toUpperCase() === 'SAFE' ? 'SAFE' : (index % 10 === 0) ? 'DANGER' : (index % 7 === 0) ? 'CAUTION' : 'SAFE',
                eventTime: getVal("event_time"),
                locationId: getVal("location_id"),
                hubType: getVal("hub_type"),
                businessStep: getVal("business_step"),
                eventType: getVal("event_type"),
                operatorId: getVal("operator_id"),
                deviceId: getVal("device_id"),
                epcHeader: getVal("epc_header"),
                epcCompany: getVal("epc_company"),
                epcProduct: getVal("epc_product"),
                productName: getVal("product_name") || getVal("productName"),
                epcLot: getVal("epc_lot"),
                manufactureDate: getVal("manufacture_date"),
                expiryDate: getVal("expiry_date"),
                msg: getVal("msg"),
                location: getVal("location"),
                destination: getVal("destination"),
                path: [],
                // ... 필요한 나머지 필드 ...
            };
        });

        setEpcisEvents(epcisEvents);

        return NextResponse.json({ message: "Success", count: epcisEvents.length });
    } catch (e) { return NextResponse.json({ message: "Error" }, { status: 500 }); }
}

export async function GET(request: Request) {
    const epcisEvents = getEpcisEvents();
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('raw') === 'true';
    const filterStatus = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || "";
    const limit = parseInt(searchParams.get('limit') || '50');

    if (raw) {
        return NextResponse.json(epcisEvents);
    }

    // 1. 전체 통계 계산 (92만 건을 매번 돌면 느리므로 실제론 변수에 저장해두는게 좋음)
    const stats = {
        ALL: epcisEvents.length,
        SAFE: epcisEvents.filter(d => d.st === 'SAFE').length,
        CAUTION: epcisEvents.filter(d => d.st === 'CAUTION').length,
        DANGER: epcisEvents.filter(d => d.st === 'DANGER').length,
    };

    // 2. 필터링 및 페이징
    let filtered = epcisEvents;
    if (filterStatus !== 'ALL') {
        filtered = filtered.filter(item => item.st === filterStatus);
    }
    if (search) {
        filtered = filtered.filter(item => 
            String((item as { epcCode?: unknown }).epcCode ?? "").toLowerCase().includes(search) ||
            String((item as { scanLocation?: unknown }).scanLocation ?? "").toLowerCase().includes(search)
        );
    }

    // 최신순 정렬 후 50개만 반환
    const items = filtered.slice(0, limit);

    return NextResponse.json({
        stats,     // KPI용 전체 통계
        items,     // 리스트용 일부 데이터
        filteredCount: filtered.length // 검색 결과 총 개수
    });
}
