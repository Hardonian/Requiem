import {
  addOutcome,
  addRule,
  computeErrors,
  evaluateRules,
  generateCrossTabs,
  generateErrorBands,
  learningDashboard,
  logPrediction,
  proposeWeightsActivation,
  trainCalibration,
  trainWeights,
  evaluateMoeGateFromHistory,
} from '../lib/learning-suite.js';

function flag(args: string[], name: string, fallback?: string): string {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1] as string;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing ${name}`);
}

function maybeFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1] as string;
  return undefined;
}

function out(json: boolean, data: unknown): void {
  process.stdout.write(json ? `${JSON.stringify(data, null, 2)}\n` : `${JSON.stringify(data)}\n`);
}

function tenant(): string {
  return process.env.REQUIEM_TENANT_ID || process.env.RL_TENANT_ID || 'default-tenant';
}

export async function runLearning(subcommand: string, args: string[], opts: { json: boolean }): Promise<number> {
  switch (subcommand) {
    case 'predict': {
      if (args[0] !== 'log') throw new Error('Usage: rl learning predict log --model <id> --prediction <n> --confidence <n> --feature k=v');
      const featureArg = maybeFlag(args, '--feature') || 'x=1';
      const [k, v] = featureArg.split('=');
      const result = logPrediction({
        tenant_id: tenant(),
        trace_id: flag(args, '--trace', 'trace-manual'),
        run_id: flag(args, '--run', 'run-manual'),
        model_id: flag(args, '--model', 'model-default'),
        model_version: flag(args, '--model-version', 'v1'),
        features: { [k || 'x']: Number(v || '1') },
        weights_version: flag(args, '--weights-version', 'w-default'),
        calibration_id: maybeFlag(args, '--calibration'),
        prediction: Number(flag(args, '--prediction', '0.5')),
        confidence: Number(flag(args, '--confidence', '0.5')),
      });
      out(opts.json, result);
      return 0;
    }

    case 'outcome': {
      if (args[0] !== 'add') throw new Error('Usage: rl learning outcome add --prediction <cas> --actual <n>');
      const result = addOutcome({
        tenant_id: tenant(),
        prediction_event_cas: flag(args, '--prediction'),
        trace_id: flag(args, '--trace', 'trace-manual'),
        actual: Number(flag(args, '--actual')),
        outcome_source: flag(args, '--source', 'manual'),
        outcome_refs: maybeFlag(args, '--ref') ? [flag(args, '--ref')] : [],
      });
      out(opts.json, result);
      return 0;
    }

    case 'errors': {
      if (args[0] !== 'compute') throw new Error('Usage: rl learning errors compute');
      out(opts.json, computeErrors(tenant()));
      return 0;
    }

    case 'train': {
      if (args[0] === 'weights') {
        const result = trainWeights({
          tenant_id: tenant(),
          model_id: flag(args, '--model', 'model-default'),
          dataset_cas: flag(args, '--dataset'),
          seed: Number(flag(args, '--seed', '42')),
          learning_rate: Number(flag(args, '--lr', '0.05')),
          max_iters: Number(flag(args, '--iters', '50')),
          regularization: Number(flag(args, '--reg', '0')),
        });
        out(opts.json, result);
        return 0;
      }
      throw new Error('Usage: rl learning train weights --dataset <cas>');
    }

    case 'calibrate': {
      const result = trainCalibration({
        tenant_id: tenant(),
        model_id: flag(args, '--model', 'model-default'),
        dataset_cas: flag(args, '--dataset'),
        method: flag(args, '--method', 'platt') as 'platt' | 'isotonic' | 'bayesian_beta' | 'none',
        seed: Number(flag(args, '--seed', '42')),
      });
      out(opts.json, result);
      return 0;
    }

    case 'crosstabs': {
      const result = generateCrossTabs(tenant(), flag(args, '--window', '30d'));
      out(opts.json, result);
      return 0;
    }

    case 'error-bands': {
      const result = generateErrorBands(tenant(), flag(args, '--model', 'model-default'), Number(flag(args, '--mc', '200')), Number(flag(args, '--seed', '42')));
      out(opts.json, result);
      return 0;
    }

    case 'rules': {
      const action = args[0] || 'list';
      if (action === 'list') {
        const result = evaluateRules(tenant(), flag(args, '--model', 'model-default'));
        out(opts.json, result);
        return 0;
      }
      if (action === 'add') {
        const result = addRule({
          tenant_id: tenant(),
          model_id: flag(args, '--model', 'model-default'),
          drift_threshold: Number(flag(args, '--drift', '0.2')),
          miscalibration_threshold: Number(flag(args, '--miscalibration', '0.2')),
          feature_bias_threshold: Number(flag(args, '--bias', '0.2')),
          repeated_failure_threshold: Number(flag(args, '--failures', '3')),
          action: flag(args, '--action', 'require_human_gate') as 'reweight_features' | 'clamp_confidence' | 'route_safe_model' | 'require_human_gate' | 'open_correction_proposal',
          severity: flag(args, '--severity', 'medium') as 'low' | 'medium' | 'high' | 'critical',
          enabled: flag(args, '--enabled', 'true') !== 'false',
        });
        out(opts.json, result);
        return 0;
      }
      throw new Error('Usage: rl learning rules list|add');
    }

    case 'propose-weights-activation': {
      const modelId = flag(args, '--model', 'model-default');
      const weightsCas = flag(args, '--weights');
      const gate = evaluateMoeGateFromHistory({
        tenant_id: tenant(),
        model_id: modelId,
        candidate_weights_cas: weightsCas,
        seed: Number(flag(args, '--seed', '42')),
        holdout_percent: Number(flag(args, '--holdout', '20')),
        mc_runs: Number(flag(args, '--mc', '200')),
        min_improvement: Number(flag(args, '--min-improvement', '0')),
      });
      const result = proposeWeightsActivation({
        tenant_id: tenant(),
        model_id: modelId,
        weights_cas: weightsCas,
        calibration_cas: maybeFlag(args, '--calibration'),
        proof_refs: [flag(args, '--proof', 'cas:proof')],
        replay_summary_cas: gate.replayCas,
        mc_bands_cas: flag(args, '--bands', 'cas:bands'),
        moe_gate_cas: gate.gateCas,
        visual_refs: [gate.visuals.reliability_svg_cas, gate.visuals.error_band_svg_cas, gate.visuals.html_report_cas],
      });
      out(opts.json, { ...result, moe_gate: gate.gate, visuals: gate.visuals });
      return 0;
    }

    case 'dashboard': {
      out(opts.json, learningDashboard(tenant()));
      return 0;
    }

    default:
      throw new Error('Usage: rl learning <predict|outcome|errors|calibrate|train|crosstabs|error-bands|rules|propose-weights-activation|dashboard> ...');
  }
}
