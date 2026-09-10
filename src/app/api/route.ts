import { NextResponse } from "next/server";

// Required for static export

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}
