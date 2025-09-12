// app/components/lib/notify.ts
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent<string>("app:toast", { detail: message }));
}
