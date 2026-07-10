export const gameEvents = new EventTarget();

export function emitGameEvent<T>(name: string, detail?: T): void {
  gameEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

export function onGameEvent<T>(name: string, handler: (detail: T) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<T>).detail);
  gameEvents.addEventListener(name, listener);
  return () => gameEvents.removeEventListener(name, listener);
}
