import { buildCvDocx } from "./docx/builders/build-cv-docx.ts";

const files = [
  {
    input: "./test-data/professional-cv.sample.json",
    output: "./test-data/professional-cv.docx",
  },
  {
    input: "./test-data/fresh-graduate-cv.sample.json",
    output: "./test-data/fresh-graduate-cv.docx",
  },
  {
    input: "./test-data/arabic-professional-cv.sample.json",
    output: "./test-data/arabic-professional-cv.docx",
  },
  {
    input: "./test-data/arabic-fresh-graduate-cv.sample.json",
    output: "./test-data/arabic-fresh-graduate-cv.docx",
  },
];

for (const file of files) {
  const cv = JSON.parse(await Deno.readTextFile(file.input));
  const docxBytes = await buildCvDocx(cv);
  await Deno.writeFile(file.output, docxBytes);
  console.log(`DOCX GENERATED: ${file.output}`);
}