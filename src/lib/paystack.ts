const PAYSTACK_SRC = "https://js.paystack.co/v1/inline.js";

let scriptPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PAYSTACK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface PayWithPaystackInput {
  email: string;
  amountKobo: number;
  metadata?: Record<string, unknown>;
  plan?: string;
}

export async function payWithPaystack(
  input: PayWithPaystackInput
): Promise<{ ok: boolean; reference?: string; error?: string }> {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    return { ok: false, error: "Paystack isn't configured (VITE_PAYSTACK_PUBLIC_KEY missing)." };
  }

  try {
    await loadPaystackScript();
  } catch {
    return { ok: false, error: "Couldn't load Paystack. Check your connection and try again." };
  }

  return new Promise((resolve) => {
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      metadata: input.metadata ?? {},
      ...(input.plan ? { plan: input.plan } : {}),
      callback: (response: { reference: string }) => {
        resolve({ ok: true, reference: response.reference });
      },
      onClose: () => {
        resolve({ ok: false, error: "Payment window closed before completing." });
      },
    });
    handler.openIframe();
  });
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        metadata?: Record<string, unknown>;
        plan?: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}
