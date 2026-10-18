import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readOutput = (path) => readFileSync(new URL(`../../dist/${path}`, import.meta.url), "utf8");
const staleBranding = /Mango VPS|dengyie\/mango-hub|Komari Monitor|A simple server monitor tool|Komari hub/i;

test("static export serves Mango Hub branding on every public entry page", () => {
  for (const path of ["index.html", "_not-found.html", "404.html"]) {
    const html = readOutput(path);
    assert.match(html, /Mango Hub/);
    assert.doesNotMatch(html, staleBranding, `${path} contains legacy branding`);
  }

  const manifest = JSON.parse(readOutput("manifest.json"));
  assert.equal(manifest.name, "Mango Hub");
  assert.equal(manifest.short_name, "Mango Hub");
  assert.equal(manifest.description, "Mango Hub server monitoring dashboard.");
});
