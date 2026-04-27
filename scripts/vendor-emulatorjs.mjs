import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = path.join(root, "public", "vendor", "emulatorjs", "data");
const emulatorDataDir = path.join(path.dirname(require.resolve("@emulatorjs/emulatorjs/package.json")), "data");

const cores = [
  "fceumm",
  "snes9x",
  "gambatte",
  "mgba",
  "mupen64plus_next",
  "genesis_plus_gx",
  "picodrive",
  "smsplus",
  "pcsx_rearmed",
  "mednafen_pce",
  "mednafen_ngp",
  "mednafen_wswan",
  "gearcoleco",
  "stella2014",
  "prosystem",
  "handy"
];

async function copyCore(core) {
  const packageDir = path.dirname(require.resolve(`@emulatorjs/core-${core}/package.json`));
  await cp(packageDir, path.join(vendorDir, "cores"), {
    recursive: true,
    filter(source) {
      const basename = path.basename(source);
      return basename !== "package.json" && basename !== "README.md";
    }
  });
}

async function patchEmulatorSource() {
  const emulatorPath = path.join(vendorDir, "src", "emulator.js");
  let source = await readFile(emulatorPath, "utf8");

  source = source.replace(
    /fetch\("https:\/\/cdn\.emulatorjs\.org\/stable\/data\/version\.json"\)[\s\S]*?\n    }\n    versionAsInt/,
    `fetch(this.config.dataPath + "version.json").then(response => {
            if (response.ok) {
                response.text().then(body => {
                    let version = JSON.parse(body);
                    if (this.versionAsInt(this.ejs_version) < this.versionAsInt(version.version)) {
                        console.log(\`Using EmulatorJS version \${this.ejs_version} but the bundled version is \${version.current_version}\`);
                    }
                })
            }
        })
    }
    versionAsInt`
  );

  source = source.replace(
    /if \(res === -1\) \{\n                console\.log\("File not found, attemping to fetch from emulatorjs cdn\."\);[\s\S]*?console\.warn\("File was not found locally, but was found on the emulatorjs cdn\.\\nIt is recommended to download the stable release from here: https:\/\/cdn\.emulatorjs\.org\/releases\/"\);\n            }/,
    `if (res === -1) {
                if (!this.supportsWebgl2) {
                    this.startGameError(this.localization("Outdated graphics driver"));
                } else {
                    this.startGameError(this.localization("Error downloading core") + " (" + filename + ")");
                }
                return;
            }`
  );

  await writeFile(emulatorPath, source);
}

async function patchLoaderSource() {
  const loaderPath = path.join(vendorDir, "loader.js");
  let source = await readFile(loaderPath, "utf8");

  source = source.replace(
    /console\[minifiedFailed \? "warn" : "error"\]\("Failed to load " \+ file \+ " beacuse it's likly that the minified files are missing\.[\s\S]*?extract them to the data\/cores\/ folder\."\);/,
    `console[minifiedFailed ? "warn" : "error"]("Failed to load " + file + ". Run npm run vendor to refresh the local EmulatorJS files in public/vendor/emulatorjs/data.");`
  );

  await writeFile(loaderPath, source);
}

await rm(vendorDir, { recursive: true, force: true });
await mkdir(vendorDir, { recursive: true });
await cp(emulatorDataDir, vendorDir, { recursive: true });
await rm(path.join(vendorDir, "cores"), { recursive: true, force: true });
await mkdir(path.join(vendorDir, "cores"), { recursive: true });

for (const core of cores) {
  await copyCore(core);
}

await patchEmulatorSource();
await patchLoaderSource();
console.log(`Vendored EmulatorJS data and ${cores.length} cores.`);
