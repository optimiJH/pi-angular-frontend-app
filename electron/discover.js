// electron/discover.js
const mdns = require('multicast-dns')();

const SERVICE = '_pi-sensor._tcp.local';
const discovered = new Map(); // key: instance -> entry

function normalizeHost(h) { return (h || '').replace(/\.$/, ''); }

// Build a plain object list and drop stale entries
function list() {
  const now = Date.now();
  for (const [k, v] of discovered) if (now - v.lastSeen > 15000) discovered.delete(k);
  return Array.from(discovered.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

function start() {
  console.log('[mdns] discovery started');
  // Ask for PTR on our service every 3s
  setInterval(() => {
    mdns.query({ questions: [{ name: SERVICE, type: 'PTR' }] });
  }, 3000);

  mdns.on('response', (res) => {
    let instanceName = null;
    let srv = null;
    const addrs = [];
    const txtRecs = [];

    // Collect answers + additionals
    for (const rr of [...res.answers, ...res.additionals]) {
      // We accept SRV/TXT whose rr.name is the *instance* (endsWith service type)
      if (rr.type === 'SRV' && typeof rr.name === 'string' && rr.name.endsWith(SERVICE)) {
        instanceName = rr.name; // e.g., "pi-fake._pi-sensor._tcp.local"
        srv = rr;
      }
      if ((rr.type === 'A' || rr.type === 'AAAA') && rr.data) {
        addrs.push(rr.data);
      }
      if (rr.type === 'TXT' && typeof rr.name === 'string' && rr.name.endsWith(SERVICE)) {
        txtRecs.push(...(rr.data || []));
      }
    }

    if (!srv?.data) return;

    const targetHost = normalizeHost(srv.data.target);
    const port = srv.data.port;

    // Parse TXT to key=value
    const meta = {};
    for (const b of txtRecs) {
      const s = Buffer.isBuffer(b) ? b.toString() : String(b || '');
      const [k, v] = s.split('=', 2);
      if (k) meta[k] = v ?? '';
    }

    const key = instanceName || `${targetHost}:${port}`;
    const prev = discovered.get(key) || { host: targetHost, port, addresses: [], meta: {}, lastSeen: 0 };

    prev.host = targetHost;
    prev.port = port;
    prev.addresses = Array.from(new Set([...(prev.addresses || []), ...addrs]));
    prev.meta = { ...(prev.meta || {}), ...meta };
    prev.lastSeen = Date.now();

    discovered.set(key, prev);
    console.log('[mdns] SRV', instanceName, '→', targetHost, port, prev.addresses[0] || '');
  });
}

module.exports = { start, list };
