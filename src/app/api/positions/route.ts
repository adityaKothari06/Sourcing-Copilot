import { NextRequest, NextResponse } from 'next/server';
import { getAllPositions, deletePosition } from '@/lib/storage';

export async function GET() {
  try {
    const positions = await getAllPositions();
    return NextResponse.json({ success: true, positions });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch positions' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing position ID' }, { status: 400 });
    }
    const success = await deletePosition(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Error deleting position:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete position' }, { status: 500 });
  }
}
