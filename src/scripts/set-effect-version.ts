import { cpSync, rmSync } from "node:fs";
import { Glob } from "bun";

export async function setEffectVersion(version: "3" | "4") {
  const other = version === "3" ? "4" : "3";

  const pkg = await Bun.file("package.json").json();
  const devSpec: string = pkg.devDependencies[`effect-${version}`];
  pkg.peerDependencies.effect = devSpec.replace("npm:effect@", "");
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  await Bun.spawn(["bun", "update", `effect-${version}`], { stdout: "inherit", stderr: "inherit" }).exited;

  const effectPkg = await Bun.file(`node_modules/effect-${version}/package.json`).json();
  pkg.peerDependencies.effect = `^${effectPkg.version}`;
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  const tsconfig = await Bun.file("tsconfig.json").json();
  tsconfig.compilerOptions.paths = { "effect/*": [`./node_modules/effect-${version}/*`] };
  await Bun.write("tsconfig.json", JSON.stringify(tsconfig, null, 2) + "\n");

  await Bun.write("src/effect/index.ts", `export * from "./v${version}";\n`);
  await Bun.write("src/tests/effect/index.ts", `export * from "./v${version}";\n`);

  rmSync(".build-temp", { recursive: true, force: true });
  cpSync("src", ".build-temp", { recursive: true });

  rmSync(`.build-temp/effect/v${other}.ts`);
  rmSync(`.build-temp/tests/effect/v${other}.ts`);
  rmSync(".build-temp/scripts", { recursive: true, force: true });

  for await (const file of new Glob("**/*.ts").scan(".build-temp")) {
    const path = `.build-temp/${file}`;
    const content = await Bun.file(path).text();
    const updated = content.replaceAll(`from "effect-${version}`, `from "effect`);
    if (updated !== content) await Bun.write(path, updated);
  }

  await Bun.write(".build-temp/tsconfig.json", JSON.stringify({
    compilerOptions: {
      lib: ["ESNext"],
      target: "ESNext",
      module: "Preserve",
      moduleDetection: "force",
      allowJs: true,
      moduleResolution: "bundler",
      verbatimModuleSyntax: true,
      strict: true,
      skipLibCheck: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noPropertyAccessFromIndexSignature: false,
      outDir: "../dist",
      declaration: true,
      declarationDir: "../dist/types",
      declarationMap: true,
      inlineSources: true,
      sourceMap: true,
      jsx: "react-jsx",
      types: ["bun"],
      paths: { "effect/*": [`../node_modules/effect-${version}/*`] },
    },
    include: ["**/*"],
    exclude: ["tests", "scripts"],
  }, null, 2) + "\n");
}

if (import.meta.main) {
  const version = process.argv[2];
  if (version !== "3" && version !== "4") throw new Error("Usage: set-effect-version.ts <3|4>");
  await setEffectVersion(version);
}
