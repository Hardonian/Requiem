/**
 * CLI Snapshot Tests
 * 
 * Validates CLI output structure and key behaviors.
 * Run with: pnpm --filter @requiem/cli test
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '../../dist/cli/src/cli.js');

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

describe('CLI Snapshots', () => {
  describe('help', () => {
    it('should display help with all command categories', () => {
      const { stdout, exitCode } = runCLI(['--help']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Requiem CLI');
      expect(stdout).toContain('Control Plane for AI Systems');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('run <name>');
      expect(stdout).toContain('verify <hash>');
      expect(stdout).toContain('doctor');
    });

    it('should display version', () => {
      const { stdout, exitCode } = runCLI(['--version']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Requiem CLI');
      expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  describe('doctor', () => {
    it('should output valid JSON with --json flag', () => {
      const { stdout, exitCode } = runCLI(['doctor', '--json']);
      
      // Should parse as JSON even if unhealthy
      const result = JSON.parse(stdout);
      
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(Array.isArray(result.checks)).toBe(true);
      
      // Check structure of individual checks
      if (result.checks.length > 0) {
        const check = result.checks[0];
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('message');
        expect(['ok', 'warn', 'fail']).toContain(check.status);
      }
    });

    it('should include runtime versions check', () => {
      const { stdout } = runCLI(['doctor', '--json']);
      const result = JSON.parse(stdout);
      
      const runtimeCheck = result.checks.find((c: { name: string }) => c.name === 'Runtime Versions');
      expect(runtimeCheck).toBeDefined();
      expect(runtimeCheck?.status).toBe('ok');
      expect(runtimeCheck?.message).toContain('Node');
    });
  });

  describe('stats', () => {
    it('should output valid JSON structure', () => {
      const { stdout, exitCode } = runCLI(['stats', '--json']);
      
      const result = JSON.parse(stdout);
      
      expect(result).toHaveProperty('total_decisions');
      expect(result).toHaveProperty('avg_latency_ms');
      expect(result).toHaveProperty('total_cost_usd');
      expect(result).toHaveProperty('success_rate');
      
      expect(typeof result.total_decisions).toBe('number');
      expect(typeof result.avg_latency_ms).toBe('number');
    });
  });

  describe('status', () => {
    it('should output valid JSON structure', () => {
      const { stdout, exitCode } = runCLI(['status', '--json']);
      
      const result = JSON.parse(stdout);
      
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('nodeVersion');
      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('determinism');
      expect(result).toHaveProperty('policy');
      expect(result).toHaveProperty('replay');
      
      expect(typeof result.healthy).toBe('boolean');
      expect(result.determinism).toHaveProperty('enforced');
      expect(result.policy).toHaveProperty('enforced');
    });
  });

  describe('error handling', () => {
    it('should handle unknown commands gracefully', () => {
      const { stdout, stderr, exitCode } = runCLI(['unknown-command']);
      
      expect(exitCode).toBe(1);
      const output = stdout || stderr;
      expect(output).toContain('Unknown command');
    });

    it('should output JSON errors with --json flag', () => {
      const { stdout, exitCode } = runCLI(['unknown-command', '--json']);
      
      expect(exitCode).toBe(1);
      
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result).toHaveProperty('traceId');
    });
  });

  describe('init', () => {
    it('should display help', () => {
      const { stdout, exitCode } = runCLI(['init', '--help']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Initialize');
      expect(stdout).toContain('--tenant');
      expect(stdout).toContain('--force');
    });
  });
});
