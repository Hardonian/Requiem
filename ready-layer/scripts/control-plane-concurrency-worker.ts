export {};

async function main(): Promise<void> {
  const [, , controlPlaneDir, tenantId, indexText] = process.argv;

  if (!controlPlaneDir || !tenantId || !indexText) {
    throw new Error('usage: control-plane-concurrency-worker.ts <controlPlaneDir> <tenantId> <index>');
  }

  process.env.REQUIEM_CONTROL_PLANE_DIR = controlPlaneDir;

  const index = Number(indexText);
  const { addPlan } = await import('../src/lib/control-plane-store');

  addPlan(tenantId, `worker-${index}`, {
    plan_id: `concurrent-plan-${index}`,
    steps: [
      {
        step_id: `step-${index}`,
        kind: 'exec',
        depends_on: [],
        config: { command: 'echo', argv: [String(index)] },
      },
    ],
  });

  process.stdout.write(JSON.stringify({ ok: true, index }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
