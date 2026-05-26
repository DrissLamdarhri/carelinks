import os from "node:os";
import dgram from "node:dgram";
import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "lan";

function pickLanIpv4Fallback() {
  const invalidName = /(virtual|vmware|vbox|loopback|hyper-v|vethernet|docker|bluetooth|tailscale|hamachi)/i;
  const preferredName = /(wi-?fi|wlan|wireless|ethernet)/i;
  const candidates = [];

  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (!entries || invalidName.test(name)) continue;
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") continue;
      if (!entry.address || entry.address.startsWith("169.254.")) continue;
      const score = preferredName.test(name) ? 10 : 0;
      candidates.push({ name, address: entry.address, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address ?? null;
}

async function pickPrimaryIpv4() {
  const fallback = pickLanIpv4Fallback();
  return await new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      resolve(fallback);
    }, 700);

    socket.once("error", () => {
      clearTimeout(timer);
      socket.close();
      resolve(fallback);
    });

    socket.connect(53, "8.8.8.8", () => {
      clearTimeout(timer);
      const addr = socket.address();
      socket.close();
      if (typeof addr === "object" && addr.address) {
        resolve(addr.address);
        return;
      }
      resolve(fallback);
    });
  });
}

const expoArgs = ["exec", "expo", "start", "--clear", "--port", "8082"];

switch (mode) {
  case "android":
    expoArgs.push("--lan", "--android");
    break;
  case "ios":
    expoArgs.push("--lan", "--ios");
    break;
  case "tunnel":
    expoArgs.push("--tunnel");
    break;
  case "offline":
    expoArgs.push("--offline");
    break;
  case "lan":
  default:
    expoArgs.push("--lan");
    break;
}

const env = { ...process.env, EXPO_NO_DEPENDENCY_VALIDATION: "1" };
const lanIp = await pickPrimaryIpv4();
if (lanIp && mode !== "tunnel") {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
}

const child = spawn("pnpm", expoArgs, {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
