/**
 * Round Robin CPU Scheduling Visualizer
 * Supporting Operating Systems Practical Activity 1 & Activity 2
 * Plain Vanilla JavaScript Implementation
 */

// ============================================================================
// 1. DEFAULT DATASETS & CONFIGURATIONS
// ============================================================================

const ACTIVITY_CONFIGS = {
  1: {
    name: "Activity 1: Without Context Switching Overhead",
    scenario: "Smart Municipal Control Centre (Context Switching Overhead = 0 ms)",
    defaultOverhead: 0,
    showOverheadInput: false,
    defaultQuantum: 2,
    compQuantums: [2, 3],
    processes: [
      { id: "P1", task: "Water-quality monitoring", at: 0, bt: 5 },
      { id: "P2", task: "Waste-collection scheduling", at: 1, bt: 3 },
      { id: "P3", task: "Traffic-pollution analysis", at: 2, bt: 4 },
      { id: "P4", task: "Public energy-use monitoring", at: 3, bt: 2 }
    ]
  },
  2: {
    name: "Activity 2: With Context Switching Overhead",
    scenario: "Climate Emergency Response Centre (Context Switching Overhead = 1 ms)",
    defaultOverhead: 1,
    showOverheadInput: true,
    defaultQuantum: 2,
    compQuantums: [2, 4],
    processes: [
      { id: "P1", task: "Flood-warning analysis", at: 0, bt: 5 },
      { id: "P2", task: "Air-quality alert generation", at: 1, bt: 4 },
      { id: "P3", task: "Emergency evacuation-route update", at: 2, bt: 3 },
      { id: "P4", task: "Renewable-grid status monitoring", at: 3, bt: 2 }
    ]
  }
};

const PROCESS_COLORS = {
  P1: "#2563eb", // Blue
  P2: "#059669", // Green
  P3: "#d97706", // Amber
  P4: "#7c3aed", // Purple
  CS: "#dc2626", // Red for Context Switch
  IDLE: "#6b7280" // Gray for Idle
};

