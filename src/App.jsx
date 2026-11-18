import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, BookText, Copy, RefreshCw, Save, Check, X, ChevronDown, ChevronLeft, ChevronRight,
  Sparkles, Trash2, AlertTriangle, ArrowRight, FileText, Loader2,
  ArchiveRestore, RotateCcw
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Theme — Figtree everywhere, paper canvas, single violet accent.    */
/* ------------------------------------------------------------------ */
const T = {
  paper:   "#F6F5F1",
  surface: "#FFFFFF",
  ink:     "#1B1A17",
  muted:   "#6E6C66",
  faint:   "#767470",
  line:    "#E7E4DC",
  lineSoft:"#F0EEE8",
  accent:  "#5B45E0",
  accentInk:"#3826A6",
  accentSoft:"#EDEAFB",
  flag:    "#B43A2A",
  flagSoft:"#FAEDEA",
  good:    "#1E7A52",
  goodSoft:"#E7F3EC",
  font: "'Figtree', ui-sans-serif, system-ui, sans-serif",
};

const SCREEN_TYPES = [
  "Onboarding", "Payment flow", "Error / failure", "Confirmation",
  "Notification", "Empty state", "Settings / label", "Other",
];
const FEELINGS = [
  "Focused / neutral", "Anxious / waiting", "Frustrated / worried", "Curious / exploring", "Other",
];

/* ------------------------------------------------------------------ */
/*  Storage — uses localStorage instead of window.storage             */
/* ------------------------------------------------------------------ */
const sGet = async (k) => {
  try { return localStorage.getItem(k); }
  catch { return null; }
};
const sSet = async (k, v) => {
  try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); return true; }
  catch { return false; }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const timeAgo = (ts) => {
  if (!ts) return "new";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
  const mo = Math.floor(d / 30); if (mo < 12) return mo + "mo ago";
  return Math.floor(mo / 12) + "y ago";
};

/* ------------------------------------------------------------------ */
/*  Claude call — proxied through /api/claude to protect the API key  */
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

