export async function emitPackageJson() {
  const pkg = await Bun.file("package.json").json();
  const effectMajor = parseInt(pkg.peerDependencies.effect.replace(/^[^0-9]*/, "").split(".")[0]);
  const version = effectMajor >= 4 ? `${pkg.version}-effect4` : pkg.version;
  await Bun.write("dist/README.md", await Bun.file("README.md").text());
  await Bun.write("dist/package.json", JSON.stringify({
    name: pkg.name,
    version,
    description: pkg.description,
    repository: pkg.repository,
    license: pkg.license,
    peerDependencies: { effect: pkg.peerDependencies.effect },
    type: "module",
    main: "index.js",
    module: "index.js",
    types: "types/index.d.ts",
    exports: { ".": { types: "./types/index.d.ts", default: "./index.js" } },
  }, null, 2) + "\n");
}

if (import.meta.main) {
  await emitPackageJson();
}
