// scripts/enrich-hikes.ts
//
// Auto-resuming, rate-limited AI enrichment for hike JSON files.
// Uses GPT-5 Nano + CSV logging + token accounting.
//
// Auto-resume works by skipping all hikes that already contain `ai`.
// This means you can run the script anytime, stop it anytime,
// and it always continues where it left off.
//
// Adds optional checkpoint commits every N successful hikes (CI-friendly).
// - Configures git identity (local repo config) inside the script
// - Safe `git pull --rebase` before checkpoint commit
// - Non-fatal checkpoint failures (logs and continues)

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
    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(
      CSV_PATH,
      'slug,input_tokens,output_tokens,total_tokens,cost_usd,timestamp\n',
      'utf8'
    );
  }
}

function appendCsvRow(slug: string, input: number, output: number, cost: number) {
  const total = input + output;
  const timestamp = new Date().toISOString();
  fs.appendFileSync(
    CSV_PATH,
    `${slug},${input},${output},${total},${cost.toFixed(6)},${timestamp}\n`,
    'utf8'
  );
}

// ---------- Settings ----------
function getMaxPerRun() {
  const raw = process.env.HIKES_ENRICH_MAX_PER_RUN;
  const n = raw ? Number(raw) : 20;
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function getDelayMs() {
  const raw = process.env.HIKES_ENRICH_DELAY_MS;
  const n = raw ? Number(raw) : 1000;
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

function getCheckpointEvery() {
  const raw = process.env.HIKES_ENRICH_CHECKPOINT_EVERY;
  if (!raw) return 0; // 0 = disabled
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const MAX_PER_RUN = getMaxPerRun();
const DELAY_MS = getDelayMs();
const CHECKPOINT_EVERY = getCheckpointEvery();
const IS_CI = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';

// ---------- Helpers ----------
function readHikes() {
  const dir = path.join(process.cwd(), 'data', 'hikes');
  if (!fs.existsSync(dir)) {
    console.error(`Hikes dir missing: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
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

function runGit(cmd: string) {
  return execSync(cmd, { stdio: 'pipe' }).toString('utf8').trim();
}

function logLine(msg: string) {
  console.log(msg);
}

function warnLine(msg: string) {
  console.warn(msg);
}

// ---------- Git identity + checkpoint commit ----------
function configureGitIdentityIfNeeded() {
  // We only need this if we intend to checkpoint commit.
  if (!IS_CI || CHECKPOINT_EVERY <= 0) return;

  try {
    // Local-only config inside the repo (NOT global)
    runGit(`git config user.name "github-actions[bot]"`);
    runGit(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
  } catch (e: any) {
    // Non-fatal; checkpoint will likely fail, but the run can still continue.
    warnLine(`[checkpoint] Warning: failed to configure git identity: ${e?.message ?? e}`);
  }
}

function tryCheckpointCommit(successCount: number) {
  if (!IS_CI) return;
  if (CHECKPOINT_EVERY <= 0) return;
  if (successCount <= 0) return;
  if (successCount % CHECKPOINT_EVERY !== 0) return;

  logLine(`\n📌 Checkpoint: attempting commit at ${successCount} successful enrichments...`);

  try {
    // Rebase onto latest main to reduce push conflicts.
    // If it fails (rare), we log and continue; final sweep step still exists in workflow.
    try {
      runGit(`git pull --rebase`);
    } catch (e: any) {
      warnLine(`[checkpoint] Warning: git pull --rebase failed: ${e?.message ?? e}`);
      // Continue anyway; commit might still work, push might fail.
    }

    // Stage updated files
    try {
      runGit(`git add data/hikes`);
    } catch {
      // ignore
    }
    try {
      runGit(`git add data/hike-enrichment-usage.csv`);
    } catch {
      // ignore
    }

    // If nothing staged, skip commit
    const status = runGit(`git status --porcelain`);
    if (!status) {
      logLine(`[checkpoint] Nothing to commit at ${successCount}.`);
      return;
    }

    // Commit + push
    // Note: keep message stable so you can track checkpoint commits in history.
    runGit(`git commit -m "Enrich hikes checkpoint: ${successCount} processed [skip ci]"`);

    try {
      runGit(`git push`);
      logLine(`✅ Checkpoint pushed: ${successCount}`);
    } catch (e: any) {
      warnLine(`[checkpoint] Warning: git push failed: ${e?.message ?? e}`);
      // Non-fatal: enrichment results remain in the runner workspace, and final workflow step may still push.
    }
  } catch (e: any) {
    warnLine(`[checkpoint] Non-fatal checkpoint failure: ${e?.message ?? e}`);
  }
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
Name: ${hike.name}
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
  console.log(`Checkpoint every: ${CHECKPOINT_EVERY || 'disabled'}`);
  console.log(`CI mode: ${IS_CI ? 'true' : 'false'}\n`);

  ensureCsvHeader();
  configureGitIdentityIfNeeded();

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
  let successes = 0;

  for (const hike of toProcess) {
    console.log(`\n[${processed + 1}/${toProcess.length}] Enriching: ${hike.slug}`);

    try {
      const { ai, inputTokens, outputTokens } = await enrichWithRetry(hike);

      const cost = estimateCost(inputTokens, outputTokens);

      // Save updated hike
      saveHike(dir, { ...(hike as any), ai });

      // Update counters
      processed++;
      successes++;
      totalInput += inputTokens;
      totalOutput += outputTokens;

      // CSV log
      appendCsvRow(hike.slug, inputTokens, outputTokens, cost);

      console.log(`  ✔ Saved | in/out ${inputTokens}/${outputTokens} | cost $${cost.toFixed(6)}`);

      // Optional checkpoint commit (non-fatal)
      tryCheckpointCommit(successes);
    } catch (e: any) {
      processed++;
      failed++;
      console.log(`  ✖ Failed: ${hike.slug} (${e?.message ?? 'unknown error'})`);
      // No checkpoint on failure
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const batchCost = estimateCost(totalInput, totalOutput);

  console.log('\n=== Batch Complete ===');
  console.log(`Processed: ${processed}`);
  console.log(`Succeeded: ${successes}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining after this batch: ${remaining - successes}`);
  console.log(`Batch cost: $${batchCost.toFixed(6)}`);
  console.log(`CSV: ${CSV_PATH}`);
  console.log('=========================\n');

  console.log('Auto-resume is active.');
  console.log('Run the script again anytime to continue where you left off.');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
