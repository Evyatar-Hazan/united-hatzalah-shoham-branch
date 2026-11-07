import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_PATH = fileURLToPath(new URL('./semantic-decision.schema.json', import.meta.url));

const INTENTS = new Set([
  'group_conversation',
  'create_post',
  'revise_draft',
  'approve_draft',
  'latest_draft',
  'cancel_draft',
  'system_control',
  'clarification',
]);

export function runCodexStructured(config, prompt, schemaPath = SCHEMA_PATH, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const runDir = mkdtempSync(join(tmpdir(), 'shoham-codex-router-'));
    const outputPath = join(runDir, 'decision.json');
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      rmSync(runDir, { recursive: true, force: true });
      callback();
    };
    const child = spawn(config.codexCommand, [
      'exec',
      '--ephemeral',
      '--ignore-user-config',
      '--ignore-rules',
      '--skip-git-repo-check',
      '--sandbox', 'read-only',
      '-c', 'approval_policy="never"',
      '--output-schema', schemaPath,
      '--output-last-message', outputPath,
      '--color', 'never',
      '--cd', runDir,
      prompt,
    ], { stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(() => reject(new Error('semantic_router_timeout')));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8_000) stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      finish(() => reject(error));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          const output = readFileSync(outputPath, 'utf8').trim();
          finish(() => resolve(output));
        } catch (error) {
          finish(() => reject(error));
        }
      } else {
        finish(() => reject(new Error(stderr.trim() || `semantic_router_exit_${code}`)));
      }
    });
  });
}

export function parseSemanticDecision(raw) {
  const text = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('semantic_router_json_missing');
  const value = JSON.parse(text.slice(start, end + 1));
  if (!INTENTS.has(value.intent)) throw new Error('semantic_router_intent_invalid');
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('semantic_router_confidence_invalid');
  const facebook = typeof value.facebookText === 'string' ? value.facebookText.trim() : '';
  const instagram = typeof value.instagramText === 'string' ? value.instagramText.trim() : '';
  if ((facebook && !instagram) || (!facebook && instagram)) throw new Error('semantic_router_copy_incomplete');
  if (facebook.length > 1800 || instagram.length > 1200) throw new Error('semantic_router_copy_too_long');
  return {
    intent: value.intent,
    confidence,
    reason: String(value.reason || '').slice(0, 500),
    question: String(value.question || '').trim().slice(0, 300) || null,
    channels: Array.isArray(value.channels) ? value.channels.filter((item) => ['facebook', 'instagram'].includes(item)) : [],
    copy: facebook && instagram ? { facebook, instagram } : null,
    replaceImage: Boolean(value.replaceImage),
    resend: Boolean(value.resend),
    controlAction: ['start', 'stop'].includes(value.controlAction) ? value.controlAction : null,
  };
}

export function buildSemanticPrompt(context) {
  return `You are Codex acting as Jarvis's intent-analysis layer for a Hebrew WhatsApp group that manages social posts.
Hermes is transport only. You are the reasoning layer. Analyze meaning and conversation context; never turn the user's sentence into post copy merely because it mentions a post, draft, approval, or publishing.

Return JSON only with: intent, confidence, reason, question, channels, facebookText, instagramText, replaceImage, resend, controlAction.
Allowed intents:
- group_conversation: discussion between people, asking the group for feedback, small talk, operational questions, or anything that is not an instruction to the assistant.
- create_post: the sender clearly asks the assistant to create a NEW social post, or submits media/text clearly as source material for a new post.
- revise_draft: the sender clearly asks to change the active draft's text, image, emoji, format, or size.
- approve_draft: explicit approval of a specific bot draft. It normally requires a reply to that draft. Set channels.
- latest_draft: asks to show, resend, or identify the current/latest draft.
- cancel_draft: asks to cancel a specific active draft.
- system_control: owner asks to stop or start the automation.
- clarification: the sender is addressing the assistant and wants an action, but the intended post/action is genuinely unclear. Provide one short Hebrew question.

For create_post, produce complete ready-to-review Facebook and Instagram copy in facebookText and instagramText. For revise_draft, return the complete revised copy when text, emoji, or formatting changes; preserve the existing copy when the request only changes media. Never invent facts, names, numbers, diagnoses, outcomes, links, or credits. Preserve the source meaning. Use warm, human, professional Hebrew that does not look AI-generated. Use 1-4 suitable emojis and 3-6 relevant Instagram hashtags. For all other intents set both copy fields to null.
Set replaceImage only when the sender asks for a different image. Set resend when the sender asks to send/show the draft again. Set controlAction only for system_control.

Important examples:
"@all יש למישהו הערות או שאפשר לפרסם?" => group_conversation.
"מהי הסקיצה האחרונה שיש לנו?" => latest_draft.
"שלח אותה פה ותקן ללב כתום" with an active draft => revise_draft.
"גם לדעתי זה טוב" => group_conversation, even if it replies to a bot message.
Do not classify an ordinary sentence as create_post. Use create_post only when the request to the assistant is semantically clear.

Current context:
${JSON.stringify(context, null, 2)}`;
}

export async function classifyInboundMessage(config, context, options = {}) {
  const raw = config.semanticRouterFixture || (options.runModel
    ? await options.runModel(buildSemanticPrompt(context))
    : await runCodexStructured(config, buildSemanticPrompt(context), SCHEMA_PATH, options.timeoutMs));
  const decision = parseSemanticDecision(raw);
  if (['create_post', 'revise_draft', 'approve_draft', 'cancel_draft', 'system_control'].includes(decision.intent) && decision.confidence < 0.82) {
    return {
      intent: 'clarification',
      confidence: decision.confidence,
      reason: 'low_confidence_mutating_intent',
      question: decision.question || 'לא ברור לי אם זו הוראה אליי. מה תרצו שאעשה?',
      channels: [],
      copy: null,
      replaceImage: false,
      resend: false,
      controlAction: null,
    };
  }
  if (decision.intent === 'create_post' && !decision.copy) {
    return { ...decision, intent: 'clarification', question: decision.question || 'מה תרצו שיופיע בפוסט?', channels: [] };
  }
  return decision;
}
