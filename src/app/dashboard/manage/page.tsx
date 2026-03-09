"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import type { EpcListResponse, EpcPageInfo, EpcRow, InitDataResponse, SelectOption, LotRelation } from "@/types/manage";
import { getAuthToken } from "@/utils/authToken";
import { getBackendUrl } from "@/utils/apiUtil";

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text.length > 0 ? text : "-";
}

function normalizeList(payload: EpcListResponse | null): EpcRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.list)) return payload.list;
  return [];
}

function getEpcCode(row: EpcRow): unknown {
  return row.epc_code ?? row.epcCode;
}

function getEpcManufacture(row: EpcRow): unknown {
  return row.epc_manufacture ?? row.epcManufacture ?? row.manufactureDate;
}

function getEpcCompany(row: EpcRow): unknown {
  return row.company?.companyName ?? row.epc_company ?? row.company?.epcCompany;
}

function getEpcLot(row: EpcRow): unknown {
  return row.lot?.lotName ?? row.epc_lot ?? row.lot?.epcLot;
}

function getEpcProduct(row: EpcRow): unknown {
  return row.product?.productName ?? row.epc_product ?? row.product?.epcProduct;
}

function getEpcSerial(row: EpcRow): unknown {
  return row.epc_serial ?? row.epcSerial;
}

function getExpiryDate(row: EpcRow): unknown {
  return row.expiry_date ?? row.expiryDate;
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.content)) return obj.content as any[];
    if (Array.isArray(obj.data)) return obj.data as any[];
    if (Array.isArray(obj.items)) return obj.items as any[];
    if (Array.isArray(obj.list)) return obj.list as any[];
  }
  return [];
}

function toCompactDate(value: string): string {
  return (value || "").replaceAll("-", "");
}

function formatDateValue(value: unknown): string {
  const text = toDisplay(value);
  if (text === "-") return text;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return text;
}

function formatSerialValue(value: unknown): string {
  const text = toDisplay(value);
  if (text === "-") return text;
  const digits = text.replace(/\D/g, "");
  if (!digits) return text;
  return Number(digits).toLocaleString();
}

function formatNameWithCode(name: unknown, code: unknown): string {
  const nameText = toDisplay(name);
  const codeText = toDisplay(code);
  if (nameText !== "-" && codeText !== "-" && nameText !== codeText) {
    return `${nameText} (${codeText})`;
  }
  return nameText !== "-" ? nameText : codeText;
}

