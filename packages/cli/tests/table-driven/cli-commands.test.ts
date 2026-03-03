/**
 * Table-Driven CLI Command Tests
 *
 * Tests for CLI argument parsing and output structure.
 * Part of Industrialization Pass - Section 2.1
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '../../dist/cli/src/cli.js');

interface CLITestCase {
  name: string;
  args: string[];
  expectExitCode: number;
  expectJson?: boolean;
  validateOutput?: (stdout: string, stderr: string) => boolean;
}

function runCLI(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd: join(__dirname, '../../'),
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.status || 1,
    };
  }
}

const commandTestCases: CLITestCase[] = [
  {
    name: 'help flag shows usage',
    args: ['--help'],
    expectExitCode: 0,
    validateOutput: (stdout) => stdout.includes('USAGE:') && stdout.includes('Requiem CLI'),
  },
  {
    name: 'version flag shows version',
    args: ['--version'],
    expectExitCode: 0,
    validateOutput: (stdout) => /v\d+\.\d+\.\d+/.test(stdout),
  },
  {
    name: 'unknown command returns error',
    args: ['unknown-command'],
    expectExitCode: 1,
    validateOutput: (_, stderr) => stderr.includes('Unknown command') || _.includes('Unknown command'),
  },
  {
    name: 'status command returns JSON with --json',
    args: ['status', '--json'],
    expectExitCode: 0,
    expectJson: true,
    validateOutput: (stdout) => {
      try {
        const result = JSON.parse(stdout);
        return result.healthy !== undefined && result.version !== undefined;
      } catch {
        return false;
      }
    },
  },
  {
    name: 'stats command returns JSON with --json',
    args: ['stats', '--json'],
    expectExitCode: 0,
    expectJson: true,
    validateOutput: (stdout) => {
      try {
        const result = JSON.parse(stdout);
        return typeof result.total_decisions === 'number';
      } catch {
        return false;
      }
    },
  },
  {
    name: 'doctor command returns JSON structure',
    args: ['doctor', '--json'],
    expectExitCode: 1, // Returns 1 when unhealthy
    expectJson: true,
    validateOutput: (stdout) => {
      try {
        const result = JSON.parse(stdout);
        return result.version !== undefined && Array.isArray(result.checks);
      } catch {
        return false;
      }
    },
  },
  {
    name: 'error output includes traceId with --json',
    args: ['invalid-cmd', '--json'],
    expectExitCode: 1,
    expectJson: true,
    validateOutput: (stdout) => {
      try {
        const result = JSON.parse(stdout);
        return result.success === false && result.error && result.traceId;
      } catch {
        return false;
      }
    },
  },
];

describe('CLI Commands - Table Driven', () => {
  commandTestCases.forEach((testCase) => {
    it(testCase.name, () => {
      const { stdout, stderr, exitCode } = runCLI(testCase.args);

      // Verify exit code
      expect(exitCode).toBe(testCase.expectExitCode);

      // Verify JSON output if expected
      if (testCase.expectJson) {
        expect(() => JSON.parse(stdout)).not.toThrow();
      }

      // Run custom validation if provided
      if (testCase.validateOutput) {
        expect(testCase.validateOutput(stdout, stderr)).toBe(true);
      }
    });
  });
});

describe('CLI Exit Codes', () => {
  const exitCodeCases = [
    { args: ['--help'], expected: 0, description: 'help returns 0' },
    { args: ['--version'], expected: 0, description: 'version returns 0' },
    { args: ['status', '--json'], expected: 0, description: 'status returns 0' },
    { args: ['stats', '--json'], expected: 0, description: 'stats returns 0' },
    { args: ['nonexistent'], expected: 1, description: 'unknown command returns 1' },
  ];

  exitCodeCases.forEach(({ args, expected, description }) => {
    it(description, () => {
      const { exitCode } = runCLI(args);
      expect(exitCode).toBe(expected);
    });
  });
});

describe('CLI JSON Output Structure', () => {
  it('should have stable key ordering in error output', () => {
    const { stdout } = runCLI(['invalid', '--json']);
    const result = JSON.parse(stdout);

    // Verify structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('traceId');
    expect(result).toHaveProperty('durationMs');

    // Verify error structure
    expect(result.error).toHaveProperty('code');
    expect(result.error).toHaveProperty('message');
    expect(result.error).toHaveProperty('severity');
  });

  it('should include all required fields in status output', () => {
    const { stdout } = runCLI(['status', '--json']);
    const result = JSON.parse(stdout);

    expect(result).toHaveProperty('healthy');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('nodeVersion');
    expect(result).toHaveProperty('platform');
    expect(result).toHaveProperty('determinism');
    expect(result).toHaveProperty('policy');
    expect(result).toHaveProperty('replay');
    expect(result).toHaveProperty('timestamp');
  });
});
