#!/usr/bin/env node
/** @see ../../scripts/oss/validate-package-imports.sh */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
execSync("bash scripts/oss/validate-package-imports.sh", { cwd: root, stdio: "inherit" });
