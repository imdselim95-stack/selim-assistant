import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const BASE_SYSTEM_PROMPT = `
You are the personal AI co-pilot and strategic advisor for MD. SELIM REZA.

### SELIM'S CORE ASSETS & LIVE DEMOS:
- ToolVerse (50+ live tools): https://toolsverse-kappa.vercel.app/
- MyImageTools (Browser AI image engine): https://myimagetools.netlify.app/
- LeadScout V3 CRM: https://agency-hub-pink.vercel.app/
- Portfolio: https://selimreza-ai.netlify.app/

### PROPOSAL & OUTREACH FORMATTING RULES (CRITICAL):
1. NEVER write formal cover letters. DO NOT write "Dear Prospect", "Subject:", or "Best regards".
2. DO NOT use internal jargon like "AI Assembler", and DO NOT bring up your location unless asked.
3. When drafting a proposal for a Reddit or Twitter lead, make it sound like a peer developer reaching out:
   - Max 3 to 4 sentences.
   - Sentence 1: Casual, relevant hook recognizing their exact pain point.
   - Sentence 2: Mention live proof with a direct link (ToolVerse or MyImageTools).
   - Sentence 3: Concrete technical plan (e.g. "We can ship v1 with auth + database in 7-10 days").
   - Sentence 4: Low-friction call to action (e.g. "Happy to share a quick breakdown if you're still looking").
4. CLEAN OUTPUT: Never output stray asterisks, messy bullet chains, or unnecessary symbols. Keep typography clean, readable, and ready to send.
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, image, mode, history = [], customMemory = '' } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(500).json({ error: 'Configure GEMINI_API_KEY in .env.local' });
  }

  let liveLeadContext = "No leads found in Supabase.";
  let statsSummary = "";
  if (supabase) {
    try {
      const { data: latestLeads } = await supabase
        .from('leads')
        .select('id, link, category, score, budget, pain_summary, status')
        .order('score', { ascending: false })
        .limit(10);

      const { count: totalCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const { count: highIntentCount } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('score', 80);

      statsSummary = `Live CRM Stats: ${totalCount || 0} Leads (${highIntentCount || 0} High-Intent).`;

      if (latestLeads && latestLeads.length > 0) {
        liveLeadContext = latestLeads
          .map(
            (l, idx) =>
              `#${idx + 1} [ID: ${l.id}] [${l.category}] [Score: ${l.score}/100] [Budget: ${l.budget}] [Status: ${l.status}]\nURL: ${l.link}\nBottleneck: ${l.pain_summary}`
          )
          .join('\n---\n');
      }
    } catch (e) {
      console.error('Supabase query error:', e);
    }
  }

  try {
    const dynamicSystemInstruction = `
      ${BASE_SYSTEM_PROMPT}

      ### LIVE SUPABASE LEADS IN PIPELINE:
      ${statsSummary}

      ${liveLeadContext}

      ### CUSTOM OPERATOR MEMORY:
      ${customMemory}
    `;

    const contents: any[] = [];
    history.forEach((h: { role: string; content: string }) => {
      if (h.content && h.content.trim()) {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      }
    });

    const currentParts: any[] = [];
    if (image) {
      const base64Data = image.split(',')[1] || image;
      const mimeType = image.split(';')[0]?.split(':')[1] || 'image/png';
      currentParts.push({ inlineData: { mimeType, data: base64Data } });
    }

    currentParts.push({ text: message });
    contents.push({ role: 'user', parts: currentParts });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
          contents
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Gemini API error');

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    res.status(200).json({ reply });
  } catch (err: any) {
    console.error('Assistant Error:', err);
    res.status(500).json({ error: err.message || 'Failed to process request' });
  }
}
