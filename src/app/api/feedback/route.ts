import { NextRequest, NextResponse } from 'next/server';
import { recordFeedback, updatePositionRating } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'rate_search') {
      const { positionId, rating, notes } = body;
      if (!positionId || !rating) {
        return NextResponse.json({ error: 'Missing positionId or rating' }, { status: 400 });
      }
      const ok = await updatePositionRating(positionId, rating, notes);
      return NextResponse.json({ success: ok });
    }

    const { positionId, keywordText, category, portal = 'naukri', vote, notes } = body;

    if (!keywordText || !vote) {
      return NextResponse.json({ error: 'Missing keywordText or vote' }, { status: 400 });
    }

    const result = await recordFeedback({
      positionId,
      keywordText,
      category: category || 'skill',
      portal,
      vote,
      notes,
    });

    return NextResponse.json({ success: true, updatedKeyword: result.updatedKeyword });
  } catch (error: any) {
    console.error('Error recording feedback:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to record keyword feedback' },
      { status: 500 }
    );
  }
}
