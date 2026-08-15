import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// WebLLM: a quantised language model running in the browser on WebGPU.
//
// WHY THIS RATHER THAN A HOSTED MODEL
// Answering "how many doses did I miss?" requires a prompt containing the
// patient's dose history. Sending that to an API would break the rule the rest
// of the application holds to. WebLLM executes the model on the local GPU, so
// the prompt and the records never leave the machine.
//
// WHAT DOES CROSS THE NETWORK, STATED PLAINLY
// The library and the model weights are downloaded once, from a CDN. That is a
// download OF the model, never an upload of anything about the patient. After
// the first load the weights sit in the browser's Cache Storage and the feature
// works with the network off entirely.
//
// WHY THE LIBRARY IS A DEPENDENCY BUT LOADED WITH import()
// @mlc-ai/web-llm is pinned in package.json, so the exact code is in the
// lockfile and auditable — not fetched from a CDN at runtime, which would put a
// third party in the trust path of a health application. But it is a megabyte
// of WebGPU runtime, and the great majority of users never open the assistant,
// so a static import would make every one of them pay for it. A dynamic
// import() gives both: the bundler splits it into a chunk that is only
// requested when someone actually asks for the model.

// Both are instruction-tuned and quantised to 4 bits.
//
// The 1B model is the default and the one to prefer. In testing, the 360M model
// restated figures unreliably — producing fluent sentences that mangled the
// patient's own numbers ("2 days of 7 days of 135 minutes"). The numeric
// grounding check in data/assistant.js catches those and falls back to the
// deterministic responder, so nothing wrong is ever shown, but a model that
// trips the guard often is a model that rarely gets to answer. It is kept as an
// option for devices where 879 MB is genuinely not available, and labelled
// honestly rather than presented as an equal choice.
export const MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Recommended",
    detail: "Llama 3.2, 1 billion parameters",
    note: "Best at restating your figures accurately.",
    megabytes: 879,
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "Smaller download",
    detail: "SmolLM2, 360 million parameters",
    note: "Less than half the size, but less reliable with numbers.",
    megabytes: 376,
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

const CHOICE_KEY = "parkinsense:llm:model";
const CONSENT_KEY = "parkinsense:llm:consented";

// Module-level singleton. Creating an engine compiles shaders and uploads
// weights to the GPU; doing that per question would be unusable.
let engine = null;
let engineModel = null;
let loading = null;
let libraryPromise = null;

// Resolved once and reused. A rejected load clears the cached promise so a
// later attempt retries rather than replaying the failure forever — a dropped
// connection on first use should not disable the feature for the session.
function loadLibrary() {
  if (libraryPromise) return libraryPromise;
  libraryPromise = import("@mlc-ai/web-llm").catch((error) => {
    libraryPromise = null;
    throw error;
  });
  return libraryPromise;
}

