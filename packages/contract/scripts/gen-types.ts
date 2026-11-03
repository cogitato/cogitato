import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateTypes, generatedFile } from "./gen-lib.js";

const output = await generateTypes();
await mkdir(dirname(generatedFile), { recursive: true });
await writeFile(generatedFile, output);
console.log(`Wrote ${generatedFile}`);
