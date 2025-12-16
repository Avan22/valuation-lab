"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, Download, RefreshCcw, Save, Search, X } from "lucide-react";

type Scenario = {
  id: string;
  name: string;
  kind: string; // "DCF" | "LBO"
  currency: string;
  inputs: any;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  kind: "DCF" | "LBO";
  currentInputs: any;
  onLoad: (inputs: any) => void;
};

export default function ScenarioLibrary({ kind, currentInputs, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState(`${kind} Base`);

  async function refresh() {
    setLoading(items.length === 0);
    try {
      const r = await fetch("/api/scenarios", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setItems(Array.isArray(j.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }
// Track first open + kind changes so we only fetch when drawer opens (not on every keystroke/slider)
const didLoadRef = useRef(false);
const lastKindRef = useRef(kind);

useEffect(() => {
  if (!open) return;

  const kindChanged = lastKindRef.current !== kind;
  const firstOpen = !didLoadRef.current;

  if (firstOpen || kindChanged) {
    didLoadRef.current = true;
    lastKindRef.current = kind;
    refresh(); // <-- this should be your function that fetches /api/scenarios and sets items
  }
}, [open, kind]);

// When the drawer closes, allow a fresh load next time it opens
useEffect(() => {
  if (!open) didLoadRef.current = false;
}, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((s) => (s.kind || "").toUpperCase() === kind)
      .filter((s) => (q ? (s.name || "").toLowerCase().includes(q) : true))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [items, kind, query]);

  async function saveScenario() {
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || `${kind} ${new Date().toLocaleString()}`,
        kind,
        currency: "USD",
        inputs: currentInputs,
      };

      const r = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Save failed");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const ok = confirm("Delete this scenario?");
    if (!ok) return;
    await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
          onClick={() => setOpen(true)}
          title="Open Scenario Library"
        >
          Library
        </button>
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
          onClick={saveScenario}
          disabled={saving}
          title="Save current inputs"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setOpen(false)}
          >
            <motion.div
              className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-zinc-950 p-5"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Scenario Library</div>
                  <div className="text-xs text-white/60">
                    {kind} • Stored in Neon/Postgres
                  </div>
                </div>
                <button
                  className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <Search size={16} className="text-white/60" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="Search scenarios…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <button
                  className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                  onClick={refresh}
                  disabled={loading}
                  title="Refresh"
                >
                  <RefreshCcw size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60 mb-2">Save current inputs as</div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
                    onClick={saveScenario}
                    disabled={saving}
                  >
                    <Save size={16} />
                    Save
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 overflow-auto pb-24" style={{ maxHeight: "calc(100vh - 240px)" }}>
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    No scenarios yet. Save one from the top.
                  </div>
                ) : (
                  filtered.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-white/60 mt-1">
                            Updated: {new Date(s.updatedAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                            onClick={() => onLoad(s.inputs)}
                            title="Load into inputs"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                            onClick={() => del(s.id)}
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}