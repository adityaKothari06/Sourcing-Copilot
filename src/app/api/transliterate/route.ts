import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { devanagariToHinglish, containsDevanagari } from '@/lib/transliterate';

export async function POST(req: NextRequest) {
  try {
    const { text, target = 'hinglish' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (!containsDevanagari(text)) {
      return NextResponse.json({ success: true, text });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = target === 'english'
          ? `Translate the following spoken recruiter requirement from Hindi into clear, professional English. Keep all company names, numbers, years, and equipment names intact. Return ONLY the translated English text with no quotes:
"""
${text}
"""`
          : `Convert the following spoken Hindi recruitment requirement into natural, fluent Hinglish (Roman script / English alphabet) as spoken by Indian recruiters.
Convert words like एरिया सेल्स मैनेजर to Area Sales Manager, महाराष्ट्र to Maharashtra, रोटावेटर to Rotavator, अनुभव/एक्सपीरियंस to experience, चाहिए to chahiye.
Return ONLY the Hinglish text with no quotes, preamble or formatting:
"""
${text}
"""`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let output = response.text?.trim() || devanagariToHinglish(text);
        output = output
          .replace(/shaktii?maan/gi, 'Shaktiman')
          .replace(/sonaalikaa?/gi, 'Sonalika')
          .replace(/mahindraa?/gi, 'Mahindra')
          .replace(/lemken/gi, 'Lemken');
        return NextResponse.json({ success: true, text: output, engine: 'gemini' });
      } catch (e) {
        console.warn('Gemini transliteration failed, using heuristic engine:', e);
      }
    }

    let fallback = devanagariToHinglish(text);
    fallback = fallback
      .replace(/shaktii?maan/gi, 'Shaktiman')
      .replace(/sonaalikaa?/gi, 'Sonalika')
      .replace(/mahindraa?/gi, 'Mahindra')
      .replace(/lemken/gi, 'Lemken');
    return NextResponse.json({ success: true, text: fallback, engine: 'fallback' });
  } catch (error: any) {
    console.error('Transliteration error:', error);
    return NextResponse.json({ error: error.message || 'Transliteration failed' }, { status: 500 });
  }
}
