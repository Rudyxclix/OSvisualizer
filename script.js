const arrivalInput = document.querySelector("#arrival-time");
const burstInput = document.querySelector("#burst-time");
const quantumInput = document.querySelector("#time-quantum");
const processList = document.querySelector("#process-list");
const processCount = document.querySelector("#process-count");
const formMessage = document.querySelector("#form-message");
const resultsSection = document.querySelector("#results");

const processColors = [
  { color: "#2874f0", tint: "#e8efff" },
  { color: "#28a75b", tint: "#e5f6eb" },
  { color: "#873fe0", tint: "#f1eaff" },
  { color: "#d94f83", tint: "#ffebf1" },
  { color: "#1499a5", tint: "#e3f6f7" },
  { color: "#d58824", tint: "#fff3df" },
  { color: "#668d32", tint: "#eef5e5" },
  { color: "#526dcc", tint: "#e9edff" }
];

let processes = [];
let nextProcessNumber = 1;

function showMessage(message) {
  formMessage.textContent = message;
}

function getProcessColor(id) {
  const processNumber = Number(id.slice(1));
  return processColors[(processNumber - 1) % processColors.length];
}

function setProcessColor(element, id) {
  const color = getProcessColor(id);
  element.style.setProperty("--process-color", color.color);
  element.style.setProperty("--process-tint", color.tint);
}

function createProcessBadge(id) {
  const badge = document.createElement("span");
  badge.className = "process-badge";
  badge.textContent = id;
  setProcessColor(badge, id);
  return badge;
}

function renderProcessList() {
  processList.replaceChildren();
  processCount.textContent = `${processes.length} ${processes.length === 1 ? "process" : "processes"}`;

  if (processes.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    const emptyState = document.createElement("span");
    const icon = document.createElement("span");
    const message = document.createElement("span");
    cell.colSpan = 4;
    emptyState.className = "empty-state";
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "+";
    message.textContent = "No processes added yet. Add a process or load the example.";
    emptyState.append(icon, message);
    cell.append(emptyState);
    row.append(cell);
    processList.append(row);
    return;
  }

  processes.forEach((process) => {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    const arrivalCell = document.createElement("td");
    const burstCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");

    idCell.append(createProcessBadge(process.id));
    arrivalCell.textContent = process.arrivalTime;
    burstCell.textContent = process.burstTime;
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${process.id}`);
    removeButton.addEventListener("click", () => {
      processes = processes.filter((item) => item.id !== process.id);
      renderProcessList();
      resultsSection.hidden = true;
      showMessage("");
    });

    actionCell.append(removeButton);
    row.append(idCell, arrivalCell, burstCell, actionCell);
    processList.append(row);
  });
}

function addProcess(arrivalTime, burstTime) {
  processes.push({
    id: `P${nextProcessNumber}`,
    arrivalTime,
    burstTime
  });
  nextProcessNumber += 1;
  renderProcessList();
  resultsSection.hidden = true;
}

function getValidTimeValue(input, label, allowZero = false) {
  const value = input.valueAsNumber;

  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`);
  }

  return value;
}

function generateSchedule(timeQuantum) {
  const orderedProcesses = processes
    .map((process, index) => ({
      ...process,
      order: index,
      remainingTime: process.burstTime
    }))
    .sort((first, second) => first.arrivalTime - second.arrivalTime || first.order - second.order);

  const workflow = [];
  const readyQueue = [];
  let currentTime = 0;
  let nextProcessIndex = 0;
  let completedCount = 0;

  while (completedCount < orderedProcesses.length) {
    // Add every process that has arrived before the next CPU turn.
    while (
      nextProcessIndex < orderedProcesses.length
      && orderedProcesses[nextProcessIndex].arrivalTime <= currentTime
    ) {
      readyQueue.push(orderedProcesses[nextProcessIndex]);
      nextProcessIndex += 1;
    }

    if (readyQueue.length === 0) {
      // If nobody is ready, record the idle time up to the next arrival.
      const nextArrivalTime = orderedProcesses[nextProcessIndex].arrivalTime;
      workflow.push({
        processId: "IDLE",
        startTime: currentTime,
        endTime: nextArrivalTime,
        duration: nextArrivalTime - currentTime,
        remainingTime: "—"
      });
      currentTime = nextArrivalTime;
      continue;
    }

    const process = readyQueue.shift();
    const startTime = currentTime;
    const duration = Math.min(timeQuantum, process.remainingTime);

    currentTime += duration;
    process.remainingTime -= duration;
    workflow.push({
      processId: process.id,
      startTime,
      endTime: currentTime,
      duration,
      remainingTime: process.remainingTime
    });

    // Enqueue new arrivals before returning an unfinished process to the queue.
    while (
      nextProcessIndex < orderedProcesses.length
      && orderedProcesses[nextProcessIndex].arrivalTime <= currentTime
    ) {
      readyQueue.push(orderedProcesses[nextProcessIndex]);
      nextProcessIndex += 1;
    }

    if (process.remainingTime === 0) {
      process.completionTime = currentTime;
      completedCount += 1;
    } else {
      readyQueue.push(process);
    }
  }

  const results = orderedProcesses.map((process) => {
    const turnaroundTime = process.completionTime - process.arrivalTime;
    return {
      ...process,
      turnaroundTime,
      waitingTime: turnaroundTime - process.burstTime
    };
  });

  return { workflow, results };
}

function formatTime(value) {
  return Number(value.toFixed(2)).toString();
}

