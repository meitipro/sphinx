import { NextResponse } from 'next/server';

import { LIMITS, judgePrompt, readLabels } from '@/lib/judge.mjs';

/**
 * "Try your notes": the host's sample answers judged by one model with the
 * contract's own prompt, before anything is locked. A preview only. It is not
 * binding, not stored, and not what validators will answer: on chain several
 * validators each label the answers with their own models and must agree.
 *
 * The only server secret on this site is the model key for this route
 * (OPENROUTER_API_KEY). The base URL is OpenRouter's API root without /v1,
 * which is appended here. With no key set the route says so and the form
 * still works without previews.
 */

const BASE = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api').replace(/\/+$/, '');
const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 12;
const MAX_SAMPLES = 5;
const seen = new Map<string, number[]>();

export async function POST(request: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Previews are off on this deployment: no model key is set. Locking and judging do not need one.' }, { status: 503 });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) {
    return NextResponse.json({ error: 'Twelve previews in ten minutes from this connection. Try again later.' }, { status: 429 });
  }
  let body: { riddle?: string; answer?: string; notes?: string; samples?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* handled below */
  }
  const riddle = String(body.riddle ?? '').trim();
  const answer = String(body.answer ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  const samples = (Array.isArray(body.samples) ? body.samples : []).map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_SAMPLES);
  if (!riddle || !answer || samples.length === 0) {
    return NextResponse.json({ error: 'Write the riddle, the answer and at least one sample answer.' }, { status: 400 });
  }
  if (riddle.length > LIMITS.riddle || answer.length > LIMITS.answer || notes.length > LIMITS.notes || samples.some((s) => s.length > LIMITS.answer)) {
    return NextResponse.json({ error: 'Something is longer than the contract allows.' }, { status: 400 });
  }
  seen.set(ip, [...recent, now]);
  const prompt = judgePrompt(riddle, answer, notes, samples);
  try {
    const response = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
      cache: 'no-store',
    });
    const out = await response.json();
    const text = String(out?.choices?.[0]?.message?.content ?? '');
    const labels = readLabels(text, samples.length);
    if (!response.ok || !labels) {
      return NextResponse.json({ error: 'The preview model did not answer with one label per sample. Try again.' }, { status: 502 });
    }
    return NextResponse.json({ model: MODEL, samples, labels });
  } catch {
    return NextResponse.json({ error: 'The preview model did not answer. Try again in a moment.' }, { status: 502 });
  }
}
