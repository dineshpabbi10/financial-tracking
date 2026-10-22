import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiSession, routeError } from "@/lib/api";
import { deleteImportBatch } from "@/lib/import/store";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { id } = await params;
    const removed = await deleteImportBatch(id);
    if (!removed) {
      return NextResponse.json({ error: "Import not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, 400);
  }
}
