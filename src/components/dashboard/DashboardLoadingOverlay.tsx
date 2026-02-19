'use client';

export default function DashboardLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div className="absolute h-30 w-30 animate-spin rounded-full border-2 border-transparent border-t-gray-200 border-l-gray-600 shadow-[0_0_12px_rgba(37,99,235,0.35)]" />
        <div className="absolute flex h-[68px] w-[68px] animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-900 text-[10px] font-extrabold tracking-[0.12em] text-blue-50 shadow-[0_0_22px_rgba(37,99,235,0.55)]">
          <span>LOADING</span>
        </div>
      </div>
    </div>
  );
}
