import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "styles", "app.css"), "utf8");

function ruleBody(selector) {
  const blocks = css.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const block of blocks) {
    const selectors = block[1].split(",").map((item) => item.trim());
    if (selectors.includes(selector)) return block[2];
  }
  return "";
}

function hasRule(selector, propertyText) {
  const blocks = css.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const block of blocks) {
    const selectors = block[1].split(",").map((item) => item.trim());
    if (selectors.includes(selector) && block[2].includes(propertyText)) return true;
  }
  return false;
}

function zIndex(selector) {
  const match = ruleBody(selector).match(/z-index:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

describe("app layering CSS", () => {
  it("keeps workspace and notification menus above dashboard and mobile navigation layers", () => {
    expect(ruleBody(".deck-topbar")).toContain("position: relative");
    expect(zIndex(".deck-topbar")).toBeGreaterThan(zIndex(".tactical-rail"));
    expect(zIndex(".workspace-switcher")).toBeGreaterThan(zIndex(".deck-topbar"));
    expect(zIndex(".workspace-switcher-menu")).toBeGreaterThan(zIndex(".workspace-switcher"));
    expect(ruleBody(".deck-screen")).toContain("overflow: visible");
  });

  it("keeps project names readable before secondary progress and repo metadata", () => {
    expect(hasRule(".project-row", "grid-template-columns: minmax(220px, 1fr)")).toBe(true);
    expect(ruleBody(".project-row .project-title")).toContain("white-space: normal");
    expect(ruleBody(".project-row .project-title")).toContain("overflow-wrap: anywhere");
    expect(ruleBody(".project-row .project-next-action")).toContain("white-space: normal");
    expect(ruleBody(".project-row .repo-meta")).toContain("justify-content: flex-start");
    expect(ruleBody(".project-row .row-actions")).toContain("justify-content: flex-start");
    expect(ruleBody(".health-name strong")).toContain("white-space: normal");
  });

  it("lays out to do tasks as four readable boxes on desktop with mobile fallbacks", () => {
    expect(css).toMatch(/\.todo-panel\s+\.todo-task-list\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(190px,\s*1fr\)\)/);
    expect(hasRule(".task-card-row", '"check menu"')).toBe(true);
    expect(hasRule(".task-card-row", '"main main"')).toBe(true);
    expect(hasRule(".task-card-row", '"telegram telegram"')).toBe(true);
    expect(hasRule(".task-card-row", "min-height: 178px")).toBe(true);
    expect(css).toContain("@media (max-width: 560px)");
  });
});
