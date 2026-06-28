import * as os from 'os';

const VIRTUAL_IFACE_PREFIXES = ['docker', 'br-', 'veth', 'virbr', 'lo'];

function isDockerDefaultBridge(address: string): boolean {
  // Docker's default bridge network is 172.17.0.0/16. Don't exclude the
  // entire 172.16.0.0/12 block, since real LANs/VPNs can legitimately use it.
  return address.startsWith('172.17.');
}

export function getLocalIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (VIRTUAL_IFACE_PREFIXES.some(prefix => name.startsWith(prefix))) continue;
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        !isDockerDefaultBridge(addr.address)
      ) {
        return addr.address;
      }
    }
  }
  return null;
}