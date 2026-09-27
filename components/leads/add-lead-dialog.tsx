"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Modal } from "@/components/ui";

/** Lets an owner add a prospect manually, matching the manual lead source. */
export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    city: "",
    website: "",
    phone: "",
    email: "",
  });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          city: form.city,
          website: form.website || null,
          phone: form.phone || null,
          email: form.email || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Could not add the lead");
        return;
      }
      setDone(true);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add lead
      </Button>
      <Modal open={open} title="Add a lead manually" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-muted">Business name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
              placeholder="Sharma Interiors"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-muted">Category</span>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
                placeholder="Interior Designer"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-muted">City</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
                placeholder="Lucknow"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-muted">Website</span>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
                placeholder="example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-muted">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
                placeholder="+91 …"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-muted">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500/50 focus:outline-none"
              placeholder="owner@business.com"
            />
          </label>
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-200">{error}</p>}
          {done && <p className="text-[11.5px] text-emerald-300">Lead added.</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={busy} disabled={!form.name.trim()} onClick={submit}>
            Add lead
          </Button>
        </div>
      </Modal>
    </>
  );
}