export default function ManagePage() {
  const [rows, setRows] = useState<EpcRow[]>([]);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<EpcPageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<EpcRow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [initLoaded, setInitLoaded] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [allProductOptions, setAllProductOptions] = useState<SelectOption[]>([]);
  const [lotRelations, setLotRelations] = useState<LotRelation[]>([]);
  const [createForm, setCreateForm] = useState({
    epcCompany: "",
    epcProduct: "",
    epcSerial: "",
    epcLot: "",
    epcManufacture: "",
    expiryDate: "",
  });

  const fetchEpcList = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);

    try {
      const base = getBackendUrl() || "";
      const res = await fetch(`${base}/api/v1/epc?page=${pageNum}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (!res.ok) {
        throw new Error(`EPC 목록 조회 실패: HTTP ${res.status}`);
      }

      const data: EpcListResponse = await res.json();
      const list = normalizeList(data);
      setRows(list);

      if (Array.isArray(data)) {
        setPageInfo({
          totalPages: 1,
          totalElements: list.length,
          size: list.length,
          number: 0,
          first: true,
          last: true,
          numberOfElements: list.length,
          empty: list.length === 0,
        });
      } else {
        setPageInfo({
          totalPages: Number(data.totalPages ?? 1),
          totalElements: Number(data.totalElements ?? list.length),
          size: Number(data.size ?? list.length),
          number: Number(data.number ?? pageNum),
          first: Boolean(data.first ?? pageNum === 0),
          last: Boolean(data.last ?? true),
          numberOfElements: Number(data.numberOfElements ?? list.length),
          empty: Boolean(data.empty ?? list.length === 0),
        });
      }
    } catch (e: any) {
      setRows([]);
      setPageInfo(null);
      setError(e?.message || "EPC 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEpcList(page);
  }, [fetchEpcList, page]);

  const productOptions = useMemo<SelectOption[]>(() => {
    if (!createForm.epcCompany) return [];

    const allowedProductSet = new Set(
      lotRelations
        .filter((relation) => relation.epcCompany === createForm.epcCompany)
        .map((relation) => relation.epcProduct)
    );

    return allProductOptions.filter((option) => allowedProductSet.has(option.value));
  }, [allProductOptions, createForm.epcCompany, lotRelations]);

  const lotOptions = useMemo<SelectOption[]>(() => {
    if (!createForm.epcCompany || !createForm.epcProduct) return [];

    const seen = new Set<string>();
    const options: SelectOption[] = [];

    lotRelations.forEach((relation) => {
      if (relation.epcCompany !== createForm.epcCompany) return;
      if (relation.epcProduct !== createForm.epcProduct) return;
      if (seen.has(relation.epcLot)) return;
      seen.add(relation.epcLot);

      options.push({
        value: relation.epcLot,
        label: relation.lotName ? `${relation.epcLot} (${relation.lotName})` : relation.epcLot,
      });
    });

    return options;
  }, [createForm.epcCompany, createForm.epcProduct, lotRelations]);

  const fetchInitData = useCallback(async () => {
    setIsInitLoading(true);
    setCreateError(null);
    try {
      const base = getBackendUrl() || "";
      const res = await fetch(`${base}/api/v1/dashboard/init-data`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (!res.ok) {
        throw new Error(`초기 데이터 조회 실패: HTTP ${res.status}`);
      }

      const data = (await res.json()) as InitDataResponse;
      const filters = (data?.filters ?? data) as Record<string, unknown>;

      const toOptions = (list: any[], idKeys: string[], nameKeys: string[]): SelectOption[] => {
        return list
          .map((item) => {
            const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            const idRaw = idKeys.map((key) => source[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
            const nameRaw = nameKeys.map((key) => source[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
            const fallback = item !== null && item !== undefined ? String(item).trim() : "";
            const id = idRaw !== undefined && idRaw !== null ? String(idRaw).trim() : fallback;
            if (!id) return null;
            const name = nameRaw !== undefined && nameRaw !== null ? String(nameRaw).trim() : "";
            return {
              value: id,
              label: name && name !== id ? `${id} (${name})` : id,
            } as SelectOption;
          })
          .filter((option): option is SelectOption => Boolean(option));
      };

      const companyList = asArray(
        filters.companyList ?? filters.companies ?? filters.epcCompanies ?? filters.epcCompanyList
      );
      const productList = asArray(
        filters.productList ?? filters.products ?? filters.epcProducts ?? filters.epcProductList
      );
      const lotList = asArray(
        filters.lotList ?? filters.lots ?? filters.epcLots ?? filters.epcLotList
      );
      const companies = toOptions(companyList, ["id", "key", "value", "epcCompany"], ["label", "name", "companyName"]);
      const products = toOptions(productList, ["id", "key", "value", "epcProduct"], ["label", "name", "productName"]);
      const relations = lotList
        .map((item) => {
          const source = item && typeof item === "object" ? (item as Record<string, any>) : null;
          if (!source) return null;

          const epcLot = source.epcLot != null ? String(source.epcLot).trim() : "";
          const epcProduct = source.product?.epcProduct != null ? String(source.product.epcProduct).trim() : "";
          const epcCompany = source.product?.company?.epcCompany != null ? String(source.product.company.epcCompany).trim() : "";
          const lotName = source.lotName != null ? String(source.lotName).trim() : "";

          if (!epcLot || !epcProduct || !epcCompany) return null;
          return { epcCompany, epcProduct, epcLot, lotName } as LotRelation;
        })
        .filter((relation): relation is LotRelation => Boolean(relation));

      const relationKeySet = new Set<string>();
      const uniqueRelations = relations.filter((relation) => {
        const key = `${relation.epcCompany}|${relation.epcProduct}|${relation.epcLot}`;
        if (relationKeySet.has(key)) return false;
        relationKeySet.add(key);
        return true;
      });

      setCompanyOptions(companies);
      setAllProductOptions(products);
      setLotRelations(uniqueRelations);
      setInitLoaded(true);
    } catch (e: any) {
      setCreateError(e?.message || "초기 데이터 로드 중 오류가 발생했습니다.");
    } finally {
      setIsInitLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCreateOpen || initLoaded) return;
    fetchInitData();
  }, [fetchInitData, initLoaded, isCreateOpen]);

  const openCreateModal = () => {
    setCreateError(null);
    setCreateForm({
      epcCompany: "",
      epcProduct: "",
      epcSerial: "",
      epcLot: "",
      epcManufacture: "",
      expiryDate: "",
    });
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (isSubmitting) return;
    setIsCreateOpen(false);
  };

  const handleSerialInputChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 9);
    setCreateForm((prev) => ({ ...prev, epcSerial: digitsOnly }));
  };

  const handleCreate = useCallback(async () => {
    if (!createForm.epcCompany || !createForm.epcProduct || !createForm.epcSerial || !createForm.epcLot || !createForm.epcManufacture || !createForm.expiryDate) {
      setCreateError("모든 항목을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const epcCompany = Number(createForm.epcCompany);
      const epcProduct = Number(createForm.epcProduct);
      const epcSerial = Number(createForm.epcSerial);
      const epcLot = Number(createForm.epcLot);

      if (!Number.isFinite(epcCompany) || !Number.isFinite(epcProduct) || !Number.isFinite(epcSerial) || !Number.isFinite(epcLot)) {
        setCreateError("선택 항목 값이 올바르지 않습니다.");
        setIsSubmitting(false);
        return;
      }
      if (!/^\d{1,9}$/.test(createForm.epcSerial)) {
        setCreateError("epcSerial은 0부터 최대 9자리 숫자만 입력할 수 있습니다.");
        setIsSubmitting(false);
        return;
      }
      const epcManufacture = toCompactDate(createForm.epcManufacture);
      const expiryDate = toCompactDate(createForm.expiryDate);
      if (!/^\d{8}$/.test(epcManufacture) || !/^\d{8}$/.test(expiryDate)) {
        setCreateError("epcManufacture, expiryDate는 8자리 문자열 날짜 형식이어야 합니다.");
        setIsSubmitting(false);
        return;
      }

      const base = getBackendUrl() || "";
      const payload = {
        epcCompany,
        epcProduct,
        epcSerial,
        epcLot,
        epcManufacture,
        expiryDate,
      };

      const res = await fetch(`${base}/api/v1/epc/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`EPC 등록 실패: HTTP ${res.status}`);
      }

      setIsCreateOpen(false);
      await fetchEpcList(page);
    } catch (e: any) {
      setCreateError(e?.message || "EPC 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }, [createForm, fetchEpcList, page]);

  const detailFields = useMemo(
    () => [
      {
        label: "Company",
        value: selectedRow
          ? formatNameWithCode(selectedRow.company?.companyName, selectedRow.epc_company ?? selectedRow.company?.epcCompany)
          : "-",
      },
      {
        label: "Product",
        value: selectedRow
          ? formatNameWithCode(selectedRow.product?.productName, selectedRow.epc_product ?? selectedRow.product?.epcProduct)
          : "-",
      },
      {
        label: "Lot",
        value: selectedRow ? formatNameWithCode(selectedRow.lot?.lotName, selectedRow.epc_lot ?? selectedRow.lot?.epcLot) : "-",
      },
      { label: "Manufacture", value: selectedRow ? formatDateValue(getEpcManufacture(selectedRow)) : "-" },
      { label: "Serial", value: selectedRow ? formatSerialValue(getEpcSerial(selectedRow)) : "-" },
      { label: "ExpiryDate", value: selectedRow ? formatDateValue(getExpiryDate(selectedRow)) : "-" },
    ],
    [selectedRow]
  );

  const qrValue = selectedRow ? toDisplay(getEpcCode(selectedRow)) : "-";
  const totalPages = pageInfo?.totalPages ?? 1;

  const renderPageButtons = () => {
    if (totalPages <= 1) return null;
    const maxBtn = 5;
    let start = Math.max(0, page - Math.floor(maxBtn / 2));
    const end = Math.min(totalPages - 1, start + maxBtn - 1);
    if (end - start < maxBtn - 1) start = Math.max(0, end - maxBtn + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((i) => (
      <button
        key={i}
        onClick={() => setPage(i)}
        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
          i === page
            ? "bg-blue-600 text-white shadow-md"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
        }`}
      >
        {i + 1}
      </button>
    ));
  };

  const ref = useRef<HTMLDivElement | null>(null);

  const download = (): void => {
    if (!ref.current) return;

    const canvas = ref.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const rawEpcCode = selectedRow ? toDisplay(getEpcCode(selectedRow)) : "";
    const safeEpcCode = rawEpcCode
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
    const fileName = `${safeEpcCode || "qr"}.png`;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">EPC 목록</h1>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-sm font-black hover:bg-gray-700 disabled:opacity-50"
          >
            등록
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">EPC 목록</h2>
            {pageInfo && <div className="text-sm font-black text-white">{pageInfo.totalElements.toLocaleString()} 건</div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/60">
                  <th className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">업체</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">제품</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">로트</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">제조일</th>
                  <th className="px-5 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">시리얼 번호</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">만료일</th>
                  <th className="px-5 py-3 text-center text-xs font-black text-gray-400 uppercase tracking-wider">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center text-gray-400" colSpan={7}>
                      -
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={`${getEpcCode(row) ?? "empty"}-${idx}`} className="group hover:bg-gray-700/40 transition-colors">
                      <td className="relative px-5 py-3 text-gray-200">
                        {toDisplay(getEpcCompany(row))}
                        <div className="pointer-events-none absolute left-5 top-0 -translate-y-1/2 rounded-md border border-gray-500 bg-gray-900/95 px-2 py-1 text-xs text-gray-200 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="font-mono">{toDisplay(getEpcCode(row))}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-200">{toDisplay(getEpcProduct(row))}</td>
                      <td className="px-5 py-3 text-gray-200">{toDisplay(getEpcLot(row))}</td>
                      <td className="px-5 py-3 text-gray-200">{formatDateValue(getEpcManufacture(row))}</td>
                      <td className="px-5 py-3 text-right font-mono text-gray-200">{formatSerialValue(getEpcSerial(row))}</td>
                      <td className="px-5 py-3 text-gray-200">{formatDateValue(getExpiryDate(row))}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-700 text-xs font-black hover:bg-blue-600"
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pageInfo && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {[
              { label: "«", action: () => setPage(0), disabled: pageInfo.first },
              { label: "‹", action: () => setPage((prev) => Math.max(0, prev - 1)), disabled: pageInfo.first },
            ].map(({ label, action, disabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 transition-all"
              >
                {label}
              </button>
            ))}
            {renderPageButtons()}
            {[
              { label: "›", action: () => setPage((prev) => Math.min(totalPages - 1, prev + 1)), disabled: pageInfo.last },
              { label: "»", action: () => setPage(totalPages - 1), disabled: pageInfo.last },
            ].map(({ label, action, disabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 transition-all"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
              <h2 className="text-base font-black">새 EPC 등록</h2>
              <button
                type="button"
                onClick={closeCreateModal}
                className="h-8 w-8 rounded-lg text-xl text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {createError && (
                <div className="rounded-xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">
                  {createError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-gray-400">Company</label>
                <select
                  value={createForm.epcCompany}
                  disabled={isInitLoading || isSubmitting}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      epcCompany: event.target.value,
                      epcProduct: "",
                      epcLot: "",
                    }))
                  }
                  className="w-full rounded-xl border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">선택</option>
                  {companyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Product
                  {!createForm.epcCompany && <span className="ml-2 text-xs text-amber-400">회사 선택 후 활성화</span>}
                </label>
                <select
                  value={createForm.epcProduct}
                  disabled={isInitLoading || isSubmitting || !createForm.epcCompany}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      epcProduct: event.target.value,
                      epcLot: "",
                    }))
                  }
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none ${
                    !createForm.epcCompany
                      ? "cursor-not-allowed border-gray-700 bg-gray-950 text-gray-500"
                      : "border-gray-600 bg-gray-900 text-white focus:border-blue-500"
                  }`}
                >
                  <option value="">선택</option>
                  {productOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Lot
                  {(!createForm.epcCompany || !createForm.epcProduct) && (
                    <span className="ml-2 text-xs text-amber-400">회사/상품 선택 후 활성화</span>
                  )}
                </label>
                <select
                  value={createForm.epcLot}
                  disabled={isInitLoading || isSubmitting || !createForm.epcCompany || !createForm.epcProduct}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, epcLot: event.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none ${
                    !createForm.epcCompany || !createForm.epcProduct
                      ? "cursor-not-allowed border-gray-700 bg-gray-950 text-gray-500"
                      : "border-gray-600 bg-gray-900 text-white focus:border-blue-500"
                  }`}
                >
                  <option value="">선택</option>
                  {lotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Serial</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={createForm.epcSerial}
                  disabled={isSubmitting}
                  onChange={(event) => handleSerialInputChange(event.target.value)}
                  placeholder="0 ~ 999999999"
                  className="w-full rounded-xl border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Manufacture Date</label>
                <input
                  type="date"
                  value={createForm.epcManufacture}
                  disabled={isSubmitting}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, epcManufacture: event.target.value }))}
                  className="w-full rounded-xl border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Expiry Date</label>
                <input
                  type="date"
                  value={createForm.expiryDate}
                  disabled={isSubmitting}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, expiryDate: event.target.value }))}
                  className="w-full rounded-xl border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-700 px-6 py-4">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-black text-white hover:bg-gray-600 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting || isInitLoading}
                className="rounded-lg border border-blue-500 bg-blue-600 px-3 py-2 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
              <h2 className="text-base font-black">EPC 상세보기</h2>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="h-8 w-8 rounded-lg text-xl text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 px-6 py-5 md:grid-cols-[1fr_300px]">
              <div className="space-y-2">
                {detailFields.map((field) => (
                  <div key={field.label} className="rounded-xl bg-gray-900/60 px-4 py-3">
                    <p className="text-xs text-gray-400">{field.label}</p>
                    <p className="mt-1 break-all text-sm text-white">{field.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5 flex flex-col items-center justify-start">
                <div className="mb-3 flex w-full items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">QR CODE</p>
                  <button
                    type="button"
                    onClick={download}
                    aria-label="QR 코드 다운로드"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M12 3v11" />
                      <path d="m7 11 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                  </button>
                </div>
                <div ref={ref} className="rounded-lg bg-white p-4">
                  <QRCodeCanvas value={qrValue} size={220} />
                </div>
                <p className="mt-3 w-full break-all text-center font-mono text-[14px] text-gray-300">{qrValue}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
