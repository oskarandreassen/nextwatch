// app/components/lib/notify.ts
export function notify(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>("app:toast", { detail: message }));
}
