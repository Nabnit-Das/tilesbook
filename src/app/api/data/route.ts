import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSnapshot, mutate } from "@/server/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown) {
  const message =
    error instanceof ZodError
      ? "Invalid request fields"
      : error instanceof Error
        ? error.message
        : "Request failed";
  const status = /sign in|unauthenticated|unauthorized|session required/i.test(
    message,
  )
    ? 401
    : /denied|inaccessible|role cannot|not authorized|permission/i.test(message)
      ? 403
      : 400;
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await getSnapshot(
        new URL(request.url).searchParams.get("businessId") ?? undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return failure(err);
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !== new URL(request.url).host &&
      new URL(origin).host !== request.headers.get("host")
    )
      return NextResponse.json({ error: "Origin denied" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json"))
      return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
    return NextResponse.json(await mutate(await request.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return failure(err);
  }
}
