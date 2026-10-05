import fs from 'fs';
import path from 'path';
import { SourcingPosition, KeywordFeedbackSubmission, KeywordItem } from './types';
import { getSupabase, isSupabaseConfigured } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  positions: SourcingPosition[];
  keywordRatings: Record<string, { upvotes: number; downvotes: number; category: string; lastUpdated: string }>;
}

function ensureLocalDbExists(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DatabaseSchema = {
      positions: [],
      keywordRatings: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse db.json, creating fallback', e);
    const fallback: DatabaseSchema = { positions: [], keywordRatings: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveLocalDb(data: DatabaseSchema): void {
  ensureLocalDbExists();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getAllPositions(): Promise<SourcingPosition[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sourcing_positions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          title: row.title,
          rawInput: row.raw_input,
          inputType: row.input_type,
          parsed: row.parsed,
          keywords: row.keywords,
          queries: row.queries,
          searchRating: row.search_rating,
          searchNotes: row.search_notes,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch failed, using local db fallback:', e);
    }
  }

  const db = ensureLocalDbExists();
  return db.positions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function savePosition(position: SourcingPosition): Promise<SourcingPosition> {
  const ratings = await getGlobalKeywordKnowledge();

  // Apply historical keyword weights to current position's keywords
  position.keywords = position.keywords.map((kw) => {
    const historical = ratings[kw.text.toLowerCase()];
    if (historical) {
      return {
        ...kw,
        upvotes: historical.upvotes,
        downvotes: historical.downvotes,
      };
    }
    return kw;
  });

  const supabase = getSupabase();
  if (supabase) {
    try {
      const payload = {
        id: position.id,
        title: position.title,
        raw_input: position.rawInput,
        input_type: position.inputType,
        parsed: position.parsed,
        keywords: position.keywords,
        queries: position.queries,
        search_rating: position.searchRating,
        search_notes: position.searchNotes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sourcing_positions')
        .upsert(payload, { onConflict: 'id' });

      if (!error) {
        return position;
      }
      console.warn('Supabase upsert error, saving locally:', error);
    } catch (e) {
      console.warn('Supabase save failed, saving locally:', e);
    }
  }

  const db = ensureLocalDbExists();
  const existingIndex = db.positions.findIndex((p) => p.id === position.id);

  if (existingIndex >= 0) {
    db.positions[existingIndex] = { ...position, updatedAt: new Date().toISOString() };
  } else {
    db.positions.unshift(position);
  }

  saveLocalDb(db);
  return position;
}

export async function deletePosition(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('sourcing_positions').delete().eq('id', id);
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase delete failed, using local db:', e);
    }
  }

  const db = ensureLocalDbExists();
  const initialLen = db.positions.length;
  db.positions = db.positions.filter((p) => p.id !== id);
  if (db.positions.length !== initialLen) {
    saveLocalDb(db);
    return true;
  }
  return false;
}

export async function recordFeedback(feedback: KeywordFeedbackSubmission): Promise<{ success: boolean; updatedKeyword?: KeywordItem }> {
  const normalizedKey = feedback.keywordText.toLowerCase().trim();
  const supabase = getSupabase();

  if (supabase) {
    try {
      // 1. Log single feedback submission
      await supabase.from('sourcing_keyword_feedback').insert({
        position_id: feedback.positionId,
        keyword_text: normalizedKey,
        category: feedback.category,
        portal: feedback.portal,
        vote: feedback.vote,
        notes: feedback.notes,
      });

      // 2. Fetch existing rating or insert
      const { data: existing } = await supabase
        .from('sourcing_keyword_ratings')
        .select('*')
        .eq('keyword_text', normalizedKey)
        .single();

      let up = existing?.upvotes || 0;
      let down = existing?.downvotes || 0;
      if (feedback.vote === 'up') up += 1;
      else down += 1;

      await supabase.from('sourcing_keyword_ratings').upsert({
        keyword_text: normalizedKey,
        upvotes: up,
        downvotes: down,
        category: feedback.category,
        last_updated: new Date().toISOString(),
      });

      // 3. Update the keyword in the position
      let updatedKeyword: KeywordItem | undefined;
      const { data: posData } = await supabase
        .from('sourcing_positions')
        .select('*')
        .eq('id', feedback.positionId)
        .single();

      if (posData && Array.isArray(posData.keywords)) {
        const kws = posData.keywords.map((k: KeywordItem) => {
          if (k.text.toLowerCase() === normalizedKey) {
            updatedKeyword = {
              ...k,
              userRating: feedback.vote,
              upvotes: up,
              downvotes: down,
            };
            return updatedKeyword;
          }
          return k;
        });

        await supabase
          .from('sourcing_positions')
          .update({ keywords: kws, updated_at: new Date().toISOString() })
          .eq('id', feedback.positionId);
      }

      return { success: true, updatedKeyword };
    } catch (e) {
      console.warn('Supabase feedback failed, using local:', e);
    }
  }

  // Fallback to Local DB
  const db = ensureLocalDbExists();
  if (!db.keywordRatings[normalizedKey]) {
    db.keywordRatings[normalizedKey] = {
      upvotes: 0,
      downvotes: 0,
      category: feedback.category,
      lastUpdated: new Date().toISOString(),
    };
  }

  if (feedback.vote === 'up') {
    db.keywordRatings[normalizedKey].upvotes += 1;
  } else {
    db.keywordRatings[normalizedKey].downvotes += 1;
  }
  db.keywordRatings[normalizedKey].lastUpdated = new Date().toISOString();

  let updatedKeyword: KeywordItem | undefined;
  if (feedback.positionId) {
    const pos = db.positions.find((p) => p.id === feedback.positionId);
    if (pos) {
      const kw = pos.keywords.find((k) => k.text.toLowerCase() === normalizedKey);
      if (kw) {
        kw.userRating = feedback.vote;
        kw.upvotes = db.keywordRatings[normalizedKey].upvotes;
        kw.downvotes = db.keywordRatings[normalizedKey].downvotes;
        updatedKeyword = kw;
      }
      pos.updatedAt = new Date().toISOString();
    }
  }

  saveLocalDb(db);
  return { success: true, updatedKeyword };
}

export async function updatePositionRating(
  positionId: string,
  rating: 'excellent' | 'moderate' | 'poor',
  notes?: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const payload: any = { search_rating: rating, updated_at: new Date().toISOString() };
      if (notes !== undefined) payload.search_notes = notes;
      const { error } = await supabase.from('sourcing_positions').update(payload).eq('id', positionId);
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase rating update failed:', e);
    }
  }

  const db = ensureLocalDbExists();
  const pos = db.positions.find((p) => p.id === positionId);
  if (pos) {
    pos.searchRating = rating;
    if (notes !== undefined) pos.searchNotes = notes;
    pos.updatedAt = new Date().toISOString();
    saveLocalDb(db);
    return true;
  }
  return false;
}

export async function getGlobalKeywordKnowledge(): Promise<Record<string, { upvotes: number; downvotes: number; category: string }>> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('sourcing_keyword_ratings').select('*');
      if (!error && data) {
        const result: Record<string, { upvotes: number; downvotes: number; category: string }> = {};
        for (const row of data) {
          result[row.keyword_text] = {
            upvotes: row.upvotes,
            downvotes: row.downvotes,
            category: row.category,
          };
        }
        return result;
      }
    } catch (e) {
      console.warn('Supabase keyword ratings fetch failed, fallback local:', e);
    }
  }

  const db = ensureLocalDbExists();
  return db.keywordRatings;
}
