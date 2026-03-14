function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const queue = [];
const results = [];

function enqueue(workflow, input) {
  const id = `task_${queue.length + 1}`;
  queue.push({ id, workflow, input, status: 'pending' });
  return id;
}

function drain(workerId) {
  for (const task of queue) {
    if (task.status !== 'pending') continue;
    const output = { text: `${task.input.left}${task.input.right}` };
    const stateHash = stableStringify(output);
    task.status = 'done';
    task.workerId = workerId;
    results.push({ taskId: task.id, workerId, stateHash });
  }
}

enqueue('concat', { left: 'Re', right: 'quiem' });
drain('worker-demo');

console.log(JSON.stringify({ queue, results, deterministicReplayReady: true }, null, 2));
