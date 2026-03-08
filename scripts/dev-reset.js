const { execSync, spawn } = require("node:child_process");
const { rmSync } = require("node:fs");

function collectListeningPidsOnWindows(ports) {
  const pids = new Set();

  try {
    const output = execSync("netstat -ano -p tcp", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const lines = output.split(/\r?\n/);

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || !trimmed.includes("LISTENING")) {
        return;
      }

      const parts = trimmed.split(/\s+/);
      const localAddress = parts[1] ?? "";
      const pid = Number(parts[parts.length - 1]);

      const matched = ports.some((port) => localAddress.endsWith(`:${port}`));

      if (!matched || !Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
        return;
      }

      pids.add(pid);
    });
  } catch {
    return [];
  }

  return Array.from(pids);
}

function killPidWindows(pid) {
  try {
    execSync(`taskkill /F /PID ${pid}`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    return;
  }
}

function cleanNextArtifacts() {
  rmSync(".next/dev/lock", { force: true });
  rmSync(".next", { recursive: true, force: true });
}

function startDevServer() {
  const child = spawn("npx next dev --webpack", {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

if (process.platform === "win32") {
  const pids = collectListeningPidsOnWindows([3000, 3001]);
  pids.forEach(killPidWindows);
}

cleanNextArtifacts();
startDevServer();
