// scripts/enrich-hikes.ts
//
// Auto-resuming, rate-limited AI enrichment for hike JSON files.
// Uses GPT-5 Nano + CSV logging + token accounting.
//
// Auto-resume works by skipping all hikes that already contain `ai`.
// This means you can run the script anytime, stop it anytime,
// and it always continues where it left off.
//
// Adds optional checkpoint commits every N successful hikes (CI-friendly):
// - Sets git identity inside the script
// - Does a safe `git pull --rebase` before committing
// - Checkpoint failures are NON-FATAL (enrichment continues)

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { execSync } from 'node:child_process';
import { Hike } from './hike-types';

// ---------- API Key Check ----------
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is missing.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Model Pricing ----------
const COST_INPUT_PER_M = 0.05;
const COST_OUTPUT_PER_M = 0.4;

function estimateCost(input: number, output: number) {
  return (input / 1_000_000) * COST_INPUT_PER_M + (output / 1_000_000) * COST_OUTPUT_PER_M;
}

// ---------- CSV Logging ----------
const CSV_PATH = path.join(process.cwd(), 'data', 'hike-enrichment-usage.csv');

function ensureCsvHeader() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(
      CSV_PATH,
      'slug,input_tokens,output_tokens,total_tokens,cost_usd,timestamp\n',
      'utf8',
    );
  }
}

function appendCsvRow(slug: string, input: number, output: number, cost: number) {
  const total = input + output;
  const timestamp = new Date().toISOString();
  fs.appendFileSync(
    CSV_PATH,
    `${slug},${input},${output},${total},${cost.toFixed(6)},${timestamp}\n`,
    'utf8',
  );
}

