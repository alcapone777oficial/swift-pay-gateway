import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE_URL = "https://api.syncpayments.com.br";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SyncPay credentials not configured");
  }

  const res = await fetch(`${BASE_URL}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

const createPixSchema = z.object({
  amount: z.number().positive(),
  name: z.string().trim().min(2).max(100),
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().trim().email().max(255),
  phone: z.string().regex(/^\d{10,11}$/),
});

export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createPixSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await getAuthToken();

    const res = await fetch(`${BASE_URL}/api/partner/v1/cash-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: data.amount,
        description: "Tarifa ISS",
        client: {
          name: data.name,
          cpf: data.cpf,
          email: data.email,
          phone: data.phone,
        },
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (body as { message?: string })?.message ?? `Falha ao gerar Pix (${res.status})`;
      throw new Error(message);
    }

    const result = body as { pix_code: string; identifier: string; message?: string };
    return { pixCode: result.pix_code, identifier: result.identifier };
  });

export const checkPixStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ identifier: z.string().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const token = await getAuthToken();
    const res = await fetch(
      `${BASE_URL}/api/partner/v1/transaction/${encodeURIComponent(data.identifier)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      return { status: "pending" as const };
    }

    const body = (await res.json()) as { data?: { status?: string } };
    return { status: (body.data?.status ?? "pending") as string };
  });
