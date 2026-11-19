import { useState, useEffect, useRef } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import popLogoUrl from "./assets/pop.svg";
import "./styles.css";

// Preview-only tool: nothing is persisted. Refreshing the page clears everything.

const SCREEN_TYPES = [
  "Onboarding", "Payment flow", "Error / failure", "Confirmation",
  "Notification", "Empty state", "Settings / label", "Other",
];
const FEELINGS = [
  "Focused / neutral", "Anxious / waiting", "Frustrated / worried", "Curious / exploring", "Other",
];

/* ------------------------------------------------------------------ */
/*  Gemini call — proxied through /api/gemini to protect the API key  */
/* ------------------------------------------------------------------ */
const PRINCIPLES = `You are an expert UX writer for the Pop UPI payments app, trained on Google Material Design UX-writing principles. This is version one: FUNCTIONAL copy only — clear, concise, useful. No brand voice, no personality where money or risk is involved.
Principles you must follow:
- Be concise but not robotic; every word earns its place.
- Write simply and directly; prefer the easier phrasing.
- Address the user with "you/your"; never mix "you/your" with "I/my" in one phrase.
- Communicate only the essential details for this moment.
- Use accurate, consistent terminology; never drift between synonyms.
- Present tense; no jargon; use numerals for numbers.
- Frontload the most important words (people scan in an F-pattern).
- CTAs must mirror what the user wants to do next — never "OK", "Submit", or "Done".
- Begin with the user's objective, then the action.
- State the consequence of any irreversible action UP FRONT.
Tone: classify the screen on two axes — serious(0)..fun(100) and concise(0)..detailed(100). Money or risk on screen -> stay serious. Comprehension-critical -> detailed enough even at the cost of brevity. A tone may shift within its quadrant but must never cross into another.`;

async function callAI(system, userContent) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, userContent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "API error");
  return data.text || "";
}

function parseJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e >= 0) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

