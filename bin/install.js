#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const SETTINGS_BACKUP_PATH = path.join(CLAUDE_DIR, "settings.json.bak");
const SCRIPT_DEST = path.join(CLAUDE_DIR, "minecraft-statusline.sh");
// The statusLine command is run through bash. On Windows path.join yields
// backslashes, which bash treats as escape sequences (C:\Users -> CUsers), so the
// script is never found. Use forward slashes and quote to survive spaces in the path.
const SCRIPT_DEST_CMD = SCRIPT_DEST.split(path.sep).join("/");
const STATUSLINE_COMMAND = `bash "${SCRIPT_DEST_CMD}"`;
const SCRIPT_SRC = path.join(__dirname, "statusline.sh");
const PREVIOUS_STATUSLINE_PATH = path.join(CLAUDE_DIR, "minecraft-statusline.previous-statusline.json");

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  const raw = fs.readFileSync(SETTINGS_PATH, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function install() {
  const missing = ["jq", "curl", "git"].filter((cmd) => !commandExists(cmd));
  if (missing.length > 0) {
    console.warn(`Warning: missing recommended dependencies: ${missing.join(", ")}`);
  }

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  if (fs.existsSync(SCRIPT_DEST)) {
    const backupPath = `${SCRIPT_DEST}.${timestamp()}.bak`;
    fs.copyFileSync(SCRIPT_DEST, backupPath);
    console.log(`Backed up existing script to ${backupPath}`);
  }
  fs.copyFileSync(SCRIPT_SRC, SCRIPT_DEST);
  fs.chmodSync(SCRIPT_DEST, 0o755);
  console.log(`Installed statusline script to ${SCRIPT_DEST}`);

  let settings = {};
  try {
    settings = readSettings();
  } catch (err) {
    console.error(`Could not parse existing ${SETTINGS_PATH}: ${err.message}`);
    process.exit(1);
  }

  if (fs.existsSync(SETTINGS_PATH)) {
    const backupPath = `${SETTINGS_BACKUP_PATH}.${timestamp()}`;
    fs.copyFileSync(SETTINGS_PATH, backupPath);
    console.log(`Backed up existing settings to ${backupPath}`);
  }

  // Only capture statusLine as "previous" if it isn't already ours — otherwise a
  // reinstall/update would overwrite the sidecar with our own config, and
  // --uninstall would restore minecraft-statusline instead of the user's original.
  const isOurStatusLine = settings.statusLine && settings.statusLine.command === STATUSLINE_COMMAND;
  if (settings.statusLine && !isOurStatusLine) {
    fs.writeFileSync(PREVIOUS_STATUSLINE_PATH, JSON.stringify(settings.statusLine, null, 2) + "\n");
  }

  settings.statusLine = {
    type: "command",
    command: STATUSLINE_COMMAND,
    refreshInterval: 10,
  };
  writeSettings(settings);
  console.log(`Configured statusLine in ${SETTINGS_PATH}`);
  console.log("\nDone! Restart Claude Code (or wait for the next refresh) to see the statusline.");
}

function uninstall() {
  // Restore/remove just the statusLine key rather than the whole file — the
  // timestamped settings.json.bak.* files are point-in-time manual backups, not
  // a reliable "state before minecraft-statusline" snapshot after multiple installs.
  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = readSettings();
    if (fs.existsSync(PREVIOUS_STATUSLINE_PATH)) {
      settings.statusLine = JSON.parse(fs.readFileSync(PREVIOUS_STATUSLINE_PATH, "utf8"));
      console.log("Restored previous statusLine configuration");
    } else {
      delete settings.statusLine;
      console.log(`Removed statusLine from ${SETTINGS_PATH}`);
    }
    writeSettings(settings);
  }

  if (fs.existsSync(PREVIOUS_STATUSLINE_PATH)) {
    fs.unlinkSync(PREVIOUS_STATUSLINE_PATH);
  }

  if (fs.existsSync(SCRIPT_DEST)) {
    fs.unlinkSync(SCRIPT_DEST);
    console.log(`Removed ${SCRIPT_DEST}`);
  }

  console.log("\nUninstalled minecraft-statusline.");
}

function printHelp() {
  console.log(`minecraft-statusline

Usage:
  npx minecraft-statusline              Install the statusline for Claude Code
  npx minecraft-statusline --uninstall  Remove the statusline and restore previous config
  npx minecraft-statusline --help       Show this help message
`);
}

const arg = process.argv[2];
if (arg === "--help" || arg === "-h") {
  printHelp();
} else if (arg === "--uninstall") {
  uninstall();
} else if (arg === undefined) {
  install();
} else {
  console.error(`Unknown argument: ${arg}`);
  printHelp();
  process.exit(1);
}
