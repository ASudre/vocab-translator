import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const word = searchParams.get('word');

  if (!word) {
    return NextResponse.json({ error: 'Word parameter is required' }, { status: 400 });
  }

  try {
    const cleanWord = word.split(',')[0].trim();
    const url = `https://api.wiktapi.dev/v1/en/word/${encodeURIComponent(cleanWord)}/translations`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch translation' }, { status: response.status });
    }

    const data = await response.json();
    
    const spanishTranslations = new Set<string>();
    
    if (data.translations && Array.isArray(data.translations)) {
      for (const posEntry of data.translations) {
        if (posEntry.translations && Array.isArray(posEntry.translations)) {
          for (const trans of posEntry.translations) {
            if (trans.lang === 'Spanish' || trans.code === 'es') {
              spanishTranslations.add(trans.word);
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      word,
      translations: Array.from(spanishTranslations).slice(0, 5)
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
