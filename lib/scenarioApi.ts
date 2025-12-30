"use client";

export async function updateScenario(id: string, patch: any) {
  const res = await fetch(`/api/scenarios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update scenario");
  }

  return res.json();
}