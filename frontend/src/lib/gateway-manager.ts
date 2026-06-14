/**
 * Gateway connection manager.
 *
 * Manages the Python LLM Gateway backend as a child process.
 * Auto-starts it if not running, and proxies all API calls to it.
 */

import { execSync, spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { GATEWAY_ADMIN_KEY } from "./gateway-config";

let gatewayProcess: ChildProcess | null = null;
let isStarting = false;
let healthCheckInterval: NodeJS.Timeout | null = null;

const GATEWAY_PORT = 8001;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const GATEWAY_DIR = join(process.cwd(), "..", "backend");

export function getGatewayUrl() {
  return GATEWAY_URL;
}

export function gatewayHeaders() {
  return {
    Authorization: `Bearer ${GATEWAY_ADMIN_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * Check if the gateway is running and responsive.
 */
export async function isGatewayRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start the Python gateway as a child process.
 */
export async function startGateway(): Promise<boolean> {
  if (isStarting) return false;
  if (await isGatewayRunning()) return true;

  isStarting = true;
  console.log("[gateway-manager] Starting Python LLM Gateway...");

  try {
    const venvPython = join(GATEWAY_DIR, "venv", "bin", "python");
    const pythonExecutable = existsSync(venvPython) ? venvPython : "python3";

    const projectRoot = join(GATEWAY_DIR, "..");

    gatewayProcess = spawn(pythonExecutable, ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", `--port=${GATEWAY_PORT}`, "--log-level", "error"], {
      cwd: GATEWAY_DIR,
      env: { 
        ...process.env, 
        LLM_GATEWAY_CONFIG: "config.yaml",
        PYTHONPATH: projectRoot
      },
      stdio: "pipe",
      detached: false,
    });

    gatewayProcess.stdout?.on("data", (data) => {
      console.log(`[gateway-process-out] ${data.toString().trim()}`);
    });

    gatewayProcess.stderr?.on("data", (data) => {
      console.error(`[gateway-process-err] ${data.toString().trim()}`);
    });

    gatewayProcess.on("error", (err) => {
      console.error("[gateway-manager] Process error:", err.message);
      isStarting = false;
    });

    gatewayProcess.on("exit", (code) => {
      console.log(`[gateway-manager] Process exited with code ${code}`);
      gatewayProcess = null;
      isStarting = false;
    });

    // Wait for it to become healthy
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isGatewayRunning()) {
        console.log("[gateway-manager] Gateway is UP!");
        isStarting = false;
        return true;
      }
    }

    console.error("[gateway-manager] Gateway failed to start within timeout");
    isStarting = false;
    return false;
  } catch (err) {
    console.error("[gateway-manager] Failed to start:", err);
    isStarting = false;
    return false;
  }
}

/**
 * Ensure gateway is running, then make a proxied request.
 */
export async function gatewayFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Try direct connection first
  if (!(await isGatewayRunning())) {
    // Try to start it
    await startGateway();
  }

  const url = `${GATEWAY_URL}${path}`;
  const headers = {
    ...gatewayHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    // Gateway unreachable even after start attempt
    console.error(`[gateway-manager] Fetch failed for ${path}:`, err);
    throw new Error("Gateway unreachable");
  }
}
