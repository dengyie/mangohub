import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public theme keeps Mango Hub branding through loading and hydration", () => {
  const navbar = source("../src/components/NavBar.tsx");
  const staticShell = source("../src/components/StaticShell.tsx");
  const dashboard = source("../src/components/DashboardContent.tsx");
  const footer = source("../src/components/Footer.tsx");
  const layout = source("../src/app/layout.tsx");
  const manifest = JSON.parse(source("../public/manifest.json"));
  const themeMetadata = JSON.parse(source("../komari-theme.json"));
  const embeddedIndex = source("../../../public/deerTheme/dist/index.html");
  const embeddedManifest = JSON.parse(
    source("../../../public/deerTheme/dist/manifest.json"),
  );

  assert.match(navbar, /Mango Hub/);
  assert.doesNotMatch(navbar, /Mango VPS/);
  assert.match(staticShell, /Loading Mango Hub/);
  assert.match(staticShell, />Mango Hub</);
  assert.doesNotMatch(staticShell, /Mango VPS/);
  assert.match(layout, /title: "Mango Hub"/);
  assert.doesNotMatch(dashboard, /document\.title\s*=\s*publicInfo\.sitename/);
  assert.match(footer, /https:\/\/github\.com\/dengyie\/mangohub/);
  assert.doesNotMatch(footer, /dengyie\/mango-hub/);
  assert.match(layout, /title: "Mango Hub"/);
  assert.match(layout, /description: "Mango Hub server monitoring dashboard\."/);
  assert.equal(manifest.name, "Mango Hub");
  assert.equal(manifest.description, "Mango Hub server monitoring dashboard.");
  assert.equal(themeMetadata.name, "Mango Hub");
  assert.match(themeMetadata.description, /^Mango Hub /);
  assert.match(embeddedIndex, /Mango Hub/);
  assert.doesNotMatch(
    embeddedIndex,
    /Mango VPS|dengyie\/mango-hub|Komari Monitor|A simple server monitor tool|Komari hub/i,
  );
  assert.equal(embeddedManifest.description, "Mango Hub server monitoring dashboard.");
});
