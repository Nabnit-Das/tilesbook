import { NextResponse } from "next/server";
import { getPortal } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  try {
    const result = await getPortal((await params).token);
    return NextResponse.json(result || { error: "Link unavailable" }, {
      status: result ? 200 : 404,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Portal temporarily unavailable" },
      { status: 503, headers },
    );
  }
}