// ---------- Settings ----------
function parsePositiveInt(raw: string | undefined, fallback: number) {
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number) {
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function getMaxPerRun() {
  return parsePositiveInt(process.env.HIKES_ENRICH_MAX_PER_RUN, 20);
}

function getDelayMs() {
  return parseNonNegativeInt(process.env.HIKES_ENRICH_DELAY_MS, 1000);
}

/**
 * Checkpoint commit every N successful hikes.
 * - If unset/invalid/<=0, checkpoints are disabled.
 */
function getCheckpointEvery() {
  const raw = process.env.HIKES_ENRICH_CHECKPOINT_EVERY;
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const MAX_PER_RUN = getMaxPerRun();
const DELAY_MS = getDelayMs();
const CHECKPOINT_EVERY = getCheckpointEvery();

// ---------- Helpers ----------
function readHikes() {
  const dir = path.join(process.cwd(), 'data', 'hikes');
  if (!fs.existsSync(dir)) {
    console.error(`Hikes dir missing: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const hikes = files.map((file) => {
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Hike;
  });

  return { hikes, dir };
}

function saveHike(dir: string, hike: Hike) {
  fs.writeFileSync(path.join(dir, `${hike.slug}.json`), JSON.stringify(hike, null, 2), 'utf8');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldSkip(hike: Hike) {
  return !!(hike as any).ai;
}

// ---------- Git / Checkpointing ----------
function hasGitRepo() {
  return fs.existsSync(path.join(process.cwd(), '.git'));
}

function execGit(cmd: string) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim();
}

function safeExecGit(cmd: string): { ok: boolean; out?: string; err?: any } {
  try {
    const out = execGit(cmd);
    return { ok: true, out };
  } catch (err) {
    return { ok: false, err };
  }
}

/**
 * Configure identity for CI/local so git commits do not fail.
 * Non-fatal if it fails for any reason.
 */
function ensureGitIdentity() {
  // Prefer these if present, but default to GitHub Actions bot identity.
  const name =
    process.env.GIT_COMMIT_NAME ||
    process.env.GITHUB_ACTOR ||
    'github-actions[bot]';

  const email =
    process.env.GIT_COMMIT_EMAIL ||
    'github-actions[bot]@users.noreply.github.com';

  safeExecGit(`git config user.name "${name}"`);
  safeExecGit(`git config user.email "${email}"`);
}

function checkpointMessage(totalProcessed: number) {
  return `Enrich hikes checkpoint: ${totalProcessed} processed [skip ci]`;
}

/**
 * Creates a checkpoint commit + push.
 * - Safe pull --rebase first
 * - Non-fatal on any failure (keeps enrichment running)
 */
function commitCheckpoint(totalProcessed: number) {
  if (!hasGitRepo()) {
    console.log('  ⓘ Checkpoint skipped (no .git repo found).');
    return;
  }

  console.log(`  📌 Checkpoint: attempting commit at ${totalProcessed} processed...`);

  ensureGitIdentity();

  // Keep local branch up to date (safe, non-fatal)
  const pull = safeExecGit('git pull --rebase');
  if (!pull.ok) {
    console.log('  ⚠️  Checkpoint: git pull --rebase failed (continuing).');
  }

  // Stage changes (safe, non-fatal)
  const addHikes = safeExecGit('git add data/hikes');
  if (!addHikes.ok) {
    console.log('  ⚠️  Checkpoint: could not stage data/hikes (continuing).');
  }

  const addCsv = safeExecGit('git add data/hike-enrichment-usage.csv');
  if (!addCsv.ok) {
    // CSV may be ignored locally or not present yet; not fatal
  }

  // Commit (if nothing to commit, keep going)
  const msg = checkpointMessage(totalProcessed);
  const commit = safeExecGit(`git commit -m "${msg}"`);
  if (!commit.ok) {
    console.log('  ⓘ Checkpoint: nothing to commit (or commit failed). Continuing.');
    return;
  }

  // Push (non-fatal)
  const push = safeExecGit('git push');
  if (!push.ok) {
    console.log('  ⚠️  Checkpoint: git push failed (continuing).');
    return;
  }

  console.log('  ✅ Checkpoint commit pushed.');
}

// ---------- GPT-5 Nano Request ----------
async function callOpenAIForHike(hike: Hike) {
  const themes = (hike as any).themes ?? [];

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
Name: ${(hike as any).name}
Region: ${(hike as any).region ?? 'Unknown'}
Country: ${(hike as any).country ?? 'Unknown'}
Distance (km): ${(hike as any).distanceKm ?? 'Unknown'}
Difficulty: ${(hike as any).difficulty ?? 'Unknown'}
Themes: ${themes.length ? themes.join(', ') : 'none'}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Output concise JSON ONLY. No markdown.' },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');

  const ai = JSON.parse(content);

  const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };

  return {
    ai,
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
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

      const code = err?.code ?? err?.error?.code;

      if (code === 'insufficient_quota') {
        console.error('\nQuota exceeded — stopping immediately.\n');
        throw err;
      }

      if (attempt > maxRetries) {
        console.error(`FAILED after ${attempt} attempts.`);
        throw err;
      }

      const backoff = 2000 * attempt;
      console.log(`Retrying in ${backoff}ms…`);
      await sleep(backoff);
    }
  }
}

// ---------- MAIN (AUTO-RESUME MODE) ----------
async function main() {
  console.log('=== Hiking Enrichment (GPT-5 Nano + Auto-Resume) ===');
  console.log(`Batch size: ${MAX_PER_RUN}`);
  console.log(`Delay: ${DELAY_MS}ms`);
  console.log(`Checkpoint every: ${CHECKPOINT_EVERY > 0 ? CHECKPOINT_EVERY : 'disabled'}\n`);

  ensureCsvHeader();

  const { hikes, dir } = readHikes();

  const pending = hikes.filter((h) => !shouldSkip(h));
  const remaining = pending.length;

  if (remaining === 0) {
    console.log('All hikes already enriched.');
    return;
  }

  console.log(`Total hikes: ${hikes.length}`);
  console.log(`Already enriched: ${hikes.length - remaining}`);
  console.log(`Remaining: ${remaining}`);
  console.log(`This run will process up to: ${MAX_PER_RUN}\n`);

  const toProcess = pending.slice(0, MAX_PER_RUN);

  let totalInput = 0;
  let totalOutput = 0;
  let processed = 0;
  let failed = 0;

  // For checkpoints
  let successfulSinceCheckpoint = 0;

  for (const hike of toProcess) {
    console.log(`\n[${processed + 1}/${toProcess.length}] Enriching: ${(hike as any).slug}`);

    try {
      const { ai, inputTokens, outputTokens } = await enrichWithRetry(hike);

      const cost = estimateCost(inputTokens, outputTokens);

      // Save updated hike (adds ai)
      saveHike(dir, { ...(hike as any), ai } as Hike);

      // CSV log
      appendCsvRow((hike as any).slug, inputTokens, outputTokens, cost);

      // Counters
      processed++;
      totalInput += inputTokens;
      totalOutput += outputTokens;

      successfulSinceCheckpoint++;

      console.log(`  ✔ Saved | in/out ${inputTokens}/${outputTokens} | cost $${cost.toFixed(6)}`);

      // Checkpoint commit every N successful saves
      if (CHECKPOINT_EVERY > 0 && successfulSinceCheckpoint >= CHECKPOINT_EVERY) {
        commitCheckpoint(processed);
        successfulSinceCheckpoint = 0;
      }
    } catch (err: any) {
      failed++;
      console.log(`  ✖ Failed: ${(hike as any).slug}`);
      // keep going
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const batchCost = estimateCost(totalInput, totalOutput);

  console.log('\n=== Batch Complete ===');
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining after this batch: ${remaining - processed}`);
  console.log(`Batch input/output tokens: ${totalInput}/${totalOutput}`);
  console.log(`Batch cost (est.): $${batchCost.toFixed(6)}`);
  console.log(`CSV: ${CSV_PATH}`);
  console.log('=========================\n');

  console.log('Auto-resume is active.');
  console.log('Run the script again anytime to continue where you left off.');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
