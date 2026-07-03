#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const SETTINGS_BACKUP_PATH = path.join(CLAUDE_DIR, "settings.json.bak");
const SCRIPT_DEST = path.join(CLAUDE_DIR, "minecraft-statusline.js");
const SCRIPT_SRC = path.join(__dirname, "statusline.js");
const PREVIOUS_STATUSLINE_PATH = path.join(CLAUDE_DIR, "minecraft-statusline.previous-statusline.json");

// Build the statusLine command. Two Windows/cross-platform pitfalls to avoid:
//   1. path.join yields backslashes, which a shell may mangle — use forward slashes and quote.
//   2. Claude Code may be launched from a GUI where a version-managed `node` (nvm/fnm/volta)
//      isn't on PATH. Bake in the absolute path of the Node running this installer so the
//      command resolves regardless of how Claude Code was started.
const toCmdPath = (p) => p.split(path.sep).join("/");
const NODE_BIN = toCmdPath(process.execPath);
const SCRIPT_DEST_CMD = toCmdPath(SCRIPT_DEST);
const STATUSLINE_COMMAND = `"${NODE_BIN}" "${SCRIPT_DEST_CMD}"`;

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
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  if (fs.existsSync(SCRIPT_DEST)) {
    const backupPath = `${SCRIPT_DEST}.${timestamp()}.bak`;
    fs.copyFileSync(SCRIPT_DEST, backupPath);
    console.log(`Backed up existing script to ${backupPath}`);
  }
  fs.copyFileSync(SCRIPT_SRC, SCRIPT_DEST);
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
  // Match by filename so upgrades from older versions (bash .sh, or a different
  // node path) are still recognized as ours rather than captured as the user's.
  const isOurStatusLine =
    settings.statusLine && /minecraft-statusline\.(js|sh)/.test(settings.statusLine.command || "");
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
