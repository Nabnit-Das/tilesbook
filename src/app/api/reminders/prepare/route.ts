import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prepareMessages } from "@/server/store";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  try {
    return NextResponse.json(await prepareMessages(await req.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const message =
      e instanceof ZodError
        ? "Invalid firm"
        : e instanceof Error
          ? e.message
          : "Unable to prepare messages";
    const status = /unauthorized|sign in/i.test(message)
      ? 401
      : /denied|role cannot/i.test(message)
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