function getProcessColor(pid) {
  if (PROCESS_COLORS[pid]) return PROCESS_COLORS[pid];
  let hash = 0;
  for (let i = 0; i < pid.length; i++) {
    hash = pid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

// Current active state
let currentActivity = 1;

// ============================================================================
// 2. CORE SCHEDULING ALGORITHM: scheduleRoundRobin
// ============================================================================

/**
 * Executes Round Robin scheduling with optional context switching overhead.
 *
 * Rules:
 * - Ready queue manages runnable processes.
 * - Slices execute for min(remaining_bt, quantum).
 * - Newly arrived processes at or before currentTime are enqueued before preempted processes.
 * - When execution switches from one process to a different process:
 *   - CS overhead interval is charged (if csOverhead > 0).
 *   - Processes arriving during context switching are enqueued before selecting the next process.
 * - Overhead is NEVER charged before the first process, after the final process, or after CPU idle.
 *
 * @param {Array} processList - List of { id, task, at, bt }
 * @param {number} quantum - Time quantum (ms)
 * @param {number} csOverhead - Context switching overhead (ms)
 * @returns {Object} Simulation results including metrics and Gantt timeline slices
 */
function scheduleRoundRobin(processList, quantum, csOverhead = 0) {
  // Deep clone and store initial index to preserve tie-breaking stability
  const processes = processList.map((p, idx) => ({
    id: String(p.id).trim(),
    task: String(p.task).trim(),
    at: Number(p.at),
    bt: Number(p.bt),
    remaining: Number(p.bt),
    initialIndex: idx,
    ct: 0,
    tat: 0,
    wt: 0,
    rt: -1,
    firstStart: -1
  }));

  // Pool of incoming processes sorted by arrival time
  const incoming = [...processes].sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    return a.initialIndex - b.initialIndex;
  });

  const readyQueue = [];
  const slices = []; // { pid, task, start, end, type: "PROCESS" | "CS" | "IDLE" }
  let currentTime = 0;
  let lastRunningPid = null;
  let contextSwitches = 0;

  // Helper to enqueue all processes that arrived on or before targetTime
  function enqueueArrivals(targetTime) {
    while (incoming.length > 0 && incoming[0].at <= targetTime) {
      readyQueue.push(incoming.shift());
    }
  }

  // Handle CPU idle before first arrival if arrival > 0
  if (incoming.length > 0 && incoming[0].at > currentTime) {
    slices.push({
      pid: "IDLE",
      task: "CPU Idle",
      start: currentTime,
      end: incoming[0].at,
      type: "IDLE"
    });
    currentTime = incoming[0].at;
  }
  enqueueArrivals(currentTime);

  // Scheduling loop
  while (readyQueue.length > 0 || incoming.length > 0) {
    if (readyQueue.length === 0) {
      // CPU Idle until next arrival
      const nextProc = incoming[0];
      slices.push({
        pid: "IDLE",
        task: "CPU Idle",
        start: currentTime,
        end: nextProc.at,
        type: "IDLE"
      });
      currentTime = nextProc.at;
      enqueueArrivals(currentTime);
      lastRunningPid = null; // Idle reset: no overhead when transitioning from idle to process
      continue;
    }

    const current = readyQueue.shift();

    // Check for context switch between DIFFERENT processes
    if (lastRunningPid !== null && lastRunningPid !== current.id) {
      contextSwitches++;

      if (csOverhead > 0) {
        const csStart = currentTime;
        currentTime += csOverhead;
        slices.push({
          pid: "CS",
          task: "Context Switch Overhead",
          start: csStart,
          end: currentTime,
          type: "CS"
        });

        // Processes arriving during context switching are enqueued
        enqueueArrivals(currentTime);
      }
    }

    lastRunningPid = current.id;

    // Track First CPU Start Time & Response Time
    if (current.firstStart === -1) {
      current.firstStart = currentTime;
      current.rt = currentTime - current.at;
    }

    // Execute process burst
    const execDuration = Math.min(quantum, current.remaining);
    const start = currentTime;
    currentTime += execDuration;
    current.remaining -= execDuration;

    slices.push({
      pid: current.id,
      task: current.task,
      start: start,
      end: currentTime,
      type: "PROCESS"
    });

    // Enqueue newly arrived processes that arrived during (start, currentTime]
    enqueueArrivals(currentTime);

    // If unfinished, return to back of ready queue; else mark completion
    if (current.remaining > 0) {
      readyQueue.push(current);
    } else {
      current.ct = currentTime;
      current.tat = current.ct - current.at;
      current.wt = current.tat - current.bt;
    }
  }

  // Reorder processes according to input order
  const orderedProcesses = processes.map(p => {
    return processes.find(orig => orig.id === p.id);
  });

  // Calculate aggregate metrics
  const n = orderedProcesses.length;
  const avgTAT = n > 0 ? orderedProcesses.reduce((s, p) => s + p.tat, 0) / n : 0;
  const avgWT = n > 0 ? orderedProcesses.reduce((s, p) => s + p.wt, 0) / n : 0;
  const avgRT = n > 0 ? orderedProcesses.reduce((s, p) => s + p.rt, 0) / n : 0;

  const totalCSOverhead = contextSwitches * csOverhead;
  const totalUsefulBT = orderedProcesses.reduce((s, p) => s + p.bt, 0);
  const cpuEfficiency = currentTime > 0 ? (totalUsefulBT / currentTime) * 100 : 0;

  return {
    processes: orderedProcesses,
    slices,
    avgTAT: round(avgTAT, 2),
    avgWT: round(avgWT, 2),
    avgRT: round(avgRT, 2),
    contextSwitches,
    totalCSOverhead,
    cpuEfficiency: round(cpuEfficiency, 2),
    totalTime: currentTime
  };
}

function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

// ============================================================================
// 3. UI RENDERING FUNCTIONS
// ============================================================================

/**
 * Loads process data into the editable table
 */
