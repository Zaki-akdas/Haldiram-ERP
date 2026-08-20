import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { companySettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ── Default settings (seeded on first GET if table is empty) ──
const DEFAULTS = {
  companyName: 'PRO SWAMI SHARNAM ENTERPRISES',
  tagline: 'Haldiram Distribution Hub',
  gstin: '23AMFPV5397L1ZB',
  address: 'Bhopal, Madhya Pradesh – 462001',
  phone: '+91 98765 43210',
  email: 'accounts@swamisharanam.in',
  bankName: 'State Bank of India',
  bankAccount: '3987 6543 2109',
  bankIfsc: 'SBIN0001234',
  bankBranch: 'MP Nagar, Bhopal',
  logoUrl: '',
};

/** GET /api/settings — returns the company profile. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db.select().from(companySettings).limit(1);

    // Seed default row if the table is empty
    if (rows.length === 0) {
      const [inserted] = await db.insert(companySettings).values(DEFAULTS).returning();
      return NextResponse.json(inserted);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** PUT /api/settings — upserts the company profile (admin/manager only). */
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      companyName, tagline, gstin, address, phone, email,
      bankName, bankAccount, bankIfsc, bankBranch, logoUrl,
    } = body as Record<string, string>;

    const updates = {
      ...(companyName !== undefined && { companyName }),
      ...(tagline !== undefined && { tagline }),
      ...(gstin !== undefined && { gstin }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(bankName !== undefined && { bankName }),
      ...(bankAccount !== undefined && { bankAccount }),
      ...(bankIfsc !== undefined && { bankIfsc }),
      ...(bankBranch !== undefined && { bankBranch }),
      ...(logoUrl !== undefined && { logoUrl }),
      updatedAt: new Date(),
    };

    // Upsert: update existing row or insert a new one
    const rows = await db.select().from(companySettings).limit(1);

    if (rows.length > 0) {
      const [updated] = await db
        .update(companySettings)
        .set(updates)
        .where(eq(companySettings.id, rows[0].id))
        .returning();
      return NextResponse.json(updated);
    } else {
      const [inserted] = await db
        .insert(companySettings)
        .values({ ...DEFAULTS, ...updates })
        .returning();
      return NextResponse.json(inserted);
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
