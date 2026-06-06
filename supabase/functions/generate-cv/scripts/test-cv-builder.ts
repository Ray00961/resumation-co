// Run from supabase/functions/generate-cv/:
// deno run --allow-read --allow-write scripts/test-cv-builder.ts

import { buildCvDocx } from "../docx/builders/build-cv-docx.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const scriptDir = dirname(fromFileUrl(import.meta.url));
const testDataDir = join(scriptDir, "..", "test-data");
const testOutputDir = join(scriptDir, "..", "test-output");

const samples = [
  "professional-cv.sample.json",
  "fresh-graduate-cv.sample.json",
  "arabic-professional-cv.sample.json",
  "arabic-fresh-graduate-cv.sample.json",
];

await Deno.mkdir(testOutputDir, { recursive: true });

for (const file of samples) {
  console.log(`Building: ${file}`);
  try {
    const json = await Deno.readTextFile(join(testDataDir, file));
    const data = JSON.parse(json);
    const bytes = await buildCvDocx(data);
    const out = join(testOutputDir, file.replace(".json", ".docx"));
    await Deno.writeFile(out, bytes);
    console.log(`✅ ${out}`);
  } catch (e) {
    console.error(`❌ ${file}: ${e}`);
  }
}

console.log("\nDone — open test-output/*.docx in Word.");