function populateInputTable(processList) {
  const tbody = document.getElementById("inputTableBody");
  tbody.innerHTML = "";

  processList.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td>${p.task}</td>
      <td>
        <input type="number" class="table-input at-input" data-id="${p.id}" min="0" step="1" value="${p.at}" aria-label="Arrival Time for ${p.id}">
      </td>
      <td>
        <input type="number" class="table-input bt-input" data-id="${p.id}" min="1" step="1" value="${p.bt}" aria-label="Burst Time for ${p.id}">
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Reads and validates user inputs
 */
function readInputs() {
  clearError();
  const rows = document.querySelectorAll("#inputTableBody tr");
  const procs = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pid = row.cells[0].textContent.trim();
    const task = row.cells[1].textContent.trim();
    const atInput = row.querySelector(".at-input");
    const btInput = row.querySelector(".bt-input");

    const at = parseFloat(atInput.value);
    const bt = parseFloat(btInput.value);

    if (isNaN(at) || at < 0) {
      showError(`Validation Error: Process ${pid} Arrival Time must be a non-negative integer (>= 0).`);
      atInput.focus();
      return null;
    }

    if (isNaN(bt) || bt <= 0) {
      showError(`Validation Error: Process ${pid} Burst Time must be strictly greater than 0.`);
      btInput.focus();
      return null;
    }

    procs.push({ id: pid, task, at, bt });
  }

  const qInput = document.getElementById("quantumInput");
  const quantum = parseFloat(qInput.value);
  if (isNaN(quantum) || quantum <= 0) {
    showError("Validation Error: Time Quantum must be strictly greater than 0.");
    qInput.focus();
    return null;
  }

  let overhead = 0;
  if (currentActivity === 2) {
    const ohInput = document.getElementById("overheadInput");
    overhead = parseFloat(ohInput.value);
    if (isNaN(overhead) || overhead < 0) {
      showError("Validation Error: Context Switching Overhead must be a non-negative number (>= 0).");
      ohInput.focus();
      return null;
    }
  }

  return { procs, quantum, overhead };
}

/**
 * Renders a clean Gantt chart
 */
function renderGanttChart(containerId, slices, totalTime) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!slices || slices.length === 0) return;

  const maxTime = totalTime || slices[slices.length - 1].end;
  if (maxTime <= 0) return;

  const barsContainer = document.createElement("div");
  barsContainer.className = "gantt-bars";

  const timelineContainer = document.createElement("div");
  timelineContainer.className = "gantt-timeline";

  const timestamps = new Set([0]);

  slices.forEach(slice => {
    const duration = slice.end - slice.start;
    const widthPct = (duration / maxTime) * 100;

    const bar = document.createElement("div");
    bar.className = "gantt-bar";
    bar.style.width = `${widthPct}%`;

    if (slice.type === "CS") {
      bar.classList.add("cs-bar");
      bar.textContent = "CS";
      bar.title = `Context Switch: ${slice.start} ms - ${slice.end} ms (${duration} ms)`;
    } else if (slice.type === "IDLE") {
      bar.classList.add("idle-bar");
      bar.textContent = "IDLE";
      bar.title = `CPU Idle: ${slice.start} ms - ${slice.end} ms (${duration} ms)`;
    } else {
      bar.style.backgroundColor = getProcessColor(slice.pid);
      bar.textContent = slice.pid;
      bar.title = `${slice.pid} (${slice.task}): ${slice.start} ms - ${slice.end} ms (${duration} ms)`;
    }

    barsContainer.appendChild(bar);

    timestamps.add(slice.start);
    timestamps.add(slice.end);
  });

  // Render timestamp markers under block boundaries
  const sortedTimes = Array.from(timestamps).sort((a, b) => a - b);
  sortedTimes.forEach(t => {
    const leftPct = (t / maxTime) * 100;
    const mark = document.createElement("div");
    mark.className = "gantt-mark";
    mark.style.left = `${leftPct}%`;
    mark.textContent = t;
    timelineContainer.appendChild(mark);
  });

  container.appendChild(barsContainer);
  container.appendChild(timelineContainer);
}

