"use client";

import { useActionState } from "react";
import { createTeam } from "@/app/actions/teams";
import { Button } from "@/components/ui/button";
import type { Track } from "@/db/schema";

const field =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-ink/30 focus:outline-none";

export function CreateTeamForm({
  eventSlug,
  tracks,
}: {
  eventSlug: string;
  tracks: Track[];
}) {
  const [state, action, pending] = useActionState(createTeam, {});

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="eventSlug" value={eventSlug} />

      <div>
        <label htmlFor="team-name" className="mb-1 block text-sm text-ink">
          Team name
        </label>
        <input
          id="team-name"
          name="name"
          required
          maxLength={80}
          placeholder="Practice Makes Perfect"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="team-pitch" className="mb-1 block text-sm text-ink">
          What are you building?{" "}
          <span className="text-ink-tertiary">(optional)</span>
        </label>
        <input
          id="team-pitch"
          name="pitch"
          maxLength={280}
          placeholder="One line is plenty."
          className={field}
        />
      </div>

      {tracks.length > 0 && (
        <div>
          <label htmlFor="team-track" className="mb-1 block text-sm text-ink">
            Track
          </label>
          <select id="team-track" name="trackId" className={field}>
            <option value="">No track</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.error && (
        <p className="text-sm text-brand" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}
