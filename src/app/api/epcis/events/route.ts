import { NextResponse } from 'next/server';

let epcisEvents: any[] = [];

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
        epcisEvents = lines.slice(1).map((line, index) => {
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

        return NextResponse.json({ message: "Success", count: epcisEvents.length });
    } catch (e) { return NextResponse.json({ message: "Error" }, { status: 500 }); }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('raw') || '';
    if (raw.toLowerCase() === 'true') {
        return NextResponse.json(epcisEvents);
    }

    const filterStatus = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.toLowerCase() || "";
    const limit = parseInt(searchParams.get('limit') || '50');

    // 1. 전체 통계 계산 (대용량은 캐시/집계 권장)
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
            item.epcCode.toLowerCase().includes(search) || 
            item.scanLocation.toLowerCase().includes(search)
        );
    }

    // 반환 개수 limit 적용
    const items = filtered.slice(0, limit);

    return NextResponse.json({
        stats,     // KPI 전체 통계
        items,     // 리스트용 이벤트 데이터
        filteredCount: filtered.length // 검색 결과 총 개수
    });
}
