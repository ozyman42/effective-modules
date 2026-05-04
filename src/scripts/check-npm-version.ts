import { $ } from "bun";

const { name, version } = await Bun.file("package.json").json();
const v4Version = `${version}-effect4`;

async function isTaken(ver: string): Promise<boolean> {
  return (await $`npm view ${name}@${ver} version`.quiet().nothrow()).exitCode === 0;
}

const [v3Taken, v4Taken] = await Promise.all([isTaken(version), isTaken(v4Version)]);

if (v3Taken) console.error(`✗ ${name}@${version} is already published on npm`);
if (v4Taken) console.error(`✗ ${name}@${v4Version} is already published on npm`);
if (v3Taken || v4Taken) process.exit(1);
