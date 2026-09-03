export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return new Response(JSON.stringify({ error: "Server not configured." }), { status: 500 });
  }

  const res = await fetch("https://api.paystack.co/bank?country=nigeria&currency=NGN", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Couldn't load banks." }), { status: 502 });
  }

  const banks = (data.data as Array<{ name: string; code: string }>).map((b) => ({
    name: b.name,
    code: b.code,
  }));

  return new Response(JSON.stringify({ banks }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
