export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return sessionStorage.getItem("token") || "";
}
