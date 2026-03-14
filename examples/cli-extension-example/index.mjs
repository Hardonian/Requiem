const extensionCommands = {
  'ext:capabilities': () => ({
    extension: 'example-cli-extension',
    capabilities: ['inspect', 'report'],
    deterministic: true,
  }),
};

function run(command) {
  if (!(command in extensionCommands)) {
    return { ok: false, error: 'unknown_command', command };
  }
  return { ok: true, result: extensionCommands[command]() };
}

const command = process.argv[2] ?? 'ext:capabilities';
console.log(JSON.stringify(run(command), null, 2));