function renderResults(workflow, results) {
  const resultsBody = document.querySelector("#process-results");
  const workflowBody = document.querySelector("#workflow-results");
  const ganttChart = document.querySelector("#gantt-chart");
  const ganttLegend = document.querySelector("#gantt-legend");

  resultsBody.replaceChildren();
  workflowBody.replaceChildren();
  ganttChart.replaceChildren();
  ganttLegend.replaceChildren();

  results.forEach((process) => {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.append(createProcessBadge(process.id));
    row.append(idCell);
    [
      process.arrivalTime,
      process.burstTime,
      process.completionTime,
      process.turnaroundTime,
      process.waitingTime
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = formatTime(value);
      row.append(cell);
    });
    resultsBody.append(row);
  });

  const usedProcessIds = [...new Set(
    workflow.filter((turn) => turn.processId !== "IDLE").map((turn) => turn.processId)
  )];

  usedProcessIds.forEach((id) => {
    const legendItem = document.createElement("span");
    const swatch = document.createElement("span");
    const label = document.createElement("span");
    legendItem.className = "legend-item";
    swatch.className = "legend-swatch";
    label.textContent = id;
    setProcessColor(swatch, id);
    legendItem.append(swatch, label);
    ganttLegend.append(legendItem);
  });

  if (workflow.some((turn) => turn.processId === "IDLE")) {
    const legendItem = document.createElement("span");
    const swatch = document.createElement("span");
    const label = document.createElement("span");
    legendItem.className = "legend-item";
    swatch.className = "legend-swatch is-idle";
    label.textContent = "IDLE";
    legendItem.append(swatch, label);
    ganttLegend.append(legendItem);
  }

  workflow.forEach((turn, index) => {
    const row = document.createElement("tr");
    const stepCell = document.createElement("td");
    const processCell = document.createElement("td");
    stepCell.textContent = index + 1;
    if (turn.processId === "IDLE") {
      const idleBadge = document.createElement("span");
      idleBadge.className = "process-badge is-idle";
      idleBadge.textContent = "IDLE";
      processCell.append(idleBadge);
    } else {
      processCell.append(createProcessBadge(turn.processId));
    }

    row.append(stepCell, processCell);
    [
      turn.startTime,
      turn.endTime,
      turn.duration,
      turn.remainingTime
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = typeof value === "number" ? formatTime(value) : value;
      row.append(cell);
    });
    workflowBody.append(row);

    const ganttItem = document.createElement("div");
    ganttItem.className = "gantt-item";
    ganttItem.style.width = `${Math.max(turn.duration * 48, 56)}px`;

    const block = document.createElement("div");
    block.className = "gantt-block";
    block.textContent = turn.processId;
    if (turn.processId === "IDLE") {
      block.classList.add("is-idle");
    } else {
      setProcessColor(block, turn.processId);
    }

    const timeLabels = document.createElement("div");
    timeLabels.className = "gantt-times";
    const startLabel = document.createElement("span");
    const endLabel = document.createElement("span");
    if (index === 0) {
      startLabel.textContent = formatTime(turn.startTime);
      timeLabels.append(startLabel);
    }
    endLabel.textContent = formatTime(turn.endTime);
    timeLabels.append(endLabel);

    ganttItem.append(block, timeLabels);
    ganttChart.append(ganttItem);
  });

  const totalTurnaroundTime = results.reduce((sum, process) => sum + process.turnaroundTime, 0);
  const totalWaitingTime = results.reduce((sum, process) => sum + process.waitingTime, 0);
  const totalExecutionTime = workflow
    .filter((turn) => turn.processId !== "IDLE")
    .reduce((sum, turn) => sum + turn.duration, 0);

  document.querySelector("#total-processes").textContent = results.length;
  document.querySelector("#total-execution-time").textContent = formatTime(totalExecutionTime);
  document.querySelector("#average-tat").textContent =
    formatTime(totalTurnaroundTime / results.length);
  document.querySelector("#average-wt").textContent =
    formatTime(totalWaitingTime / results.length);
  resultsSection.hidden = false;
}

document.querySelector("#process-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const arrivalTime = getValidTimeValue(arrivalInput, "Arrival Time", true);
    const burstTime = getValidTimeValue(burstInput, "Burst Time");
    addProcess(arrivalTime, burstTime);
    arrivalInput.value = "";
    burstInput.value = "";
    arrivalInput.focus();
    showMessage("");
  } catch (error) {
    showMessage(error.message);
  }
});

document.querySelector("#generate-schedule").addEventListener("click", () => {
  try {
    const timeQuantum = getValidTimeValue(quantumInput, "Time Quantum");
    if (processes.length === 0) {
      throw new Error("Add at least one process before generating a schedule.");
    }

    const schedule = generateSchedule(timeQuantum);
    renderResults(schedule.workflow, schedule.results);
    showMessage("");
  } catch (error) {
    resultsSection.hidden = true;
    showMessage(error.message);
  }
});

document.querySelector("#load-example").addEventListener("click", () => {
  processes = [];
  nextProcessNumber = 1;
  [
    { arrivalTime: 0, burstTime: 5 },
    { arrivalTime: 1, burstTime: 4 },
    { arrivalTime: 2, burstTime: 2 },
    { arrivalTime: 8, burstTime: 3 }
  ].forEach((process) => addProcess(process.arrivalTime, process.burstTime));
  quantumInput.value = 2;
  resultsSection.hidden = true;
  showMessage("");
});

quantumInput.addEventListener("input", () => {
  resultsSection.hidden = true;
});

renderProcessList();
