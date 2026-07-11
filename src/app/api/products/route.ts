import { NextResponse } from "next/server";
import { and, eq, ilike } from "drizzle-orm";
import { dbConfigured, getDb } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { jsonError } from "@/lib/api-util";

/**
 * Public read of the shared supermarket catalogue (no account needed —
 * it contains no personal data). Filled by tools/tesco-scraper.
 */
export async function GET(request: Request) {
  if (!dbConfigured()) {
    return jsonError("The catalogue isn't available on this deployment.", 503);
  }
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "500", 10) || 500, 1),
    500
  );

  const db = getDb();
  const where = q
    ? and(eq(products.available, true), ilike(products.name, `%${q}%`))
    : eq(products.available, true);
  const rows = await db
    .select({
      id: products.id,
      supermarket: products.supermarket,
      url: products.url,
      name: products.name,
      pricePence: products.pricePence,
      sizeText: products.sizeText,
      portions: products.portions,
      ingredientsText: products.ingredientsText,
      allergens: products.allergens,
      mayContain: products.mayContain,
      cookMinutes: products.cookMinutes,
      dietFlags: products.dietFlags,
      category: products.category,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .where(where)
    .orderBy(products.name)
    .limit(limit);

  return NextResponse.json({ products: rows });
}
