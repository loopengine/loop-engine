// @license MIT
// SPDX-License-Identifier: MIT
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

type PkgJson = {
  name?: string;
  private?: boolean;
  license?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Violation = {
  check: string;
  file: string;
  message: string;
};

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const CORE_BANNED_TOKENS = ["procurement", "inventory", "shipment", "lot"];
const ADAPTER_EXTERNALS = ["pg", "kafkajs"];

async function listDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverPackageDirs(): Promise<string[]> {
  const direct = await listDirs(PACKAGES_DIR);
  const packageDirs: string[] = [];
  for (const dir of direct) {
    const pkgJsonPath = path.join(dir, "package.json");
    if (await fileExists(pkgJsonPath)) {
      packageDirs.push(dir);
      continue;
    }
    if (path.basename(dir) === "adapters") {
      const nested = await listDirs(dir);
      for (const n of nested) {
        if (await fileExists(path.join(n, "package.json"))) {
          packageDirs.push(n);
        }
      }
    }
  }
  return packageDirs.sort();
}

async function readPackageJson(packageDir: string): Promise<PkgJson> {
  return JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8")) as PkgJson;
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await fileExists(dir))) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function rel(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function parseImports(source: string): string[] {
  const imports = new Set<string>();
  const importRegex =
    /(?:import\s+[^'"]*from\s+|import\s*\(|export\s+[^'"]*from\s+)["']([^"']+)["']/g;
  let match: RegExpExecArray | null = null;
  while ((match = importRegex.exec(source)) !== null) {
    if (match[1]) imports.add(match[1]);
  }
  return [...imports];
}

function isNodeBuiltin(spec: string): boolean {
  return spec.startsWith("node:");
}

async function run(): Promise<void> {
  const violations: Violation[] = [];
  const packageDirs = await discoverPackageDirs();

  const packageNames = new Set<string>();
  const pkgJsonByDir = new Map<string, PkgJson>();
  for (const dir of packageDirs) {
    const pkg = await readPackageJson(dir);
    pkgJsonByDir.set(dir, pkg);
    if (pkg.name) packageNames.add(pkg.name);
  }

  for (const dir of packageDirs) {
    const pkg = pkgJsonByDir.get(dir) ?? {};
    const deps = new Set<string>([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {})
    ]);
    const srcFiles = (await walkFiles(path.join(dir, "src"))).filter((f) =>
      /\.(ts|tsx|js|jsx)$/.test(f)
    );
    for (const file of srcFiles) {
      const source = await readFile(file, "utf8");
      for (const spec of parseImports(source)) {
        if (spec.startsWith(".") || isNodeBuiltin(spec)) continue;
        if (spec.startsWith("@loopengine/") && packageNames.has(spec) && !deps.has(spec)) {
          violations.push({
            check: "dependency-declarations",
            file,
            message: `imports ${spec} but package.json does not declare it`
          });
        }
      }
    }

    if (pkg.private === true) {
      violations.push({
        check: "publishability",
        file: path.join(dir, "package.json"),
        message: 'package has "private": true'
      });
    }
    if (pkg.license !== "MIT") {
      violations.push({
        check: "license",
        file: path.join(dir, "package.json"),
        message: 'package license must be "MIT"'
      });
    }
  }

  const coreFiles = (await walkFiles(path.join(PACKAGES_DIR, "core", "src"))).filter(
    (f) => /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes(`${path.sep}__tests__${path.sep}`)
  );
  for (const file of coreFiles) {
    const source = (await readFile(file, "utf8")).toLowerCase();
    for (const token of CORE_BANNED_TOKENS) {
      if (source.includes(token)) {
        violations.push({
          check: "core-domain-neutrality",
          file,
          message: `core contains banned domain token: ${token}`
        });
      }
    }
  }

  const adapterDirs = (await discoverPackageDirs()).filter((d) =>
    d.includes(`${path.sep}packages${path.sep}adapters${path.sep}`)
  );
  for (const dir of adapterDirs) {
    const pkg = pkgJsonByDir.get(dir) ?? {};
    const deps = pkg.dependencies ?? {};
    const peers = pkg.peerDependencies ?? {};
    for (const dep of ADAPTER_EXTERNALS) {
      if (dep in deps) {
        violations.push({
          check: "adapter-peer-deps",
          file: path.join(dir, "package.json"),
          message: `${dep} must not be in dependencies`
        });
      }
      const srcFiles = await walkFiles(path.join(dir, "src"));
      const importsDep = (
        await Promise.all(
          srcFiles
            .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
            .map(async (f) => ({ f, src: await readFile(f, "utf8") }))
        )
      ).some(({ src }) => parseImports(src).some((i) => i === dep || i.startsWith(`${dep}/`)));
      if (importsDep && !(dep in peers)) {
        violations.push({
          check: "adapter-peer-deps",
          file: path.join(dir, "package.json"),
          message: `${dep} is imported but not declared in peerDependencies`
        });
      }
    }
  }

  const srcFiles: string[] = [];
  for (const dir of packageDirs) {
    srcFiles.push(...(await walkFiles(path.join(dir, "src"))));
  }
  for (const file of srcFiles.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))) {
    const source = await readFile(file, "utf8");
    if (!source.includes("SPDX-License-Identifier: MIT")) {
      violations.push({
        check: "mit-headers",
        file,
        message: "missing SPDX MIT header"
      });
    }
  }

  if (violations.length === 0) {
    console.log("PASS dependency-declarations");
    console.log("PASS core-domain-neutrality");
    console.log("PASS adapter-peer-deps");
    console.log("PASS publishability");
    console.log("PASS license");
    console.log("PASS mit-headers");
    return;
  }

  for (const v of violations) {
    console.error(`FAIL ${v.check} ${rel(v.file)}: ${v.message}`);
  }
  process.exit(1);
}

void run();
