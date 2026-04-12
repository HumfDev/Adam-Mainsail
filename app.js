const URL_PARAMS = new URLSearchParams(window.location.search);
const SENSOR_SECTION = URL_PARAMS.get('sensor') || 'voltage_reading';
const ADS_OBJECT_KEY = `ads1115_sensor ${SENSOR_SECTION}`;
const LOADCELL_SECTION = URL_PARAMS.get('loadcell') || 'loadcell1';
const HX711_OBJECT_KEY = `hx711 ${LOADCELL_SECTION}`;

// const ENABLE_HX711 = URL_PARAMS.get('hx711') !== '0';
const ENABLE_HX711 = false;

const MOONRAKER_HOST = window.location.hostname || 'adampi.local';

const tempEl = document.getElementById('temp');
const voltEl = document.getElementById('voltage');
const updatedEl = document.getElementById('updated');
const statusEl = document.getElementById('status');
const hxRawEl = document.getElementById('hx-raw');
const hxWeightEl = document.getElementById('hx-weight');
const hxGainEl = document.getElementById('hx-gain');
const hxBarFill = document.getElementById('hx-bar-fill');
const hxErrorsEl = document.getElementById('hx-errors');
const hxUpdatedEl = document.getElementById('hx-updated');

let rpcId = 0;
let reconnectTimer = null;
let ws = null;

function sendRpc(method, params) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id: ++rpcId }));
  }
}

function subscribeObjects() {
  const o = { [ADS_OBJECT_KEY]: null };
  if (ENABLE_HX711) o[HX711_OBJECT_KEY] = null;
  return o;
}

function formatTime() {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

function applyAdsStatus(slice) {
  if (!slice || typeof slice !== 'object') return;
  const data = slice[ADS_OBJECT_KEY] ?? slice;  // fallback if already unwrapped
  if (!data) return;
  if (typeof data.temperature === 'number') tempEl.textContent = data.temperature.toFixed(2);
  if (typeof data.voltage === 'number' && voltEl) voltEl.textContent = data.voltage.toFixed(3);
  if (updatedEl) updatedEl.textContent = formatTime();
}

function rawToBarPercent(raw) {
  const r = Math.abs(Number(raw) || 0);
  const cap = 8388607;
  return Math.min(100, (Math.log10(1 + r) / Math.log10(1 + cap)) * 100);
}

function applyHx711Status(slice) {
  if (!slice || typeof slice !== 'object') return;
  const data = slice[HX711_OBJECT_KEY];
  if (!data) return;
  if (hxRawEl && typeof data.raw === 'number') hxRawEl.textContent = String(data.raw);
  if (hxGainEl && typeof data.gain === 'number') hxGainEl.textContent = String(data.gain);
  if (hxWeightEl) hxWeightEl.textContent = typeof data.weight_g === 'number' ? data.weight_g.toFixed(2) : '—';
  if (typeof data.errors === 'number' && hxErrorsEl) hxErrorsEl.textContent = String(data.errors);
  if (hxBarFill && typeof data.raw === 'number') hxBarFill.style.width = `${rawToBarPercent(data.raw).toFixed(1)}%`;
  if (hxUpdatedEl) hxUpdatedEl.textContent = formatTime();
}

function applyStatusSlice(slice) {
  applyAdsStatus(slice);
  applyHx711Status(slice);
}

function connect() {
  ws = new WebSocket(`ws://${MOONRAKER_HOST}:7125/websocket`);

  ws.onopen = () => {
    statusEl.textContent = 'Connected ✓';
    statusEl.style.color = '#00ff99';
    const objects = subscribeObjects();
    sendRpc('printer.objects.subscribe', { objects });
    sendRpc('printer.objects.query', { objects });
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.result?.status) { applyStatusSlice(msg.result.status); return; }
    if (msg.method === 'notify_status_update' && msg.params?.[0]) {
      applyStatusSlice(msg.params[0]);
    }
  };

  ws.onclose = () => {
    statusEl.textContent = 'Disconnected — reconnecting...';
    statusEl.style.color = '#ff4444';
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    statusEl.textContent = 'Error';
    statusEl.style.color = '#ff4444';
  };
}

connect();