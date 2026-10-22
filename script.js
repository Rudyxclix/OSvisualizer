const arrivalInput = document.querySelector("#arrival-time");
const burstInput = document.querySelector("#burst-time");
const quantumInput = document.querySelector("#time-quantum");
const processList = document.querySelector("#process-list");
const formMessage = document.querySelector("#form-message");
const resultsSection = document.querySelector("#results");

const colors = [
  "#cfe3ff",
  "#d8f1e5",
  "#ffe6bf",
  "#eadfff",
  "#ffdce5",
  "#c9edf1",
  "#f5e4b8",
  "#dce7c2"
];

let processes = [];
let nextProcessNumber = 1;

function showMessage(message) {
  formMessage.textContent = message;
}

function renderProcessList() {
  processList.replaceChildren();

  if (processes.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No processes added yet. Add a process or load the example.";
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

    idCell.textContent = process.id;
    arrivalCell.textContent = process.arrivalTime;
    burstCell.textContent = process.burstTime;
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${process.id}`);
    removeButton.addEventListener("click", () => {
      processes = processes.filter((item) => item.id !== process.id);
      renderProcessList();
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

function renderResults(workflow, results) {
  const resultsBody = document.querySelector("#process-results");
  const workflowBody = document.querySelector("#workflow-results");
  const ganttChart = document.querySelector("#gantt-chart");

  resultsBody.replaceChildren();
  workflowBody.replaceChildren();
  ganttChart.replaceChildren();

  results.forEach((process) => {
    const row = document.createElement("tr");
    [
      process.id,
      process.arrivalTime,
      process.burstTime,
      process.completionTime,
      process.turnaroundTime,
      process.waitingTime
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    resultsBody.append(row);
  });

  workflow.forEach((turn, index) => {
    const row = document.createElement("tr");
    [
      index + 1,
      turn.processId,
      turn.startTime,
      turn.endTime,
      turn.duration,
      turn.remainingTime
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    workflowBody.append(row);

    const ganttItem = document.createElement("div");
    ganttItem.className = "gantt-item";
    ganttItem.style.width = `${Math.max(turn.duration * 48, 50)}px`;

    const block = document.createElement("div");
    block.className = "gantt-block";
    block.textContent = turn.processId;
    block.style.backgroundColor = turn.processId === "IDLE"
      ? "#e8edf3"
      : colors[results.findIndex((process) => process.id === turn.processId) % colors.length];

    const timeLabels = document.createElement("div");
    timeLabels.className = "gantt-times";
    const startLabel = document.createElement("span");
    const endLabel = document.createElement("span");
    startLabel.textContent = turn.startTime;
    endLabel.textContent = turn.endTime;
    timeLabels.append(startLabel, endLabel);

    ganttItem.append(block, timeLabels);
    ganttChart.append(ganttItem);
  });

  const totalTurnaroundTime = results.reduce((sum, process) => sum + process.turnaroundTime, 0);
  const totalWaitingTime = results.reduce((sum, process) => sum + process.waitingTime, 0);
  document.querySelector("#average-tat").textContent =
    (totalTurnaroundTime / results.length).toFixed(2);
  document.querySelector("#average-wt").textContent =
    (totalWaitingTime / results.length).toFixed(2);
  resultsSection.hidden = false;
}

document.querySelector("#add-process").addEventListener("click", () => {
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
  showMessage("");
});

renderProcessList();