/**
 * Renders Legend for single simulation
 */
function renderLegend(containerId, processes, hasOverhead = false) {
  const legend = document.getElementById(containerId);
  legend.innerHTML = "";

  processes.forEach(p => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-swatch" style="background-color: ${getProcessColor(p.id)};"></span>
      <span><strong>${p.id}:</strong> ${p.task}</span>
    `;
    legend.appendChild(item);
  });

  if (hasOverhead) {
    const csItem = document.createElement("div");
    csItem.className = "legend-item";
    csItem.innerHTML = `
      <span class="legend-swatch" style="background-color: ${PROCESS_COLORS.CS};"></span>
      <span><strong>CS:</strong> Context Switch</span>
    `;
    legend.appendChild(csItem);
  }
}

/**
 * Renders summary metrics cards
 */
function renderSummaryMetrics(results, isActivity2) {
  const container = document.getElementById("summaryMetricsContainer");
  container.innerHTML = "";

  const metrics = [
    { label: "Average Turnaround Time (TAT)", value: results.avgTAT, unit: "ms" },
    { label: "Average Waiting Time (WT)", value: results.avgWT, unit: "ms" },
    { label: "Average Response Time (RT)", value: results.avgRT, unit: "ms" },
    { label: "Total Context Switches", value: results.contextSwitches, unit: "" },
    { label: "Total CS Overhead", value: results.totalCSOverhead, unit: "ms" }
  ];

  if (isActivity2) {
    metrics.push({
      label: "CPU Efficiency",
      value: `${results.cpuEfficiency}%`,
      unit: ""
    });
  }

  metrics.forEach(m => {
    const box = document.createElement("div");
    box.className = "metric-box";
    box.innerHTML = `
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${m.value}<span class="metric-unit">${m.unit}</span></div>
    `;
    container.appendChild(box);
  });
}

/**
 * Renders Detailed Process Results Table
 */
function renderProcessResults(processes) {
  const tbody = document.getElementById("resultsTableBody");
  tbody.innerHTML = "";

  processes.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td>${p.task}</td>
      <td>${p.at} ms</td>
      <td>${p.bt} ms</td>
      <td><strong>${p.ct} ms</strong></td>
      <td>${p.tat} ms</td>
      <td>${p.wt} ms</td>
      <td>${p.rt} ms</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Renders Side-by-Side Comparison Table
 */
function renderComparisonTable(qA, qB, resA, resB, isActivity2) {
  document.getElementById("thCompColA").textContent = `Time Quantum = ${qA} ms`;
  document.getElementById("thCompColB").textContent = `Time Quantum = ${qB} ms`;

  const tbody = document.getElementById("comparisonTableBody");
  tbody.innerHTML = "";

  const rows = [
    { label: "Time Quantum", valA: `${qA} ms`, valB: `${qB} ms` },
    { label: "Average Turnaround Time (TAT)", valA: `${resA.avgTAT} ms`, valB: `${resB.avgTAT} ms` },
    { label: "Average Waiting Time (WT)", valA: `${resA.avgWT} ms`, valB: `${resB.avgWT} ms` },
    { label: "Average Response Time (RT)", valA: `${resA.avgRT} ms`, valB: `${resB.avgRT} ms` },
    { label: "Total Context Switches", valA: `${resA.contextSwitches}`, valB: `${resB.contextSwitches}` },
    { label: "Total Context Switching Overhead", valA: `${resA.totalCSOverhead} ms`, valB: `${resB.totalCSOverhead} ms` }
  ];

  if (isActivity2) {
    rows.push({
      label: "CPU Efficiency",
      valA: `${resA.cpuEfficiency}%`,
      valB: `${resB.cpuEfficiency}%`
    });
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${r.label}</strong></td>
      <td>${r.valA}</td>
      <td>${r.valB}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showError(msg) {
  const el = document.getElementById("errorAlert");
  el.textContent = msg;
  el.style.display = "block";
}

function clearError() {
  const el = document.getElementById("errorAlert");
  el.textContent = "";
  el.style.display = "none";
}

// ============================================================================
// 4. ACTION HANDLERS & INITIALIZATION
// ============================================================================

/**
 * Switches between Activity 1 and Activity 2
 */
function switchActivity(actNum) {
  currentActivity = actNum;
  const config = ACTIVITY_CONFIGS[actNum];

  // Update tabs
  document.getElementById("tabAct1").classList.toggle("active", actNum === 1);
  document.getElementById("tabAct2").classList.toggle("active", actNum === 2);

  // Update scenario
  document.getElementById("scenarioText").textContent = config.scenario;

  // Toggle overhead input visibility
  document.getElementById("overheadGroup").style.display = config.showOverheadInput ? "flex" : "none";
  document.getElementById("overheadInput").value = config.defaultOverhead;

  // Set default quantum
  document.getElementById("quantumInput").value = config.defaultQuantum;

  // Populate default table
  populateInputTable(config.processes);

  // Hide results section until user explicitly runs simulation
  document.getElementById("resultsSection").style.display = "none";
  clearError();
}

/**
 * Runs a single simulation and displays results
 */
function handleRunSimulation() {
  const inputs = readInputs();
  if (!inputs) return;

  const { procs, quantum, overhead } = inputs;
  const results = scheduleRoundRobin(procs, quantum, overhead);

  // Show results section
  document.getElementById("resultsSection").style.display = "block";
  document.getElementById("singleSimulationView").style.display = "block";
  document.getElementById("comparisonView").style.display = "none";

  // Update headings & Gantt
  document.getElementById("singleGanttHeading").textContent = `Gantt Chart (Time Quantum = ${quantum} ms, Overhead = ${overhead} ms)`;
  renderLegend("singleLegend", results.processes, overhead > 0);
  renderGanttChart("singleGanttChart", results.slices, results.totalTime);

  // Update metrics and table
  renderSummaryMetrics(results, currentActivity === 2);
  renderProcessResults(results.processes);
}

/**
 * Runs comparative simulation and displays side-by-side results
 */
function handleCompareQuantums() {
  const inputs = readInputs();
  if (!inputs) return;

  const { procs, overhead } = inputs;
  const config = ACTIVITY_CONFIGS[currentActivity];
  const [qA, qB] = config.compQuantums;

  const resA = scheduleRoundRobin(procs, qA, overhead);
  const resB = scheduleRoundRobin(procs, qB, overhead);

  // Show results section in comparison mode
  document.getElementById("resultsSection").style.display = "block";
  document.getElementById("singleSimulationView").style.display = "none";
  document.getElementById("comparisonView").style.display = "block";

  // Synchronize time scale across both Gantts
  const maxTime = Math.max(resA.totalTime, resB.totalTime);

  document.getElementById("labelCompA").textContent = `Time Quantum = ${qA} ms (Total Elapsed Time = ${resA.totalTime} ms)`;
  document.getElementById("labelCompB").textContent = `Time Quantum = ${qB} ms (Total Elapsed Time = ${resB.totalTime} ms)`;

  renderGanttChart("compGanttChartA", resA.slices, maxTime);
  renderGanttChart("compGanttChartB", resB.slices, maxTime);

  renderComparisonTable(qA, qB, resA, resB, currentActivity === 2);
}

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
  // Bind tab switches
  document.getElementById("tabAct1").addEventListener("click", () => switchActivity(1));
  document.getElementById("tabAct2").addEventListener("click", () => switchActivity(2));

  // Bind buttons
  document.getElementById("loadDefaultBtn").addEventListener("click", () => {
    const config = ACTIVITY_CONFIGS[currentActivity];
    document.getElementById("quantumInput").value = config.defaultQuantum;
    document.getElementById("overheadInput").value = config.defaultOverhead;
    populateInputTable(config.processes);
    clearError();
  });

  document.getElementById("runSimBtn").addEventListener("click", handleRunSimulation);
  document.getElementById("compareBtn").addEventListener("click", handleCompareQuantums);

  // Initialize with Activity 1
  switchActivity(1);
});
