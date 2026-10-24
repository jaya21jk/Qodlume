import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildWordDictionaryImportSql } from "../src/lib/word-dictionary-import";

async function main(): Promise<void> {
  const [inputArgument, outputArgument] = process.argv.slice(2);
  if (!inputArgument || !outputArgument) {
    throw new Error(
      "Usage: npm run dictionary:generate -- <input.json> <output.sql>",
    );
  }

  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument);
  if (inputPath === outputPath) {
    throw new Error("Input and output paths must be different.");
  }

  const input = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const sql = buildWordDictionaryImportSql(input);
  await writeFile(outputPath, sql, "utf8");
  console.log(`Generated dictionary import SQL at ${outputPath}.`);
  console.log("Review the file, then apply it with Wrangler using the intended D1 target.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Dictionary import generation failed.");
  process.exitCode = 1;
});