// WebGPU is required. The WASM fallback needs cross-origin isolation headers
// that would have to be set on the host, so it is not offered — better to say
// the hardware is unsupported than to ship a path that silently fails.
export async function hasWebGPU() {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

export async function savedChoice() {
  try {
    const [model, consented] = await Promise.all([
      AsyncStorage.getItem(CHOICE_KEY),
      AsyncStorage.getItem(CONSENT_KEY),
    ]);
    return { model: model || DEFAULT_MODEL, consented: consented === "1" };
  } catch {
    return { model: DEFAULT_MODEL, consented: false };
  }
}

async function remember(modelId) {
  try {
    await AsyncStorage.multiSet([
      [CHOICE_KEY, modelId],
      [CONSENT_KEY, "1"],
    ]);
  } catch {
    // A failure here only costs the user a second consent tap later.
  }
}

// Whether the weights are already in Cache Storage, so the panel can load
// silently on a return visit instead of asking permission to download again.
export async function isCached(modelId) {
  if (Platform.OS !== "web" || typeof caches === "undefined") return false;
  try {
    const lib = await loadLibrary();
    if (typeof lib.hasModelInCache === "function") {
      return await lib.hasModelInCache(modelId);
    }
  } catch {
    // Fall through to the recorded flag below.
  }
  try {
    const { model, consented } = await savedChoice();
    return consented && model === modelId;
  } catch {
    return false;
  }
}

export function ready() {
  return Boolean(engine);
}

export function activeModel() {
  return engineModel;
}

// Download weights if needed, compile, and hold the engine.
//
// `onProgress` receives { fraction, text } throughout. This is never called
// without an explicit user action: a several-hundred-megabyte download on
// someone's phone plan is not something to start on their behalf.
export async function prepare(modelId = DEFAULT_MODEL, onProgress) {
  if (engine && engineModel === modelId) return engine;
  if (loading) return loading;

  loading = (async () => {
    // Switching models must release the previous one's GPU memory first.
    if (engine && engineModel !== modelId) {
      try {
        await engine.unload();
      } catch {
        // Unload failure should not block the new engine.
      }
      engine = null;
      engineModel = null;
    }

    const lib = await loadLibrary();
    const created = await lib.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        onProgress?.({
          fraction: typeof report?.progress === "number" ? report.progress : 0,
          text: report?.text || "Preparing…",
        });
      },
    });

    engine = created;
    engineModel = modelId;
    await remember(modelId);
    return created;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

// An engine handle can outlive the weights that were loaded into it: the object
// is still there but reports "Model not loaded" on the next request. Reloading
// from the browser cache costs a second or two and no bandwidth, which is far
// better than telling the user their assistant has stopped working.
//
// Distinct from a lost device, checked separately below — that one is fatal to
// the engine and reloading into it would fail too.
function needsReload(error) {
  const message = String(error?.message || error);
  return /model not loaded/i.test(message) || /reload\(/i.test(message);
}

async function stream(messages, onToken, options) {
  const completion = await engine.chat.completions.create({
    messages,
    stream: true,
    // Low temperature because the job is to restate supplied figures faithfully,
    // not to write prose. Creativity here would mean invention.
    temperature: options.temperature ?? 0.2,
    top_p: options.topP ?? 0.9,
    max_tokens: options.maxTokens ?? 220,
  });

  let full = "";
  for await (const chunk of completion) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      onToken?.(full);
    }
  }
  return full.trim();
}

// A lost GPU device is unrecoverable for the current engine — the whole device
// is gone, not just the weights — so the engine is dropped and `ready()` starts
// reporting false. Without this, every later question would queue behind a dead
// device and hang.
function deviceLost(error) {
  return /device was lost|device is lost|gpudevicelost/i.test(
    String(error?.message || error)
  );
}

// Generation must not be able to hang forever. A lost device leaves the async
// iterator waiting on frames that will never arrive, and the interface would sit
// on a spinner with no way out. The ceiling is generous — a slow CPU-bound GPU
// on a long answer is legitimate — but finite.
const GENERATION_TIMEOUT_MS = 45000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("The model took too long and was stopped.")),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Streamed completion. `onToken` fires per delta so the caller can show progress.
// Returns the finished string. Never resolves with partial text on failure —
// the caller falls back instead.
export async function generate(messages, onToken, options = {}) {
  if (!engine) throw new Error("Engine not prepared");
  const budget = options.timeoutMs ?? GENERATION_TIMEOUT_MS;

  try {
    return await withTimeout(stream(messages, onToken, options), budget);
  } catch (error) {
    if (deviceLost(error)) {
      await unload();
      throw new Error(
        "The graphics device was lost, usually from memory pressure. The assistant has been unloaded."
      );
    }

    if (!needsReload(error) || !engineModel) {
      // A timeout leaves the engine mid-generation; stop it so the next
      // question is not queued behind an abandoned one.
      await interrupt();
      throw error;
    }

    // One recovery attempt for a dropped model, which reloads from cache.
    await engine.reload(engineModel);
    return await withTimeout(stream(messages, onToken, options), budget);
  }
}

// Stops an in-flight generation. The promise in `generate` resolves with
// whatever had been produced up to that point.
export async function interrupt() {
  try {
    await engine?.interruptGenerate?.();
  } catch {
    // Nothing useful to do if the interrupt itself fails.
  }
}

// Releases GPU memory. Offered in the interface because a multi-hundred-megabyte
// allocation is not something a user should have to close the tab to reclaim.
export async function unload() {
  try {
    await engine?.unload?.();
  } catch {
    // Ignore — the reference is dropped regardless.
  }
  engine = null;
  engineModel = null;
}

// Forgets the consent and model choice. The weights stay in Cache Storage;
// clearing those is the browser's own site-data control, and saying so is more
// honest than a button that half-works.
export async function forget() {
  await unload();
  try {
    await AsyncStorage.multiRemove([CHOICE_KEY, CONSENT_KEY]);
  } catch {
    // Nothing further to do.
  }
}

export function modelInfo(modelId) {
  return MODELS.find((m) => m.id === modelId) || MODELS[0];
}
