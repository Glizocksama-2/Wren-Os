import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../data/seed";
import { parseProjectSourceImport, syncProjectSources } from "./projectSources";

describe("project source syncing", () => {
  it("syncs GitHub and Vercel projects into local workspace memory", () => {
    const syncedAt = "2026-05-10T16:00:00.000Z";
    const withGitHub = syncProjectSources(seedWorkspace, {
      provider: "github",
      syncedAt,
      projects: [
        {
          name: "Wren-Os",
          fullName: "Glizocksama-2/Wren-Os",
          description: "Local-first AI command center.",
          url: "https://github.com/Glizocksama-2/Wren-Os",
          branch: "main",
          openIssues: 2,
          updatedAt: syncedAt,
          tags: ["wren-os", "local-first"]
        }
      ]
    });

    const next = syncProjectSources(withGitHub, {
      provider: "vercel",
      syncedAt,
      projects: [
        {
          name: "gorosei-kenya",
          productionUrl: "https://gorosei-kenya.vercel.app",
          status: "production",
          framework: "vite",
          deploymentCount: 1,
          updatedAt: syncedAt
        }
      ]
    });

    expect(next.projectSources.find((source) => source.provider === "github")).toMatchObject({
      status: "linked",
      projectCount: 1,
      issueCount: 2,
      deploymentCount: 0,
      lastSyncedAt: syncedAt
    });
    expect(next.projectSources.find((source) => source.provider === "vercel")).toMatchObject({
      status: "linked",
      projectCount: 1,
      issueCount: 0,
      deploymentCount: 1,
      lastSyncedAt: syncedAt
    });
    expect(next.linkedProjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "github", repository: "Glizocksama-2/Wren-Os" }),
        expect.objectContaining({ provider: "vercel", name: "gorosei-kenya" })
      ])
    );
    expect(next.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "source-doc-github-glizocksama-2-wren-os", title: "GitHub: Glizocksama-2/Wren-Os" }),
        expect.objectContaining({ id: "source-doc-vercel-gorosei-kenya", title: "Vercel: gorosei-kenya" })
      ])
    );
    expect(next.projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: "source-project-vercel-gorosei-kenya" })]));
  });

  it("parses supported source snapshots and rejects unusable data", () => {
    expect(
      parseProjectSourceImport(
        JSON.stringify({
          github: [{ fullName: "Glizocksama-2/Wren-Os", url: "https://github.com/Glizocksama-2/Wren-Os" }],
          vercel: [{ name: "birunda-farm-records", latestProductionUrl: "https://birunda-farm-records.vercel.app" }]
        })
      )
    ).toMatchObject({
      ok: true,
      payloads: [
        expect.objectContaining({ provider: "github" }),
        expect.objectContaining({ provider: "vercel" })
      ]
    });

    expect(parseProjectSourceImport("{ nope")).toMatchObject({
      ok: false,
      error: "Project source import is not valid JSON."
    });
    expect(parseProjectSourceImport(JSON.stringify({ vercel: [{ updated: "today" }] }))).toMatchObject({
      ok: false,
      error: "Project source import needs at least one GitHub or Vercel project with a name."
    });
  });

  it("keeps generated source projects on repeated syncs", () => {
    const payload = {
      provider: "vercel" as const,
      syncedAt: "2026-05-10T16:00:00.000Z",
      projects: [
        {
          name: "birunda-farm-records",
          productionUrl: "https://birunda-farm-records.vercel.app",
          deploymentCount: 1
        }
      ]
    };

    const once = syncProjectSources(seedWorkspace, payload);
    const twice = syncProjectSources(once, { ...payload, syncedAt: "2026-05-10T16:05:00.000Z" });

    expect(twice.projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: "source-project-vercel-birunda-farm-records" })]));
    expect(twice.documents.find((document) => document.id === "source-doc-vercel-birunda-farm-records")?.projectId).toBe(
      "source-project-vercel-birunda-farm-records"
    );
  });
});