const fmtVariant = (v) => [v.title, v.body, v.primary, v.secondary].filter(Boolean).join("\n");
const optionLabel = (v, i) => v.label || `Option ${String.fromCharCode(65 + i)}`;

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
export default function App() {
  const [mode, setMode] = useState("generate");

  const [gType, setGType] = useState("");
  const [gTypeOther, setGTypeOther] = useState("");
  const [gGoal, setGGoal] = useState("");
  const [gFeel, setGFeel] = useState("");
  const [gFeelOther, setGFeelOther] = useState("");
  const [gNext, setGNext] = useState("");
  const [gConstraint, setGConstraint] = useState("");
  const [gIrrev, setGIrrev] = useState(false);

  const [rDraft, setRDraft] = useState("");
  const [rType, setRType] = useState("");
  const [rTypeOther, setRTypeOther] = useState("");
  const [rFeel, setRFeel] = useState("");
  const [rFeelOther, setRFeelOther] = useState("");
  const [rContext, setRContext] = useState("");

  const [out, setOut] = useState(null);
  const [view, setView] = useState(0); // variant index | "all" | "final" | "issues"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ranWith, setRanWith] = useState(null); // generate inputs the current result came from
  const outputRef = useRef(null);

  const genInputs = JSON.stringify([gType, gTypeOther, gGoal, gFeel, gFeelOther, gNext, gConstraint, gIrrev]);
  const isGen = mode === "generate";
  const canGenerate = gType && (gType !== "Other" || gTypeOther) && gGoal;
  const canReview = rDraft.trim().length > 4;
  const canRun = isGen ? canGenerate : canReview;
  const sameInputs = isGen && out?.kind === "generate" && ranWith === genInputs;

  // When the columns stack (narrow screens), bring the result into view.
  useEffect(() => {
    if (out && window.innerWidth < 1100) outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [out]);

  const switchMode = (m) => {
    if (m === mode || loading) return;
    setMode(m); setOut(null); setErr("");
  };

  const run = async (user, kind, onOk) => {
    setLoading(true); setErr(""); setOut(null);
    try {
      const data = parseJSON(await callAI(PRINCIPLES, user));
      setOut({ kind, ...data });
      setView(kind === "review" ? "final" : 0);
      onOk?.();
    } catch (e) {
      setErr(e instanceof SyntaxError
        ? "The response came back in an unexpected format. Try again."
        : e.message || "Couldn't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  };

  const runGenerate = (variation = false) => {
    const type = gType === "Other" ? gTypeOther : gType;
    const feel = gFeel === "Other" ? gFeelOther : gFeel;
    const user = `Write in-app copy for this screen.

Screen / moment: ${type || "(unspecified — classify it)"}
What the user is trying to do: ${gGoal || "(unspecified)"}
What the user likely feels here: ${feel || "(unspecified)"}
What they need to know or do next: ${gNext || "(unspecified)"}
Hard constraints: ${gConstraint || "none"}
Involves an irreversible action (money moves / data lost): ${gIrrev ? "YES — state the consequence up front" : "no"}
${variation ? "\nThese must be genuinely DIFFERENT options — vary the angle, structure, and wording from a typical first attempt." : ""}
Return STRICT JSON only, no prose:
{"tone":{"serious_fun":0-100,"concise_detailed":0-100,"label":"e.g. Serious + concise"},
"variants":[{"label":"Option A","title":"","body":"","primary":"","secondary":""}],
"rationale":"2 short sentences on the key decisions"}
Give 2 variants max. Keep every field tight.`;
    const snapshot = genInputs;
    run(user, "generate", () => setRanWith(snapshot));
  };

  const runReview = () => {
    const type = rType === "Other" ? rTypeOther : rType;
    const feel = rFeel === "Other" ? rFeelOther : rFeel;
    const user = `Audit and rewrite this in-app copy.

Existing copy:
"""${rDraft}"""
Screen / moment: ${type || "(infer it)"}
What the user likely feels here: ${feel || "(unspecified)"}
Extra context: ${rContext || "none"}

Check against the principles. Return STRICT JSON only:
{"tone":{"serious_fun":0-100,"concise_detailed":0-100,"label":""},
"issues":[{"line":"quoted problem text","principle":"the rule it breaks","why":"why it matters here","rewrite":"fixed line"}],
"final":"the full corrected copy, use \\n between lines"}
Keep issues to the 4 most important. Be concise.`;
    run(user, "review");
  };

  const primaryAction = () => (isGen ? runGenerate(sameInputs) : runReview());

  const onEnterSubmit = (e) => {
    if (e.key !== "Enter" || loading || !canRun) return;
    e.preventDefault();
    primaryAction();
  };

  const hasOut = !!out && !loading;
  const variants = out?.kind === "generate" ? out.variants || [] : [];
  const issues = out?.kind === "review" ? out.issues || [] : [];
  const genView = view === "all" || (typeof view === "number" && view < variants.length) ? view : 0;
  const revView = view === "issues" ? "issues" : "final";

  return (
    <main className="ct">
      <header className="ct-top">
        <a href="/" className="ct-logo" aria-label="Pop tools home">
          <img src={popLogoUrl} alt="" />
        </a>
      </header>

      <div className="ct-body">
        {/* ---------------- LEFT · inputs ---------------- */}
        <aside className="ct-side cw-inputs" aria-label="Inputs">
          <div className="ct-side-head">
            <span className="ct-panel-label">Input</span>
            <div className="ct-view-tabs" role="tablist" aria-label="Mode">
              {["generate", "review"].map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m}
                  className={`ct-view-tab${mode === m ? " is-on" : ""}`} onClick={() => switchMode(m)}>
                  {m === "generate" ? "Generate" : "Review"}
                </button>
              ))}
            </div>
          </div>

          <div className="cw-form">
            {isGen ? (
              <>
                <Field n="01" label="What screen or moment is this?">
                  <Chips options={SCREEN_TYPES} value={gType} onChange={setGType} />
                  {gType === "Other" && (
                    <input className="cw-input" value={gTypeOther} onChange={(e) => setGTypeOther(e.target.value)}
                      onKeyDown={onEnterSubmit} placeholder="Describe the screen" />
                  )}
                </Field>
                <Field n="02" label="What is the user trying to do here?">
                  <input className="cw-input" value={gGoal} onChange={(e) => setGGoal(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. send ₹500 to a contact" />
                </Field>
                <Field n="03" label="What is the user likely feeling?">
                  <Chips options={FEELINGS} value={gFeel} onChange={setGFeel} />
                  {gFeel === "Other" && (
                    <input className="cw-input" value={gFeelOther} onChange={(e) => setGFeelOther(e.target.value)} onKeyDown={onEnterSubmit}
                      placeholder="Describe their feeling or intent" />
                  )}
                </Field>
                <Field n="04" label="What do they need to know or do next?">
                  <input className="cw-input" value={gNext} onChange={(e) => setGNext(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. enter UPI PIN to confirm" />
                </Field>
                <Field n="05" label="Any hard constraints?" optional>
                  <input className="cw-input" value={gConstraint} onChange={(e) => setGConstraint(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. button label ≤ 20 chars" />
                </Field>
                <Field n="06" label="Irreversible action involved?">
                  <div className="cw-switch-row">
                    <button type="button" className={`cw-switch${gIrrev ? " is-on" : ""}`} onClick={() => setGIrrev((v) => !v)}
                      aria-pressed={gIrrev} aria-label="Irreversible action involved" />
                    {gIrrev ? "Yes — money moves or data is lost" : "No"}
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field n="01" label="Paste the copy you want reviewed">
                  <textarea className="cw-input" value={rDraft} onChange={(e) => setRDraft(e.target.value)} rows={6}
                    placeholder="Paste the current screen copy here…" />
                </Field>
                <Field n="02" label="What screen or moment is this?" optional>
                  <Chips options={SCREEN_TYPES} value={rType} onChange={setRType} />
                  {rType === "Other" && (
                    <input className="cw-input" value={rTypeOther} onChange={(e) => setRTypeOther(e.target.value)}
                      onKeyDown={onEnterSubmit} placeholder="Describe the screen" />
                  )}
                </Field>
                <Field n="03" label="What is the user likely feeling?" optional>
                  <Chips options={FEELINGS} value={rFeel} onChange={setRFeel} />
                  {rFeel === "Other" && (
                    <input className="cw-input" value={rFeelOther} onChange={(e) => setRFeelOther(e.target.value)} onKeyDown={onEnterSubmit}
                      placeholder="Describe their feeling or intent" />
                  )}
                </Field>
                <Field n="04" label="Anything else I should know?" optional>
                  <input className="cw-input" value={rContext} onChange={(e) => setRContext(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. shown after 3 failed attempts" />
                </Field>
              </>
            )}
          </div>

          <div className="cw-side-foot">
            <button type="button" className="cw-btn is-big is-primary is-block" disabled={loading || !canRun} onClick={primaryAction}>
              {loading && <Loader2 className="spin" size={16} />}
              {loading ? (isGen ? "Writing…" : "Reviewing…")
                : isGen ? (sameInputs ? "Try different options" : "Write the copy")
                : "Review my copy"}
            </button>
          </div>
        </aside>

        {/* ---------------- CENTER · output ---------------- */}
        <section className="ct-stage" ref={outputRef} aria-label="Output">
          <div className="ct-stage-head">
            <div className="ct-title">UX Copy Writer</div>
          </div>

          <div className="ct-stage-body">
            <div className="cw-canvas" role="status" aria-live="polite">
              {loading && (
                <p className="cw-state"><Loader2 className="spin" size={16} /> {isGen ? "Writing the copy…" : "Reviewing the copy…"}</p>
              )}

              {err && !loading && (
                <div className="cw-state is-error">
                  <p>{err}</p>
                  <button type="button" className="cw-btn" onClick={primaryAction} disabled={!canRun}>Try again</button>
                </div>
              )}

              {!out && !loading && !err && (
                <p className="cw-state">{isGen ? "Your screen copy will appear here." : "The reviewed copy will appear here."}</p>
              )}

              {hasOut && out.kind === "generate" && (
                <div className={`cw-cards${genView === "all" && variants.length > 1 ? " is-pair" : ""}`}>
                  {variants.map((v, i) => (genView === "all" || genView === i) && (
                    <article key={i} className="cw-card">
                      <header className="cw-card-head">
                        <span className="ct-panel-label">{optionLabel(v, i)}</span>
                        <CopyButton text={fmtVariant(v)} />
                      </header>
                      {v.title && <h2 className="cw-preview-title">{v.title}</h2>}
                      {v.body && <p className="cw-preview-body">{v.body}</p>}
                      {(v.primary || v.secondary) && (
                        <div className="cw-preview-ctas">
                          {v.primary && <span className="cw-preview-btn">{v.primary}</span>}
                          {v.secondary && <span className="cw-preview-btn is-secondary">{v.secondary}</span>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {hasOut && out.kind === "review" && revView === "final" && out.final && (
                <div className="cw-cards">
                  <article className="cw-card">
                    <header className="cw-card-head">
                      <span className="ct-panel-label">Final copy</span>
                      <CopyButton text={out.final} />
                    </header>
                    <p className="cw-final">{out.final}</p>
                  </article>
                </div>
              )}

              {hasOut && out.kind === "review" && revView === "issues" && (
                <div className="cw-issues">
                  {issues.length === 0 && <p className="cw-state">No issues found.</p>}
                  {issues.map((it, i) => (
                    <article key={i} className="cw-issue">
                      <h3 className="cw-issue-head">{it.principle}</h3>
                      <Line label="Now" text={it.line} kind="now" />
                      <p className="cw-issue-why">{it.why}</p>
                      <Line label="Better" text={it.rewrite} kind="good" />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- RIGHT · output options ---------------- */}
        <aside className="ct-side ct-output" aria-label="Output options">
          <div className="ct-side-head">
            <span className="ct-panel-label">Output</span>
          </div>
          <div className="cw-out-body">
            {!hasOut ? (
              <p className="cw-out-empty">Options for the result show up here.</p>
            ) : (
              <>
                <div className="cw-out-section">
                  <span className="cw-out-label">View</span>
                  <div className="ct-output-tabs" role="tablist" aria-label="Output view">
                    {out.kind === "generate" ? (
                      <>
                        {variants.map((v, i) => (
                          <Tab key={i} on={genView === i} onClick={() => setView(i)}>{optionLabel(v, i)}</Tab>
                        ))}
                        {variants.length > 1 && <Tab on={genView === "all"} onClick={() => setView("all")}>Side by side</Tab>}
                      </>
                    ) : (
                      <>
                        <Tab on={revView === "final"} onClick={() => setView("final")}>Final copy</Tab>
                        <Tab on={revView === "issues"} onClick={() => setView("issues")}>
                          Issues <span className="ct-tab-n">{issues.length}</span>
                        </Tab>
                      </>
                    )}
                  </div>
                </div>

                {out.tone && (
                  <div className="cw-out-section">
                    <span className="cw-out-label">Tone</span>
                    <ToneMap tone={out.tone} />
                  </div>
                )}

                {out.kind === "generate" && out.rationale && (
                  <div className="cw-out-section">
                    <span className="cw-out-label">Why this copy</span>
                    <p className="cw-why">{out.rationale}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */
function Field({ n, label, optional, children }) {
  return (
    <div>
      <div className="cw-field-head">
        <span className="cw-field-n">{n}</span>
        <label className="cw-field-label">
          {label}{optional && <span className="cw-field-opt"> · optional</span>}
        </label>
      </div>
      {children}
    </div>
  );
}
function Chips({ options, value, onChange }) {
  return (
    <div className="cw-chips">
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} type="button" aria-pressed={on} className={`cw-chip${on ? " is-on" : ""}`} onClick={() => onChange(on ? "" : o)}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
function Tab({ on, onClick, children }) {
  return (
    <button type="button" role="tab" aria-selected={on} className={`ct-tab${on ? " is-on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" className="cw-btn is-quiet" onClick={copy}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copied" : "Copy"}
    </button>
  );
}
function ToneMap({ tone }) {
  const x = Math.max(0, Math.min(100, tone.concise_detailed ?? 0));
  const y = Math.max(0, Math.min(100, tone.serious_fun ?? 0));
  const px = 10 + (x / 100) * 80;
  const py = 90 - (y / 100) * 80;
  return (
    <div className="cw-tone">
      <svg width="100" height="100" style={{ flex: "none" }} aria-hidden="true">
        <rect x="10" y="10" width="80" height="80" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.09)" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,0.07)" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(255,255,255,0.07)" />
        <circle cx={px} cy={py} r="5.5" fill="#3d6fe0" />
      </svg>
      <div>
        <div className="cw-tone-label">{tone.label}</div>
        <div className="cw-tone-axes">
          <div>↑ fun · serious ↓</div>
          <div>← concise · detailed →</div>
        </div>
      </div>
    </div>
  );
}
function Line({ label, text, kind }) {
  return (
    <div className={`cw-line is-${kind}`}>
      <span className="cw-line-tag">{label}</span>
      <span className="cw-line-text">{text}</span>
    </div>
  );
}
