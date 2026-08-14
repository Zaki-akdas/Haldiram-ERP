import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';

const allowedCustomerFields = ['name', 'phone', 'email', 'gstin', 'pan', 'address', 'city', 'state', 'pincode', 'beat', 'creditLimit', 'assignedSalespersonId', 'isActive'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const updateData: any = { updatedAt: new Date() };
    for (const field of allowedCustomerFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(customers)
      .set(updateData)
      .where(eq(customers.id, Number(id)))
      .returning();

    if (!updated) {
       return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    await db.delete(customers).where(eq(customers.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}