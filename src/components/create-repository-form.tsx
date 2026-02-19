"use client";

import { FormEvent, useState } from "react";
import { createRepository } from "@/lib/repositories-client";

export default function CreateRepositoryForm() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setCreatedUrl(null);

    try {
      const data = await createRepository({
        name,
        isPrivate: visibility === "private",
      });

      if (data.error) {
        setMessage(data.error ?? "Failed to create repository.");
        return;
      }

      setMessage("Repository created successfully.");
      setCreatedUrl(data.url ?? null);
      setName("");
      setVisibility("public");
    } catch {
      setMessage("Request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {showForm ? "Hide repository form" : "Create repository"}
      </button>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-left">
          <div>
            <label
              htmlFor="repo-name"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-300"
            >
              Repository name
            </label>
            <input
              id="repo-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
              placeholder="my-new-repo"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
              Visibility
            </p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-100">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-100">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                Private
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Creating..." : "Create repository"}
          </button>

          {message ? (
            <p className="text-sm text-zinc-200">
              {message}{" "}
              {createdUrl ? (
                <a
                  href={createdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Open repository
                </a>
              ) : null}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
