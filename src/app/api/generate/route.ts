import { NextRequest, NextResponse } from 'next/server';
import { analyzePositionRequirement } from '@/lib/ai-analyzer';
import { savePosition } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, inputType = 'text' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Please provide job description, spoken notes, or requirements' }, { status: 400 });
    }

    const position = await analyzePositionRequirement(text.trim(), inputType);
    await savePosition(position);

    return NextResponse.json({ success: true, position });
  } catch (error: any) {
    console.error('Error generating sourcing strategy:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate search queries and keywords' },
      { status: 500 }
    );
  }
}
