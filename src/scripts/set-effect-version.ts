import { cpSync, rmSync } from "node:fs";
import { Glob } from "bun";

export async function setEffectVersion(version: "3" | "4") {
  const other = version === "3" ? "4" : "3";

  const effectPkg = await Bun.file(`node_modules/effect-${version}/package.json`).json();
  const pkg = await Bun.file("package.json").json();
  pkg.peerDependencies.effect = `^${effectPkg.version}`;
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");
  await Bun.spawn(["bun", "install"], { stdout: "inherit", stderr: "inherit" }).exited;

  rmSync(".build-temp", { recursive: true, force: true });
  cpSync("src", ".build-temp", { recursive: true });

  await Bun.write(".build-temp/effect/index.ts", `export * from "./v${version}";\n`);
  await Bun.write(".build-temp/tests/effect/index.ts", `export * from "./v${version}";\n`);

  rmSync(`.build-temp/effect/v${other}.ts`);
  rmSync(`.build-temp/tests/effect/v${other}.ts`);
  rmSync(".build-temp/scripts", { recursive: true, force: true });

  for await (const file of new Glob("**/*.ts").scan(".build-temp")) {
    const path = `.build-temp/${file}`;
    const content = await Bun.file(path).text();
    const updated = content.replaceAll(`from "effect-${version}`, `from "effect`);
    if (updated !== content) await Bun.write(path, updated);
  }
}

if (import.meta.main) {
  const version = process.argv[2];
  if (version !== "3" && version !== "4") throw new Error("Usage: set-effect-version.ts <3|4>");
  await setEffectVersion(version);
}
