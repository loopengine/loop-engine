import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function fail(message: string): never {
  throw new Error(`[check-security-metadata] ${message}`);
}

function extractEnvVarsFromExamples(exampleDir: string): string[] {
  const vars = new Set<string>();
  const files = readdirSync(exampleDir).filter((file) => file.endsWith(".ts"));
  for (const file of files) {
    const content = read(join(exampleDir, file));
    const matches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
    for (const match of matches) {
      vars.add(match[1] as string);
    }
  }
  return [...vars].sort();
}

function checkSkillSections(skillPath: string): void {
  const content = read(skillPath).toLowerCase();
  const requiredSections = [
    "## modes of operation",
    "## environment variables",
    "## external network and data flow",
    "## provenance"
  ];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      fail(`${skillPath} missing required section: ${section}`);
    }
  }
}

function checkEnvVarsDeclared(skillPath: string, requiredVars: string[]): void {
  const content = read(skillPath);
  for (const envVar of requiredVars) {
    if (!content.includes(envVar)) {
      fail(`${skillPath} missing env var disclosure for ${envVar}`);
    }
  }
}

function checkPackageMetadata(packageJsonPath: string): void {
  const parsed = JSON.parse(read(packageJsonPath)) as Record<string, unknown>;
  if (!parsed.repository) fail(`${packageJsonPath} missing "repository"`);
  if (!parsed.homepage) fail(`${packageJsonPath} missing "homepage"`);
}

function main(): void {
  const repoRoot = process.cwd();
  const governanceExamplesDir = join(
    repoRoot,
    "packages/adapter-openclaw/loop-engine-governance"
  );
  const governanceSkillPath = join(
    repoRoot,
    "packages/adapter-openclaw/loop-engine-governance/SKILL.md"
  );

  const requiredVars = extractEnvVarsFromExamples(governanceExamplesDir);
  checkSkillSections(governanceSkillPath);
  checkEnvVarsDeclared(governanceSkillPath, requiredVars);

  const packageManifests = [
    "package.json",
    "packages/adapter-openclaw/package.json",
    "packages/adapter-openai/package.json",
    "packages/adapter-anthropic/package.json",
    "packages/adapter-grok/package.json",
    "packages/adapter-gemini/package.json"
  ].map((path) => join(repoRoot, path));

  for (const manifestPath of packageManifests) {
    checkPackageMetadata(manifestPath);
  }

  console.log(
    `[check-security-metadata] OK. env vars: ${requiredVars.join(", ") || "(none found)"}`
  );
}

main();
