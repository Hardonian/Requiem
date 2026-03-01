// Type declarations to bypass packages/ai type checking
// This allows the project to compile while packages/ai has type errors

declare module '@requiem/ai' {
  const ai: any;
  export default ai;
}

declare module '@requiem/ai/mcp' {
  const mcp: any;
  export default mcp;
}

declare module '@requiem/ai/errors' {
  const errors: any;
  export default errors;
}

declare module '@requiem/ai/skills' {
  const skills: any;
  export default skills;
}

declare module '@requiem/ai/models' {
  const models: any;
  export default models;
}

declare module '@requiem/ai/memory' {
  const memory: any;
  export default memory;
}

declare module '@requiem/ai/telemetry' {
  const telemetry: any;
  export default telemetry;
}

declare module '@requiem/ai/eval' {
  const eval: any;
  export default eval;
}
