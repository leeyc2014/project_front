"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { loginUserAtom } from "@/atoms/atom";
import { getAuthToken } from "@/utils/authToken";
import type { User } from "@/types/user";
import type { Member, EditForm, CreateForm, MemberListResponse, MemberPageInfo } from "@/types/members";

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getAuthToken()}` };
}

function enabledLabel(enabled: boolean): string {
  return enabled ? "활성화" : "비활성화";
}

function roleLabel(role: string): string {
  const normalized = String(role ?? "").trim().toUpperCase();
  if (normalized === "ADMIN") return "실무자";
  if (normalized === "USER") return "검토자";
  return role || "-";
}

export default function MembersPage() {
  const router = useRouter();
  const [loginUser] = useAtom<User | null>(loginUserAtom);
  const [isMounted, setIsMounted] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<MemberPageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState<EditForm>({
    id: "",
    password: "",
    name: "",
    role: "",
    enabled: true,
  });

  const [createForm, setCreateForm] = useState<CreateForm>({
    id: "",
    password: "",
    name: "",
    role: "USER",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !loginUser) return;
    if (loginUser.role !== "ADMIN") {
      alert("관리자만 접근할 수 있는 페이지입니다.");
      router.replace("/dashboard");
    }
  }, [isMounted, loginUser, router]);

  const fetchMembers = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
      const res = await fetch(`${base}/api/v1/member?page=${pageNum}`, {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`회원 목록 조회 실패: HTTP ${res.status}`);
      const data: MemberListResponse = await res.json();
      const list = data.content ?? [];
      setMembers(list);
      setPageInfo({
        totalElements: data.totalElements ?? list.length,
        totalPages: data.totalPages ?? 1,
        size: data.size ?? list.length,
        number: data.number ?? pageNum,
        first: data.first ?? pageNum === 0,
        last: data.last ?? true,
        numberOfElements: data.numberOfElements ?? list.length,
        empty: data.empty ?? list.length === 0,
      });
    } catch (e: any) {
      setPageInfo(null);
      setError(e.message || "회원 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted || !loginUser || loginUser.role !== "ADMIN") return;
    fetchMembers(page);
  }, [fetchMembers, isMounted, loginUser, page]);

  const openEdit = (member: Member) => {
    setSelectedMember(member);
    setEditForm({
      id: member.id,
      password: "",
      name: member.name,
      role: member.role,
      enabled: member.enabled,
    });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setIsEditOpen(false);
    setSelectedMember(null);
  };

  const closeCreate = () => {
    if (saving) return;
    setIsCreateOpen(false);
  };

  const submitEdit = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
      const isMyAccount = loginUser?.id === selectedMember.id;
      const payload = isMyAccount
        ? {
            password: editForm.password,
            name: editForm.name.trim(),
          }
        : {
            id: editForm.id.trim(),
            password: editForm.password,
            name: editForm.name.trim(),
            role: editForm.role.trim(),
            enabled: editForm.enabled,
          };

      const res = await fetch(`${base}/api/v1/member/${selectedMember.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`회원 수정 실패: HTTP ${res.status}`);

      setIsEditOpen(false);
      setSelectedMember(null);
      await fetchMembers(page);
    } catch (e: any) {
      setError(e.message || "회원 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const submitCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
      const payload = {
        id: createForm.id.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        role: createForm.role.trim(),
      };

      const res = await fetch(`${base}/api/v1/member/signup`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`회원 등록 실패: HTTP ${res.status}`);

      setCreateForm({ id: "", password: "", name: "", role: "USER" });
      setIsCreateOpen(false);
      await fetchMembers(page);
    } catch (e: any) {
      setError(e.message || "회원 등록 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (!loginUser || loginUser.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">권한 확인 중...</p>
      </div>
    );
  }

  const isEditingMe = selectedMember?.id === loginUser.id;
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-black text-white tracking-tight">회원 관리</h1>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-sm font-black hover:bg-gray-700 disabled:opacity-50"
          >
            등록
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-700 rounded-2xl px-5 py-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">회원 목록</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-white">
                {(pageInfo?.totalElements ?? members.length).toLocaleString()} 건
              </span>
              {loading && <span className="text-sm text-blue-400 animate-pulse">불러오는 중...</span>}
            </div>
          </div>

          {loading && members.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500 text-sm">불러오는 중...</div>
          ) : members.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-500 text-sm">등록된 회원이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[32%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-900/60">
                    <th className="px-4 py-2 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-[11px] font-black text-gray-400 uppercase tracking-wider">이름</th>
                    <th className="px-4 py-2 text-center text-[11px] font-black text-gray-400 uppercase tracking-wider">권한</th>
                    <th className="px-4 py-2 text-center text-[11px] font-black text-gray-400 uppercase tracking-wider">활성 여부</th>
                    <th className="px-4 py-2 text-center text-[11px] font-black text-gray-400 uppercase tracking-wider">수정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-gray-300">{member.id}</td>
                      <td className="px-4 py-3 text-white font-semibold">{member.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-blue-900/50 text-blue-300 text-[12px] font-bold px-2.5 py-1 rounded-lg border border-blue-700/50">
                          {roleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block text-[12px] font-bold px-2.5 py-1 rounded-lg border ${
                            member.enabled
                              ? "bg-green-900/50 text-green-300 border-green-700/50"
                              : "bg-gray-700/50 text-gray-400 border-gray-600/50"
                          }`}
                        >
                          {enabledLabel(member.enabled)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openEdit(member)}
                          className="px-2.5 py-1 bg-gray-700 text-white rounded-lg text-[12px] font-black hover:bg-blue-600 transition-all border border-gray-600"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pageInfo && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {[
              { label: "«", action: () => setPage(0), disabled: pageInfo.first },
              { label: "‹", action: () => setPage((p) => Math.max(0, p - 1)), disabled: pageInfo.first },
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
              { label: "›", action: () => setPage((p) => Math.min(totalPages - 1, p + 1)), disabled: pageInfo.last },
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

      {isEditOpen && selectedMember && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeEdit}
        >
          <div
            className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
              <h3 className="text-base font-black text-white">회원 정보 수정</h3>
              <button
                onClick={closeEdit}
                disabled={saving}
                className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ID</label>
                <input
                  type="text"
                  value={editForm.id}
                  disabled={isEditingMe}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, id: e.target.value }))}
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">비밀번호</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="변경하려면 입력하세요"
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">권한</label>
                <div className={`grid grid-cols-2 gap-2 ${isEditingMe ? "opacity-50" : ""}`}>
                  {(["ADMIN", "USER"] as const).map((role) => (
                    <label
                      key={role}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-all ${
                        editForm.role === role
                          ? "border-blue-500 bg-blue-900/20 text-blue-300"
                          : "border-gray-600 bg-gray-900 text-gray-300"
                      } ${isEditingMe ? "cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="edit-role"
                        value={role}
                        checked={editForm.role === role}
                        disabled={isEditingMe}
                        onChange={() => setEditForm((prev) => ({ ...prev, role }))}
                        className="accent-blue-500"
                      />
                      {roleLabel(role)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">활성 여부</label>
                <button
                  type="button"
                  disabled={isEditingMe}
                  onClick={() => setEditForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 border transition-all ${
                    editForm.enabled
                      ? "bg-green-900/30 border-green-700/60 hover:bg-green-900/50"
                      : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                  } ${isEditingMe ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      editForm.enabled
                        ? "bg-green-500 border-green-500"
                        : "bg-transparent border-gray-500"
                    }`}
                  >
                    {editForm.enabled && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm font-bold ${editForm.enabled ? "text-green-300" : "text-gray-400"}`}>
                    {enabledLabel(editForm.enabled)}
                  </span>
                </button>
              </div>
              {isEditingMe && (
                <p className="text-sm text-yellow-300">현재 로그인한 계정은 이름/비밀번호만 수정할 수 있습니다.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-black hover:bg-gray-600 transition-all border border-gray-600 disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={submitEdit}
                disabled={saving}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-500 transition-all border border-blue-500 disabled:opacity-40"
              >
                {saving ? "저장 중..." : "수정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeCreate}
        >
          <div
            className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
              <h3 className="text-base font-black text-white">회원 등록</h3>
              <button
                onClick={closeCreate}
                disabled={saving}
                className="text-gray-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-all disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ID</label>
                <input
                  type="text"
                  value={createForm.id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, id: e.target.value }))}
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">비밀번호</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">이름</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-900 text-white px-3 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">권한</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["ADMIN", "USER"] as const).map((role) => (
                    <label
                      key={role}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-all ${
                        createForm.role === role
                          ? "border-blue-500 bg-blue-900/20 text-blue-300"
                          : "border-gray-600 bg-gray-900 text-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="create-role"
                        value={role}
                        checked={createForm.role === role}
                        onChange={() => setCreateForm((prev) => ({ ...prev, role }))}
                        className="accent-blue-500"
                      />
                      {roleLabel(role)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
              <button
                onClick={closeCreate}
                disabled={saving}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-black hover:bg-gray-600 transition-all border border-gray-600 disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={submitCreate}
                disabled={saving}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-500 transition-all border border-blue-500 disabled:opacity-40"
              >
                {saving ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
