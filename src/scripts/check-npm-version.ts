const { name, version } = await Bun.file("package.json").json();
const v4Version = `${version}-effect4`;

async function isTaken(ver: string): Promise<boolean> {
  const res = await fetch(`https://registry.npmjs.org/${name}/${ver}`);
  return res.status === 200;
}

const [v3Taken, v4Taken] = await Promise.all([isTaken(version), isTaken(v4Version)]);

if (v3Taken) console.error(`✗ ${name}@${version} is already published on npm`);
if (v4Taken) console.error(`✗ ${name}@${v4Version} is already published on npm`);
if (v3Taken || v4Taken) process.exit(1);
