import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const enPath = path.join(repoRoot, "src/i18n/messages/en.json");
const zhPath = path.join(repoRoot, "src/i18n/messages/zh.json");
const dialogPath = path.join(repoRoot, "src/components/channel-connect-dialog.tsx");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getValue(input, targetPath) {
  return targetPath.reduce((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return current[key];
  }, input);
}

function hasValue(input, targetPath) {
  return getValue(input, targetPath) !== undefined;
}

function placeholderSet(message) {
  if (typeof message !== "string") {
    return [];
  }

  return [...message.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();
}

function compareTrees(left, right, currentPath, issues) {
  const leftIsObject = left && typeof left === "object" && !Array.isArray(left);
  const rightIsObject = right && typeof right === "object" && !Array.isArray(right);
  const pathLabel = currentPath.join(".");

  if (leftIsObject && rightIsObject) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const nextPath = [...currentPath, key];
      if (!(key in left)) {
        issues.missingInEn.push(nextPath.join("."));
        continue;
      }
      if (!(key in right)) {
        issues.missingInZh.push(nextPath.join("."));
        continue;
      }
      compareTrees(left[key], right[key], nextPath, issues);
    }
    return;
  }

  if (leftIsObject !== rightIsObject || Array.isArray(left) !== Array.isArray(right)) {
    issues.typeMismatches.push(
      `${pathLabel}: en=${Array.isArray(left) ? "array" : typeof left}, zh=${Array.isArray(right) ? "array" : typeof right}`
    );
    return;
  }

  if (typeof left === "string" && typeof right === "string") {
    const leftPlaceholders = placeholderSet(left);
    const rightPlaceholders = placeholderSet(right);
    if (leftPlaceholders.join(",") !== rightPlaceholders.join(",")) {
      issues.placeholderMismatches.push(
        `${pathLabel}: en={${leftPlaceholders.join(", ")}}, zh={${rightPlaceholders.join(", ")}}`
      );
    }
  }
}

function validateModal(messages, locale, issues) {
  const steps = getValue(messages, ["workspace", "panels", "channels", "modal", "steps"]);
  if (!steps || typeof steps !== "object") {
    issues.modal.push(`${locale}: workspace.panels.channels.modal.steps is missing or invalid`);
    return;
  }

  for (const step of Object.keys(steps).sort()) {
    for (const field of ["title", "body"]) {
      const value = steps[step]?.[field];
      const placeholders = placeholderSet(value);

      if (typeof value !== "string") {
        issues.modal.push(`${locale}: steps.${step}.${field} is not a string`);
        continue;
      }

      if (placeholders.length > 0 && placeholders.join(",") !== "channel") {
        issues.modal.push(
          `${locale}: steps.${step}.${field} has invalid placeholders {${placeholders.join(", ")}}`
        );
      }
    }
  }
}

function validateDialogSource(issues) {
  const source = fs.readFileSync(dialogPath, "utf8");
  const requiredPatterns = [
    /t\("title",\s*\{\s*channel:\s*channelName\s*\}\)/,
    /t\(`steps\.\$\{step\}\.title`,\s*\{\s*channel:\s*channelName\s*\}\)/,
    /t\(`steps\.\$\{step\}\.body`,\s*\{\s*channel:\s*channelName\s*\}\)/,
  ];

  for (const pattern of requiredPatterns) {
    if (!pattern.test(source)) {
      issues.dialogCalls.push(`Missing expected translation call: ${pattern}`);
    }
  }
}

function validateLandingKeys(en, zh, issues) {
  const landingKeys = [
    "landing.nav.language",
    "landing.hero.badge",
    "landing.hero.titlePrefix",
    "landing.hero.titleAccent",
    "landing.hero.description",
    "landing.hero.tryDemo",
    "landing.hero.create",
    "landing.hero.goToWorkspace",
    "landing.hero.subline",
    "landing.comparison.title",
    "landing.comparison.description",
    "landing.comparison.table.feature",
    "landing.comparison.table.us",
    "landing.comparison.table.them",
    "landing.features.title",
    "landing.features.description",
    "landing.steps.title",
    "landing.cta.title",
    "landing.cta.description",
    "landing.cta.button",
    "landing.footer",
  ];

  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    landingKeys.push(`landing.comparison.rows.${index}.label`);
  }

  for (const index of [0, 1, 2, 3, 4, 5]) {
    landingKeys.push(`landing.features.items.${index}.title`);
    landingKeys.push(`landing.features.items.${index}.description`);
  }

  for (const index of [0, 1, 2]) {
    landingKeys.push(`landing.steps.items.${index}.title`);
    landingKeys.push(`landing.steps.items.${index}.description`);
  }

  for (const key of landingKeys) {
    const targetPath = key.split(".");
    if (!hasValue(en, targetPath)) {
      issues.landing.push(`en missing ${key}`);
    }
    if (!hasValue(zh, targetPath)) {
      issues.landing.push(`zh missing ${key}`);
    }
  }
}

function printSection(title, values) {
  console.log(`\n[${title}]`);
  if (values.length === 0) {
    console.log("OK");
    return;
  }

  for (const value of values) {
    console.log(`- ${value}`);
  }
}

const en = readJson(enPath);
const zh = readJson(zhPath);

const issues = {
  missingInEn: [],
  missingInZh: [],
  typeMismatches: [],
  placeholderMismatches: [],
  modal: [],
  dialogCalls: [],
  landing: [],
};

compareTrees(en, zh, [], issues);
validateModal(en, "en", issues);
validateModal(zh, "zh", issues);
validateDialogSource(issues);
validateLandingKeys(en, zh, issues);

printSection("Missing In en.json", issues.missingInEn);
printSection("Missing In zh.json", issues.missingInZh);
printSection("Type Mismatches", issues.typeMismatches);
printSection("Placeholder Mismatches", issues.placeholderMismatches);
printSection("Connect Modal Strings", issues.modal);
printSection("Connect Modal Calls", issues.dialogCalls);
printSection("Landing Keys", issues.landing);

const issueCount = Object.values(issues).reduce((count, values) => count + values.length, 0);

if (issueCount > 0) {
  console.error(`\nFound ${issueCount} i18n issue(s).`);
  process.exit(1);
}

console.log("\nAll i18n checks passed.");
