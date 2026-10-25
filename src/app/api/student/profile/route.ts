import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.student) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.student.id,
    name: user.student.name,
    email: user.student.email,
    register_no: user.student.register_no,
    status: user.student.status,
    display_name_preference: user.student.display_name_preference,
  });
}