async function callClaude(system, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "API error");
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e >= 0) t = t.slice(s, e + 1);
  return JSON.parse(t);
}
const glossaryContext = (g) =>
  !g || !g.length ? "No locked terms yet."
  : g.map((t) => `- Always use "${t.term}"${t.replaces ? ` (not "${t.replaces}")` : ""}${t.note ? ` — ${t.note}` : ""}`).join("\n");

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
export default function App() {
  const [index, setIndex] = useState([]);
  const [project, setProject] = useState(null);
  const [ready, setReady] = useState(false);

  const [mode, setMode] = useState("generate");
  const [screenId, setScreenId] = useState(null);

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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [projMenu, setProjMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [inputsDirty, setInputsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const outputRef = useRef(null);
  const stripRef = useRef(null);

  const checkStripScroll = useCallback(() => {
    const el = stripRef.current; if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  const scrollStrip = (dir) => {
    const el = stripRef.current; if (!el) return;
    el.scrollBy({ left: dir * 180, behavior: "smooth" });
    setTimeout(checkStripScroll, 300);
  };

  useEffect(() => { setTimeout(checkStripScroll, 100); }, [project?.screens?.length, checkStripScroll]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };
  const skipDirty = useRef(false);

  useEffect(() => {
    if (!out) return;
    if (skipDirty.current) { skipDirty.current = false; return; }
    setInputsDirty(true); setIsSaved(false);
  }, [gType, gTypeOther, gGoal, gFeel, gFeelOther, gNext, gConstraint, gIrrev, rDraft, rType, rTypeOther, rFeel, rFeelOther, rContext]);

  useEffect(() => { if (out) setIsSaved(false); }, [saveName]);

  useEffect(() => {
    if (out && !loading && typeof window !== "undefined" && window.innerWidth < 768) {
      outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [out, loading]);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent =
      "button:focus-visible,input:focus-visible,textarea:focus-visible,[role=button]:focus-visible{outline:2px solid #5B45E0;outline-offset:2px;border-radius:8px;}" +
      "button,[role=button],input,textarea,a{touch-action:manipulation;-webkit-tap-highlight-color:rgba(91,69,224,0.12);}" +
      ".pop-tabstrip{-webkit-overflow-scrolling:touch;scrollbar-width:none;}" +
      ".pop-tabstrip::-webkit-scrollbar{display:none;}" +
      ".pop-cta-pair{display:flex;flex-direction:row;gap:12px;justify-content:center;}" +
      ".pop-cta-pair>button{flex:0 0 auto;}" +
      "@media(max-width:767px){.pop-cta-pair{flex-direction:column-reverse;align-items:stretch;}}" +
      "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}" +
      ".spin{animation:spin 1s linear infinite;}";
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!projMenu) return;
    const onKey = (e) => { if (e.key === "Escape") { setProjMenu(false); setCreating(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projMenu]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  const applyScreen = useCallback((s) => {
    skipDirty.current = true;
    setScreenId(s.id); setMode(s.mode); setOut(s.out); setSaveName(s.name); setErr("");
    setInputsDirty(false); setIsSaved(true);
    const i = s.inputs || {};
    if (s.mode === "generate") {
      setGType(i.gType || ""); setGTypeOther(i.gTypeOther || ""); setGGoal(i.gGoal || "");
      setGFeel(i.gFeel || ""); setGFeelOther(i.gFeelOther || ""); setGNext(i.gNext || "");
      setGConstraint(i.gConstraint || ""); setGIrrev(!!i.gIrrev);
    } else {
      setRDraft(i.rDraft || ""); setRType(i.rType || ""); setRTypeOther(i.rTypeOther || "");
      setRFeel(i.rFeel || ""); setRFeelOther(i.rFeelOther || ""); setRContext(i.rContext || "");
    }
  }, []);
  const loadScreen = applyScreen;

  const resetWorkspace = useCallback(() => {
    setScreenId(null); setOut(null); setErr(""); setSaveName("");
    setInputsDirty(false); setIsSaved(false);
    setGType(""); setGTypeOther(""); setGGoal(""); setGFeel(""); setGFeelOther("");
    setGNext(""); setGConstraint(""); setGIrrev(false);
    setRDraft(""); setRType(""); setRTypeOther(""); setRFeel(""); setRFeelOther(""); setRContext("");
  }, []);

  const persistProject = useCallback(async (p, bump = true) => {
    const stamped = bump ? { ...p, lastEdited: Date.now() } : p;
    setProject(stamped);
    await sSet("pop:proj:" + stamped.id, stamped);
    setIndex((prev) => {
      const next = prev
        .map((e) => e.id === stamped.id ? { ...e, name: stamped.name, lastEdited: stamped.lastEdited } : e)
        .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
      sSet("pop:index", next);
      return next;
    });
  }, []);

  const openProject = useCallback((p) => {
    const fifteenDays = 15 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const purged = { ...p, trash: (p.trash || []).filter((s) => now - (s.trashedAt || 0) < fifteenDays) };
    setProject(purged);
    if (purged.screens && purged.screens.length) applyScreen(purged.screens[0]);
    else resetWorkspace();
  }, [applyScreen, resetWorkspace]);

  useEffect(() => { (async () => {
    let idx = JSON.parse((await sGet("pop:index")) || "null");
    if (!idx || !idx.length) {
      const now = Date.now();
      const p = { id: uid(), name: "My Pop project", glossary: [], screens: [], createdAt: now, lastEdited: now };
      idx = [{ id: p.id, name: p.name, createdAt: now, lastEdited: now }];
      await sSet("pop:index", idx); await sSet("pop:proj:" + p.id, p);
      setIndex(idx); setProject(p); resetWorkspace(); setReady(true); return;
    }
    idx = idx.map((e) => ({ ...e, lastEdited: e.lastEdited || 0, createdAt: e.createdAt || 0 }))
             .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
    setIndex(idx);
    const p = JSON.parse((await sGet("pop:proj:" + idx[0].id)) || "null")
              || { id: idx[0].id, name: idx[0].name, glossary: [], screens: [] };
    openProject(p);
    setReady(true);
  })(); }, [openProject, resetWorkspace]);

  const switchProject = async (id) => {
    setProjMenu(false); setCreating(false);
    const p = JSON.parse((await sGet("pop:proj:" + id)) || "null");
    if (p) openProject(p);
  };
  const createProject = async () => {
    const name = newName.trim(); if (!name) return;
    const now = Date.now();
    const p = { id: uid(), name, glossary: [], screens: [], createdAt: now, lastEdited: now };
    setIndex((prev) => {
      const next = [{ id: p.id, name, createdAt: now, lastEdited: now }, ...prev]
        .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
      sSet("pop:index", next);
      return next;
    });
    await sSet("pop:proj:" + p.id, p);
    setProject(p); resetWorkspace();
    setNewName(""); setCreating(false); setProjMenu(false);
  };

  const runGenerate = async (variation = false) => {
    setLoading(true); setErr(""); setOut(null); setLastRun("generate");
    const type = gType === "Other" ? gTypeOther : gType;
    const feel = gFeel === "Other" ? gFeelOther : gFeel;
    const user = `Write in-app copy for this screen.
Locked terminology:
${glossaryContext(project.glossary)}

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
    let text;
    try { text = await callClaude(PRINCIPLES, user); }
    catch { setErr("Couldn't reach the server — check your connection and try again."); setLoading(false); return; }
    try {
      const data = parseJSON(text);
      setOut({ kind: "generate", ...data });
      setSaveName(type || "Untitled screen");
      setInputsDirty(false); setIsSaved(false);
    } catch { setErr("The response came back in an unexpected format — try again, or simplify your inputs if it keeps happening."); }
    setLoading(false);
  };

  const runReview = async () => {
    setLoading(true); setErr(""); setOut(null); setLastRun("review");
    const type = rType === "Other" ? rTypeOther : rType;
    const feel = rFeel === "Other" ? rFeelOther : rFeel;
    const user = `Audit and rewrite this in-app copy.
Locked terminology:
${glossaryContext(project.glossary)}

Existing copy:
"""${rDraft}"""
Screen / moment: ${type || "(infer it)"}
What the user likely feels here: ${feel || "(unspecified)"}
Extra context: ${rContext || "none"}

Check against the principles AND the locked terminology. Return STRICT JSON only:
{"tone":{"serious_fun":0-100,"concise_detailed":0-100,"label":""},
"issues":[{"line":"quoted problem text","principle":"the rule it breaks","why":"why it matters here","rewrite":"fixed line"}],
"final":"the full corrected copy, use \\n between lines"}
Keep issues to the 4 most important. Be concise.`;
    let text;
    try { text = await callClaude(PRINCIPLES, user); }
    catch { setErr("Couldn't reach the server — check your connection and try again."); setLoading(false); return; }
    try {
      const data = parseJSON(text);
      setOut({ kind: "review", ...data });
      setSaveName(type || "Reviewed screen");
      setInputsDirty(false); setIsSaved(false);
    } catch { setErr("The response came back in an unexpected format — try again, or simplify your inputs if it keeps happening."); }
    setLoading(false);
  };

  const retryLast = () => { if (lastRun === "review") runReview(); else runGenerate(); };

  const onEnterSubmit = (e) => {
    if (e.key !== "Enter" || loading) return;
    e.preventDefault();
    if (mode === "generate" && canGenerate) runGenerate(false);
    else if (mode === "review" && canReview) runReview();
  };

  const canGenerate = gType && (gType !== "Other" || gTypeOther) && gGoal;
  const canReview = rDraft.trim().length > 4;

  const saveScreen = async () => {
    if (!out) return;
    const name = (saveName || "Untitled").slice(0, 40);
    const newId = uid();
    const snap = {
      id: newId, name, mode, savedAt: Date.now(),
      inputs: mode === "generate"
        ? { gType, gTypeOther, gGoal, gFeel, gFeelOther, gNext, gConstraint, gIrrev }
        : { rDraft, rType, rTypeOther, rFeel, rFeelOther, rContext },
      out,
    };
    const screens = [snap, ...project.screens];
    await persistProject({ ...project, screens });
    setScreenId(newId);
    setIsSaved(true);
    flash("Saved to project");
  };
  const deleteScreen = async (id, e) => {
    e.stopPropagation();
    const target = project.screens.find((s) => s.id === id);
    if (target) setConfirmDelete(target);
  };
  const confirmDeleteScreen = async () => {
    if (!confirmDelete) return;
    const trashed = { ...confirmDelete, trashedAt: Date.now() };
    const screens = project.screens.filter((s) => s.id !== confirmDelete.id);
    const trash = [trashed, ...(project.trash || [])];
    await persistProject({ ...project, screens, trash });
    if (screenId === confirmDelete.id) resetWorkspace();
    setConfirmDelete(null);
    flash("Moved to trash");
  };
  const restoreScreen = async (id) => {
    const item = (project.trash || []).find((s) => s.id === id);
    if (!item) return;
    const { trashedAt, ...restored } = item;
    const screens = [restored, ...project.screens];
    const trash = (project.trash || []).filter((s) => s.id !== id);
    await persistProject({ ...project, screens, trash });
    flash("Restored");
  };
  const permanentDeleteScreen = async (id) => {
    await persistProject({ ...project, trash: (project.trash || []).filter((s) => s.id !== id) });
  };
  const emptyTrash = async () => {
    await persistProject({ ...project, trash: [] });
  };

  const requestNewScreen = () => {
    if (out && screenId === null) setConfirmNew(true);
    else resetWorkspace();
  };

  const requestModeSwitch = (m) => {
    if (m === mode) return;
    setMode(m);
  };

  if (!ready) {
    return (
      <div style={{ fontFamily: T.font, background: T.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
        <Loader2 className="spin" size={20} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: T.font, background: T.paper, color: T.ink, minHeight: "100vh" }}>
      <header style={{ borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontWeight: 700, letterSpacing: "-0.02em", fontSize: 18 }}>Pop</span>
            <span style={{ width: 4, height: 4, borderRadius: 9, background: T.accent, transform: "translateY(-3px)" }} />
            <span style={{ fontWeight: 500, fontSize: 14, color: T.muted }}>UX Copy</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => { setProjMenu((v) => !v); setCreating(false); }}
                aria-haspopup="true" aria-expanded={projMenu} style={pill()}>
                <FileText size={14} /> {project.name} <ChevronDown size={14} />
              </button>
              {projMenu && (
                <>
                  <div onClick={() => { setProjMenu(false); setCreating(false); }}
                    style={{ position: "fixed", inset: 0, zIndex: 29 }} />
                  <div role="menu" style={{ position: "absolute", top: 42, right: 0, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.08)", padding: 6, minWidth: 250, zIndex: 30 }}>
                    {index.map((p) => (
                      <button key={p.id} onClick={() => switchProject(p.id)} style={menuItem}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
                          <span style={{ fontWeight: p.id === project.id ? 600 : 500 }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: T.faint }}>edited {timeAgo(p.lastEdited)}</span>
                        </span>
                        {p.id === project.id && <Check size={14} color={T.accent} />}
                      </button>
                    ))}
                    <div style={{ height: 1, background: T.lineSoft, margin: "6px 4px" }} />
                    {creating ? (
                      <div style={{ display: "flex", gap: 6, padding: 4 }}>
                        <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") createProject(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                          placeholder="Project name" style={{ ...input, padding: "7px 9px", fontSize: 13 }} />
                        <button onClick={createProject}
                          style={{ ...cta(!newName.trim()), padding: "7px 13px", fontSize: 13, boxShadow: "none" }}>Create</button>
                      </div>
                    ) : (
                      <button onClick={() => setCreating(true)} style={menuItem}><Plus size={14} /> New project</button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setGlossaryOpen(true)} style={pill()}>
              <BookText size={14} /> Glossary
              {project.glossary.length > 0 && <span style={countDot}>{project.glossary.length}</span>}
            </button>
            <button onClick={() => setTrashOpen(true)} style={pill()}>
              <Trash2 size={14} /> Trash
              {(project.trash || []).length > 0 && <span style={countDot}>{(project.trash || []).length}</span>}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 22px 12px", display: "flex", gap: 0, alignItems: "center" }}>
          <button onClick={requestNewScreen} style={{ ...tab(screenId === null), gap: 6, flexShrink: 0, marginRight: 8, boxSizing: "border-box", height: 32 }}>
            <Plus size={13} /> New screen
          </button>
          {project.screens.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: 4 }}>
              {canScrollLeft && (
                <button onClick={() => scrollStrip(-1)} aria-label="Scroll tabs left"
                  style={{ ...arrowBtn, flexShrink: 0 }}><ChevronLeft size={14} /></button>
              )}
              <div ref={stripRef} className="pop-tabstrip" onScroll={checkStripScroll}
                style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", flex: 1, minWidth: 0 }}>
                {project.screens.map((s) => (
                  <div key={s.id} style={{ ...tab(screenId === s.id), flexShrink: 0, cursor: "default", display: "inline-flex", alignItems: "center", gap: 7, boxSizing: "border-box", height: 32 }}>
                    <button onClick={() => loadScreen(s)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: 0, margin: 0, cursor: "pointer", fontFamily: T.font, fontSize: 12.5, fontWeight: screenId === s.id ? 600 : 400, color: "inherit", lineHeight: 1 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 9, background: s.mode === "review" ? T.flag : T.accent }} />
                      {s.name}
                    </button>
                    <button onClick={(e) => deleteScreen(s.id, e)} aria-label={`Delete ${s.name}`}
                      style={{ border: "none", background: "transparent", padding: 0, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", color: "inherit", opacity: .5 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {canScrollRight && (
                <button onClick={() => scrollStrip(1)} aria-label="Scroll tabs right"
                  style={{ ...arrowBtn, flexShrink: 0 }}><ChevronRight size={14} /></button>
              )}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 22px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, alignItems: "stretch" }}>
          <section style={panel}>
            <div style={{ display: "inline-flex", padding: 3, background: T.paper, borderRadius: 10, gap: 3, marginBottom: 20 }}>
              {["generate", "review"].map((m) => (
                <button key={m} onClick={() => requestModeSwitch(m)} style={toggle(mode === m)}>
                  {m === "generate" ? "Generate" : "Review"}
                </button>
              ))}
            </div>

            {mode === "generate" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Field n="01" label="What screen or moment is this?">
                  <Chips options={SCREEN_TYPES} value={gType} onChange={setGType} />
                  {gType === "Other" && (
                    <input value={gTypeOther} onChange={(e) => setGTypeOther(e.target.value)}
                      placeholder="Describe the screen" style={{ ...input, marginTop: 8 }} />
                  )}
                </Field>
                <Field n="02" label="What is the user trying to do here?">
                  <input value={gGoal} onChange={(e) => setGGoal(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. send ₹500 to a contact" style={input} />
                </Field>
                <Field n="03" label="What is the user likely feeling?">
                  <Chips options={FEELINGS} value={gFeel} onChange={setGFeel} />
                  {gFeel === "Other" && (
                    <input value={gFeelOther} onChange={(e) => setGFeelOther(e.target.value)} onKeyDown={onEnterSubmit}
                      placeholder="Describe their feeling or intent" style={{ ...input, marginTop: 8 }} />
                  )}
                </Field>
                <Field n="04" label="What do they need to know or do next?">
                  <input value={gNext} onChange={(e) => setGNext(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. enter UPI PIN to confirm" style={input} />
                </Field>
                <Field n="05" label="Any hard constraints? (optional)">
                  <input value={gConstraint} onChange={(e) => setGConstraint(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. button label ≤ 20 chars" style={input} />
                </Field>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 9 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: ".04em" }}>06</span>
                    <label style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>Irreversible action involved?</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setGIrrev((v) => !v)} aria-pressed={gIrrev} aria-label="Irreversible action involved"
                      style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", padding: 0, cursor: "pointer", background: gIrrev ? T.accent : T.line, transition: "background .2s", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: gIrrev ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.18)", transition: "left .2s" }} />
                    </button>
                    <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
                      {gIrrev ? "Yes — money moves or data is lost" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Field n="01" label="Paste the copy you want reviewed">
                  <textarea value={rDraft} onChange={(e) => setRDraft(e.target.value)} rows={5}
                    placeholder="Paste the current screen copy here…" style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
                </Field>
                <Field n="02" label="What screen or moment is this? (optional)">
                  <Chips options={SCREEN_TYPES} value={rType} onChange={setRType} />
                  {rType === "Other" && (
                    <input value={rTypeOther} onChange={(e) => setRTypeOther(e.target.value)}
                      placeholder="Describe the screen" style={{ ...input, marginTop: 8 }} />
                  )}
                </Field>
                <Field n="03" label="What is the user likely feeling? (optional)">
                  <Chips options={FEELINGS} value={rFeel} onChange={setRFeel} />
                  {rFeel === "Other" && (
                    <input value={rFeelOther} onChange={(e) => setRFeelOther(e.target.value)}
                      placeholder="Describe their feeling or intent" style={{ ...input, marginTop: 8 }} />
                  )}
                </Field>
                <Field n="04" label="Anything else I should know? (optional)">
                  <input value={rContext} onChange={(e) => setRContext(e.target.value)} onKeyDown={onEnterSubmit}
                    placeholder="e.g. shown after 3 failed attempts" style={input} />
                </Field>
              </div>
            )}
          </section>

          <section ref={outputRef} style={{ ...panel, display: "flex", flexDirection: "column", minHeight: 320 }}>
            {!out && !loading && !err && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Empty mode={mode} /></div>}
            <div role="status" aria-live="polite" style={{ flex: loading || err ? 1 : undefined, display: "flex", flexDirection: "column", alignItems: loading || err ? "center" : undefined, justifyContent: loading || err ? "center" : undefined }}>
              {loading && (
                <div style={center}>
                  <Loader2 className="spin" size={22} color={T.accent} />
                  <p style={{ color: T.muted, fontSize: 13, marginTop: 12 }}>
                    {mode === "generate" ? "Writing the copy…" : "Auditing the copy…"}
                  </p>
                </div>
              )}
              {err && !loading && (
                <div style={center}>
                  <AlertTriangle size={20} color={T.flag} />
                  <p style={{ color: T.flag, fontSize: 13, marginTop: 10, maxWidth: 260, lineHeight: 1.5 }}>{err}</p>
                  <button onClick={retryLast} style={{ ...ghostBtn, marginTop: 14 }}><RefreshCw size={13} /> Try again</button>
                </div>
              )}
            </div>

            {out && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {out.tone && <ToneMap tone={out.tone} />}

                {out.kind === "generate" && (
                  <>
                    {(out.variants || []).map((v, i) => (
                      <VariantCard key={i} v={v}
                        onChange={(nv) => setOut({ ...out, variants: out.variants.map((x, j) => j === i ? nv : x) })}
                        onCopy={() => { navigator.clipboard.writeText(fmtVariant(v)); flash("Copied"); }} />
                    ))}
                    {out.rationale && (
                      <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 14 }}>
                        <span style={{ color: T.accentInk, fontWeight: 600 }}>Why: </span>{out.rationale}
                      </p>
                    )}
                  </>
                )}

                {out.kind === "review" && (
                  <>
                    {(out.issues || []).map((it, i) => (
                      <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: T.flagSoft, padding: "9px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                          <AlertTriangle size={13} color={T.flag} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.flag }}>{it.principle}</span>
                        </div>
                        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          <Line label="Now" text={it.line} strike />
                          <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>{it.why}</p>
                          <Line label="Better" text={it.rewrite} good />
                        </div>
                      </div>
                    ))}
                    {out.final && (
                      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.faint }}>Final copy</span>
                          <button onClick={() => { navigator.clipboard.writeText(out.final); flash("Copied"); }} style={ghostBtn}><Copy size={13} /> Copy</button>
                        </div>
                        <pre style={{ fontFamily: T.font, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{out.final}</pre>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${T.lineSoft}`, paddingTop: 14 }}>
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Name this screen" style={{ ...input, flex: 1, padding: "8px 11px" }} />
                  <button onClick={saveScreen} disabled={isSaved}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: T.font, fontSize: 12.5, fontWeight: 600, padding: "9px 14px", minHeight: 38, borderRadius: 10, border: "none", background: isSaved ? T.line : T.ink, color: isSaved ? T.faint : "#fff", cursor: isSaved ? "not-allowed" : "pointer", transition: "all .2s" }}>
                    {isSaved ? <Check size={13} /> : <Save size={13} />} {isSaved ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
          {out && !loading && !inputsDirty ? (
            <div className="pop-cta-pair">
              <button onClick={resetWorkspace}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontFamily: T.font, fontSize: 15, fontWeight: 600, padding: "13px 24px", borderRadius: 14, border: `1px solid ${T.line}`, background: T.surface, color: T.accentInk, cursor: "pointer", whiteSpace: "nowrap" }}>
                <RotateCcw size={16} /> Start fresh
              </button>
              <button onClick={() => (mode === "generate" ? runGenerate(true) : runReview())}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontFamily: T.font, fontSize: 15, fontWeight: 600, padding: "13px 24px", borderRadius: 14, border: "none", cursor: "pointer", background: T.accent, color: "#fff", whiteSpace: "nowrap" }}>
                <RefreshCw size={16} /> Try variations <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              disabled={loading || (mode === "generate" ? !canGenerate : !canReview)}
              onClick={() => (mode === "generate" ? runGenerate(false) : runReview())}
              style={cta(loading || (mode === "generate" ? !canGenerate : !canReview))}>
              {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              {mode === "generate" ? "Write the copy" : "Review my copy"}
              {!loading && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      </main>

      {glossaryOpen && (
        <GlossaryModal project={project} onClose={() => setGlossaryOpen(false)}
          onSave={(g) => persistProject({ ...project, glossary: g })} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff", padding: "9px 16px", borderRadius: 10, fontSize: 13, zIndex: 60, display: "flex", gap: 7, alignItems: "center" }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          body="This screen will be moved to trash. You can restore it within 15 days."
          confirmLabel="Move to trash"
          confirmColor={T.flag}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDeleteScreen}
        />
      )}

      {confirmNew && (
        <ConfirmDialog
          title="Discard unsaved copy?"
          body="This result hasn't been saved to the project. Starting a new screen will clear it."
          confirmLabel="Discard"
          confirmColor={T.flag}
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => { setConfirmNew(false); resetWorkspace(); }}
        />
      )}

      {trashOpen && (
        <TrashModal
          trash={project.trash || []}
          onClose={() => setTrashOpen(false)}
          onRestore={restoreScreen}
          onDelete={permanentDeleteScreen}
          onEmpty={emptyTrash}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */
function Field({ n, label, children }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: ".04em" }}>{n}</span>
        <label style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</label>
      </div>
      {children}
    </div>
  );
}
function Chips({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} onClick={() => onChange(on ? "" : o)}
            style={{
              fontFamily: T.font, fontSize: 12.5, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${on ? T.accent : T.line}`,
              background: on ? T.accentSoft : T.surface,
              color: on ? T.accentInk : T.muted, fontWeight: on ? 600 : 400, transition: "all .12s",
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
function ToneMap({ tone }) {
  const x = Math.max(0, Math.min(100, tone.concise_detailed ?? 0));
  const y = Math.max(0, Math.min(100, tone.serious_fun ?? 0));
  const px = 12 + (x / 100) * 96;
  const py = 108 - (y / 100) * 96;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", background: T.paper, borderRadius: 12, padding: 12 }}>
      <svg width="120" height="120" style={{ flexShrink: 0 }}>
        <rect x="12" y="12" width="96" height="96" rx="8" fill={T.surface} stroke={T.line} />
        <line x1="60" y1="12" x2="60" y2="108" stroke={T.lineSoft} />
        <line x1="12" y1="60" x2="108" y2="60" stroke={T.lineSoft} />
        <circle cx={px} cy={py} r="6" fill={T.accent} />
        <circle cx={px} cy={py} r="11" fill="none" stroke={T.accent} strokeOpacity=".3" />
      </svg>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{tone.label}</div>
        <div>← serious · fun →</div>
        <div>↓ concise · detailed ↑</div>
      </div>
    </div>
  );
}
function VariantCard({ v, onChange, onCopy }) {
  const [edit, setEdit] = useState(false);
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.faint }}>{v.label || "Option"}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setEdit((x) => !x)} style={ghostBtn}>{edit ? <Check size={13} /> : "Edit"}</button>
          <button onClick={onCopy} style={ghostBtn}><Copy size={13} /></button>
        </div>
      </div>
      {edit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {["title", "body", "primary", "secondary"].map((k) => (
            <input key={k} value={v[k] || ""} onChange={set(k)} placeholder={k} style={{ ...input, padding: "7px 10px", fontSize: 13 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {v.title && <div style={{ fontSize: 15, fontWeight: 600 }}>{v.title}</div>}
          {v.body && <div style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>{v.body}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {v.primary && <span style={btnPreview(true)}>{v.primary}</span>}
            {v.secondary && <span style={btnPreview(false)}>{v.secondary}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
function Line({ label, text, strike, good }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: good ? T.good : T.faint, paddingTop: 2, minWidth: 38 }}>{label}</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.5, textDecoration: strike ? "line-through" : "none", color: strike ? T.faint : good ? T.good : T.ink, fontWeight: good ? 600 : 400 }}>{text}</span>
    </div>
  );
}
function Empty({ mode }) {
  return (
    <div style={center}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sparkles size={18} color={T.accent} />
      </div>
      <p style={{ fontSize: 13.5, color: T.muted, marginTop: 12, maxWidth: 240, lineHeight: 1.5 }}>
        {mode === "generate"
          ? "Fill the steps on the left, then write the copy. Your tone, variants, and rationale appear here."
          : "Paste a draft on the left and run a review. Issues and a clean rewrite appear here."}
      </p>
    </div>
  );
}
function GlossaryModal({ project, onClose, onSave }) {
  const [rows, setRows] = useState(project.glossary.length ? project.glossary : [{ term: "", replaces: "", note: "" }]);
  const firstRef = useRef(null);
  const set = (i, k) => (e) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r));
  const add = () => setRows([...rows, { term: "", replaces: "", note: "" }]);
  const del = (i) => setRows(rows.filter((_, j) => j !== i));
  const save = () => { onSave(rows.filter((r) => r.term.trim())); onClose(); };
  const incomplete = (r) => !r.term.trim() && (r.replaces.trim() || r.note.trim());
  const droppedCount = rows.filter((r) => incomplete(r)).length;

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Project glossary" style={{ fontFamily: T.font, background: T.surface, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "82vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Project glossary</h2>
          <button onClick={onClose} aria-label="Close glossary" style={ghostBtn}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.muted, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
          Locked terms keep wording consistent across every screen. They steer generation and get flagged on review. Rows without a "Use this" term aren't saved.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 28px", gap: 8, fontSize: 11, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".04em" }}>
            <span>Use this</span><span>Not this</span><span>Note</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 28px", gap: 8, alignItems: "center" }}>
              <input ref={i === 0 ? firstRef : null} value={r.term} onChange={set(i, "term")} placeholder="UPI PIN"
                style={{ ...input, padding: "7px 9px", fontSize: 13, borderColor: incomplete(r) ? T.flag : T.line }} />
              <input value={r.replaces} onChange={set(i, "replaces")} placeholder="passcode" style={{ ...input, padding: "7px 9px", fontSize: 13 }} />
              <input value={r.note} onChange={set(i, "note")} placeholder="optional" style={{ ...input, padding: "7px 9px", fontSize: 13 }} />
              <button onClick={() => del(i)} aria-label="Remove term" style={{ ...ghostBtn, padding: 6, justifyContent: "center" }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <button onClick={add} style={{ ...ghostBtn, marginTop: 12 }}><Plus size={14} /> Add term</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 20 }}>
          <span style={{ fontSize: 12, color: droppedCount ? T.flag : "transparent" }}>
            {droppedCount ? `${droppedCount} row${droppedCount > 1 ? "s" : ""} need a term or won't be saved` : "."}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={save} style={{ ...cta(false), padding: "9px 18px", fontSize: 13.5 }}>Save glossary</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ConfirmDialog({ title, body, confirmLabel, confirmColor, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.4)", zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}
        style={{ fontFamily: T.font, background: T.surface, borderRadius: 16, width: "100%", maxWidth: 380, padding: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 18px", lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button onClick={onConfirm}
            style={{ ...cta(false), padding: "9px 16px", fontSize: 13.5, background: confirmColor || T.flag, boxShadow: "none" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
function TrashModal({ trash, onClose, onRestore, onDelete, onEmpty }) {
  const [confirmPermanent, setConfirmPermanent] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const daysLeft = (ts) => {
    const d = Math.ceil((ts + 15 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
    return d > 0 ? `${d}d left` : "expiring";
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Trash"
        style={{ fontFamily: T.font, background: T.surface, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "82vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Trash</h2>
          <button onClick={onClose} aria-label="Close trash" style={ghostBtn}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.muted, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
          Deleted screens are kept for 15 days, then permanently removed.
        </p>

        {trash.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: T.faint }}>
            <Trash2 size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Trash is empty</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trash.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: 9, background: s.mode === "review" ? T.flag : T.accent, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: T.faint }}>{daysLeft(s.trashedAt)}</div>
                </div>
                <button onClick={() => onRestore(s.id)} aria-label={`Restore ${s.name}`} style={ghostBtn}>
                  <ArchiveRestore size={13} /> Restore
                </button>
                {confirmPermanent === s.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => { onDelete(s.id); setConfirmPermanent(null); }}
                      style={{ ...ghostBtn, color: T.flag, borderColor: T.flag }}>Delete</button>
                    <button onClick={() => setConfirmPermanent(null)} style={ghostBtn}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmPermanent(s.id)} aria-label={`Permanently delete ${s.name}`} style={ghostBtn}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {trash.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            {confirmEmpty ? (
              <>
                <span style={{ fontSize: 12.5, color: T.flag, alignSelf: "center" }}>Permanently delete all?</span>
                <button onClick={() => { onEmpty(); setConfirmEmpty(false); }}
                  style={{ ...ghostBtn, color: T.flag, borderColor: T.flag }}>Yes, empty trash</button>
                <button onClick={() => setConfirmEmpty(false)} style={ghostBtn}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmEmpty(true)} style={ghostBtn}>
                <Trash2 size={13} /> Empty trash
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- formatting + style objects ---- */
const fmtVariant = (v) =>
  [v.title && `Title: ${v.title}`, v.body && `Body: ${v.body}`, v.primary && `Primary: ${v.primary}`, v.secondary && `Secondary: ${v.secondary}`].filter(Boolean).join("\n");

const panel = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 };
const center = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 280 };
const input = { width: "100%", boxSizing: "border-box", fontFamily: T.font, fontSize: 13.5, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, outline: "none" };
const menuItem = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", fontFamily: T.font, fontSize: 13, color: T.ink, cursor: "pointer", textAlign: "left" };
const countDot = { background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 9, padding: "1px 6px", marginLeft: 2 };

const pill = () => ({ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: T.font, fontSize: 13, padding: "8px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, cursor: "pointer", fontWeight: 500 });
const tab = (on) => ({ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: T.font, fontSize: 12.5, padding: "0 11px", height: 32, borderRadius: 10, cursor: "pointer", border: `1px solid ${on ? T.accent : T.line}`, background: on ? T.accentSoft : T.surface, color: on ? T.accentInk : T.muted, fontWeight: on ? 600 : 400, boxSizing: "border-box" });
const arrowBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.muted, cursor: "pointer", padding: 0, fontFamily: T.font };
const toggle = (on) => ({ fontFamily: T.font, fontSize: 13, fontWeight: on ? 600 : 500, padding: "7px 18px", borderRadius: 8, cursor: "pointer", border: "none", background: on ? T.surface : "transparent", color: on ? T.accentInk : T.muted, boxShadow: on ? "0 1px 3px rgba(0,0,0,.08)" : "none" });
const ghostBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: T.font, fontSize: 12.5, fontWeight: 500, padding: "9px 12px", minHeight: 38, borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, color: T.accentInk, cursor: "pointer" };
const cta = (disabled) => ({ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: T.font, fontSize: 15, fontWeight: 600, padding: "13px 30px", borderRadius: 14, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: disabled ? T.line : T.accent, color: disabled ? T.faint : "#fff", transition: "all .15s" });
const btnPreview = (primary) => ({ fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: primary ? T.accent : "transparent", color: primary ? "#fff" : T.accentInk, border: primary ? "none" : `1px solid ${T.line}` });
