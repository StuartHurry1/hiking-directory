// scripts/enrich-hikes.ts
//
// Auto-resuming, rate-limited AI enrichment for hike JSON files.
// Uses GPT-5 Nano + CSV logging + token accounting.
//
// Auto-resume works by skipping all hikes that already contain `ai`.
// This means you can run the script anytime, stop it anytime,
// and it always continues where it left off.
//
// GPT-5 Nano (2025):
// Input:  $0.05 / 1M tokens
// Output: $0.40 / 1M tokens

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import OpenAI from 'openai';
import { Hike } from './hike-types';

// ---------- Environment guards ----------
function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

function hasGit(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ---------- API Key Check ----------
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is missing.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Model Pricing ----------
const COST_INPUT_PER_M = 0.05;
const COST_OUTPUT_PER_M = 0.40;

function estimateCost(input: number, output: number) {
  return (input / 1_000_000) * COST_INPUT_PER_M +
         (output / 1_000_000) * COST_OUTPUT_PER_M;
}

// ---------- CSV Logging ----------
const CSV_PATH = path.join(process.cwd(), 'data', 'hike-enrichment-usage.csv');

function ensureCsvHeader() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(
      CSV_PATH,
      'slug,input_tokens,output_tokens,total_tokens,cost_usd,timestamp\n',
      'utf8'
    );
  }
}

function appendCsvRow(
  slug: string,
  input: number,
  output: number,
  cost: number
) {
  const total = input + output;
  const timestamp = new Date().toISOString();
  fs.appendFileSync(
    CSV_PATH,
    `${slug},${input},${output},${total},${cost.toFixed(6)},${timestamp}\n`,
    'utf8'
  );
}

// ---------- Settings ----------
function getNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MAX_PER_RUN = getNumberEnv('HIKES_ENRICH_MAX_PER_RUN', 20);
const DELAY_MS = getNumberEnv('HIKES_ENRICH_DELAY_MS', 1000);
const CHECKPOINT_EVERY = getNumberEnv('HIKES_ENRICH_CHECKPOINT_EVERY', 100);

// ---------- Git checkpointing ----------
function commitCheckpoint(label: string) {
  if (!isGitHubActions()) return;
  if (!hasGit()) return;

  try {
    console.log(`\n📦 Checkpoint commit: ${label}`);

    execSync('git status --porcelain', { stdio: 'inherit' });
    execSync('git add data/hikes', { stdio: 'inherit' });
    execSync(
      `git commit -m "${label} [skip ci]"`,
      { stdio: 'inherit' }
    );

    // Avoid conflicts if repo moved on
    execSync('git pull --rebase', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });

  } catch (err) {
    console.error('⚠️ Checkpoint commit failed:', err);
  }
}

// ---------- Helpers ----------
function readHikes() {
  const dir = path.join(process.cwd(), 'data', 'hikes');
  if (!fs.existsSync(dir)) {
    console.error(`Hikes dir missing: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const hikes = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Hike
  );

  return { hikes, dir };
}

function saveHike(dir: string, hike: Hike) {
  fs.writeFileSync(
    path.join(dir, `${hike.slug}.json`),
    JSON.stringify(hike, null, 2),
    'utf8'
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldSkip(hike: Hike) {
  return !!hike.ai;
}

// ---------- GPT-5 Nano Request ----------
async function callOpenAIForHike(hike: Hike) {
  const themes = hike.themes ?? [];

  const userPrompt = `
Return ONLY valid JSON:

{
  "summary": string,
  "terrain_summary": string,
  "safety_notes": string,
  "recommended_gear": string[],
  "best_seasons": string,
  "seo": {
    "title": string,
    "meta_description": string,
    "h1": string
  }
}

Hike details:
Name: ${hike.name}
Region: ${hike.region ?? 'Unknown'}
Country: ${hike.country ?? 'Unknown'}
Distance (km): ${hike.distanceKm ?? 'Unknown'}
Difficulty: ${hike.difficulty ?? 'Unknown'}
Themes: ${themes.length ? themes.join(', ') : 'none'}
`.trim();

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Output concise JSON ONLY. No markdown.' },
      { role: 'user', content: userPrompt }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');

  const ai = JSON.parse(content);
  const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };

  return {
    ai,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0
  };
}

// ---------- Retry Wrapper ----------
async function enrichWithRetry(hike: Hike, maxRetries = 2) {
  let attempt = 0;

  while (true) {
    try {
      return await callOpenAIForHike(hike);
    } catch (err: any) {
      attempt++;

      if (attempt > maxRetries) throw err;

      const backoff = 2000 * attempt;
      console.log(`Retrying in ${backoff}ms…`);
      await sleep(backoff);
    }
  }
}

// ---------- MAIN ----------
async function main() {
  console.log('=== Hiking Enrichment (GPT-5 Nano + Auto-Resume) ===');
  console.log(`Batch size: ${MAX_PER_RUN}`);
  console.log(`Delay: ${DELAY_MS}ms`);
  console.log(`Checkpoint every: ${CHECKPOINT_EVERY}`);
  console.log(`Running in GitHub Actions: ${isGitHubActions()}\n`);

  ensureCsvHeader();

  const { hikes, dir } = readHikes();
  const pending = hikes.filter((h) => !shouldSkip(h));

  if (pending.length === 0) {
    console.log('All hikes already enriched.');
    return;
  }

  const toProcess = pending.slice(0, MAX_PER_RUN);

  let processed = 0;
  let failed = 0;
  let sinceCheckpoint = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const hike of toProcess) {
    console.log(
      `\n[${processed + 1}/${toProcess.length}] Enriching: ${hike.slug}`
    );

    try {
      const { ai, inputTokens, outputTokens } =
        await enrichWithRetry(hike);

      saveHike(dir, { ...hike, ai });

      const cost = estimateCost(inputTokens, outputTokens);
      appendCsvRow(hike.slug, inputTokens, outputTokens, cost);

      processed++;
      sinceCheckpoint++;
      totalInput += inputTokens;
      totalOutput += outputTokens;

      console.log(
        `✔ Saved | in/out ${inputTokens}/${outputTokens} | cost $${cost.toFixed(6)}`
      );

      if (
        isGitHubActions() &&
        CHECKPOINT_EVERY > 0 &&
        sinceCheckpoint >= CHECKPOINT_EVERY
      ) {
        commitCheckpoint(
          `Enrich hikes checkpoint: ${processed} processed`
        );
        sinceCheckpoint = 0;
      }

    } catch {
      failed++;
      console.log(`✖ Failed: ${hike.slug}`);
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  if (
    isGitHubActions() &&
    CHECKPOINT_EVERY > 0 &&
    sinceCheckpoint > 0
  ) {
    commitCheckpoint(
      `Enrich hikes checkpoint: ${processed} processed (final)`
    );
  }

  const batchCost = estimateCost(totalInput, totalOutput);

  console.log('\n=== Batch Complete ===');
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Batch cost: $${batchCost.toFixed(6)}`);
  console.log('Auto-resume is active.');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
