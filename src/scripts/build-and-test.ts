import { cpSync, rmSync } from "node:fs";
import { Glob } from "bun";
import { setEffectVersion } from "./set-effect-version";
import { emitPackageJson } from "./emit-package-json";

const version = process.argv[2];
if (version !== "3" && version !== "4") throw new Error("Usage: build-and-test.ts <3|4>");

async function run(cmd: string[], cwd?: string) {
  const code = await Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit", stdin: "inherit" }).exited;
  if (code !== 0) process.exit(code);
}

console.log(`[1/5] Setting up effect v${version}`);
await setEffectVersion(version);

console.log(`[2/5] Running tests`);
await run(["bun", "test"], ".build-temp");

console.log(`[3/5] Type checking`);
await run(["bun", "node_modules/typescript/bin/tsc", "-p", "tsconfig.check.json"]);

console.log(`[4/5] Building`);
rmSync("dist", { recursive: true, force: true });
await run(["bun", "node_modules/typescript/bin/tsc", "-p", ".build-temp/tsconfig.json"]);

cpSync(".build-temp", "dist/src", { recursive: true });
rmSync("dist/src/tests", { recursive: true, force: true });
rmSync("dist/src/scripts", { recursive: true, force: true });
rmSync("dist/src/tsconfig.json", { force: true });

for await (const file of new Glob("**/*.map").scan("dist")) {
  const path = `dist/${file}`;
  const content = await Bun.file(path).text();
  const updated = content.replaceAll("../.build-temp/", "src/");
  if (updated !== content) await Bun.write(path, updated);
}

rmSync(".build-temp", { recursive: true, force: true });

console.log(`[5/5] Emitting dist/package.json`);
await emitPackageJson();

console.log(`Done`);
