import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(200).json({ total: 0, highIntent: 0, connected: false });
  }

  try {
    const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    const { count: highIntent } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('score', 80);

    res.status(200).json({
      total: total || 0,
      highIntent: highIntent || 0,
      connected: true
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
