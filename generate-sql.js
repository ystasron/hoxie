#!/usr/bin/env node
// generate-sql.js — reads questions.json → writes questions.sql
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(readFileSync(join(__dirname, 'questions.json'), 'utf8'));

const esc = s => s.replace(/'/g, "''");

const groups = {};
for (const q of questions) {
  const key = `${q.subject}/${q.category}`;
  (groups[key] ??= []).push(q);
}

let sql = `-- ============================================================
-- Hoxiee — Question bank seed data
-- Auto-generated from questions.json (${questions.length} questions)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run: uses ON CONFLICT to upsert existing rows.
-- ============================================================

create table if not exists public.quiz_questions (
  id integer primary key,
  subject text not null,
  category text not null,
  prompt text not null,
  answer text not null,
  unique (subject, category, id)
);

alter table public.quiz_questions enable row level security;
`;

const order = ['math/algebra', 'english/grammar', 'english/spelling'];

for (const key of order) {
  const qs = groups[key];
  if (!qs) continue;
  const [subject, category] = key.split('/');
  sql += `\n-- ============================================================\n`;
  sql += `-- ${subject === 'math' ? 'Math' : 'English'} · ${category.charAt(0).toUpperCase() + category.slice(1)} (${qs.length} questions)\n`;
  sql += `-- ============================================================\n`;
  sql += `insert into public.quiz_questions (id, subject, category, prompt, answer) values\n`;
  const rows = qs.map(q =>
    `  (${q.id}, '${q.subject}', '${q.category}', '${esc(q.prompt)}', '${esc(q.answer)}')`
  );
  sql += rows.join(',\n');
  sql += `\non conflict (id) do update set\n`;
  sql += `  subject = excluded.subject,\n`;
  sql += `  category = excluded.category,\n`;
  sql += `  prompt = excluded.prompt,\n`;
  sql += `  answer = excluded.answer;\n`;
}

writeFileSync(join(__dirname, 'questions.sql'), sql);
console.log(`✓ Generated questions.sql with ${questions.length} questions`);
