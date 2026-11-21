import { NextResponse } from "next/server";
import { newBusiness } from "@/server/store";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host"))
      return NextResponse.json({ error: "Origin denied" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json"))
      return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
    return NextResponse.json(
      { id: await newBusiness(await request.json()) },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid firm details";
    return NextResponse.json(
      { error: message },
      { status: /unauthorized|sign in/i.test(message) ? 401 : 400 },
    );
  }
}
