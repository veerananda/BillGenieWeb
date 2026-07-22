type PaywallListener = () => void;

let listeners: PaywallListener[] = [];

export function subscribeSubscriptionPaywall(listener: PaywallListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function showSubscriptionPaywall(): void {
  listeners.forEach((listener) => listener());
}
