/**
 * TypeScript Fallback for Decision Algorithms
 * Pure TypeScript implementation of decision algorithms
 */

export interface DecisionInput {
  actions: string[];
  states: string[];
  outcomes: Record<string, Record<string, number>>;
  algorithm?: "minimax_regret" | "maximin" | "weighted_sum" | "softmax" | "hurwicz" | "laplace" | "starr" | "savage" | "wald" | "hodges_lehmann" | "brown_robinson" | "nash" | "pareto" | "epsilon_contamination" | "minimax" | "topsis";
  weights?: Record<string, number>;
  strict?: boolean;
  temperature?: number;
  optimism?: number;
  confidence?: number;
  iterations?: number;
  epsilon?: number;
  seed?: number;
}

export interface DecisionOutput {
  recommended_action: string;
  ranking: string[];
  trace: {
    algorithm: string;
    computedAt: string;
    scores: Record<string, number>;
    processingTimeMs: number;
  };
}

export function evaluateDecisionFallback(input: DecisionInput): DecisionOutput {
  const startTime = Date.now();
  
  // Handle weights normalization or validation
  let effectiveWeights = input.weights;

  if (input.weights) {
    const sum = Object.values(input.weights).reduce((a, b) => a + b, 0);
    
    if (input.strict) {
      if (Math.abs(sum - 1.0) > 1e-9) {
        throw new Error(`Weights must sum to 1.0 (got ${sum})`);
      }
      for (const v of Object.values(input.weights)) {
        if (v < 0.0 || v > 1.0) {
          throw new Error(`Probability value must be between 0.0 and 1.0 (got ${v})`);
        }
      }
    } else if (sum !== 0 && Math.abs(sum - 1.0) > 1e-9) {
      // Normalize if not strict
      effectiveWeights = {};
      for (const [k, v] of Object.entries(input.weights)) {
        effectiveWeights[k] = v / sum;
      }
    }
  }
  
  // Create effective input with potentially normalized weights
  const effectiveInput = { ...input, weights: effectiveWeights };

  // Validate outcomes
  for (const action of effectiveInput.actions) {
    for (const state of effectiveInput.states) {
      const val = effectiveInput.outcomes[action]?.[state];
      if (val !== undefined && !Number.isFinite(val)) {
        throw new Error("Utility value cannot be NaN or Infinity");
      }
    }
  }

  const algorithm = input.algorithm || "minimax_regret";
  let result: DecisionOutput;

  switch (algorithm) {
    case "maximin":
    case "wald":
    case "minimax":
      result = maximinFallback(effectiveInput);
      break;
    case "weighted_sum":
      result = weightedSumFallback(effectiveInput);
      break;
    case "softmax":
      result = softmaxFallback(effectiveInput);
      break;
    case "hurwicz":
      result = hurwiczFallback(effectiveInput);
      break;
    case "laplace":
      result = laplaceFallback(effectiveInput);
      break;
    case "starr":
      result = starrFallback(effectiveInput);
      break;
    case "hodges_lehmann":
      result = hodgesLehmannFallback(effectiveInput);
      break;
    case "brown_robinson":
      result = brownRobinsonFallback(effectiveInput);
      break;
    case "nash":
      result = nashFallback(effectiveInput);
      break;
    case "pareto":
      result = paretoFallback(effectiveInput);
      break;
    case "epsilon_contamination":
      result = epsilonContaminationFallback(effectiveInput);
      break;
    case "topsis":
      result = topsisFallback(effectiveInput);
      break;
    case "minimax_regret":
    default:
      result = minimaxRegretFallback(effectiveInput);
      break;
  }

  // Add processing time to trace
  result.trace.processingTimeMs = Date.now() - startTime;
  
  return result;
}

function minimaxRegretFallback(input: DecisionInput): DecisionOutput {
  const { actions, states, outcomes } = input;
  
  // Calculate regret matrix
  const regrets: Record<string, Record<string, number>> = {};
  
  for (const state of states) {
    // Find best outcome for this state
    let bestOutcome = -Infinity;
    for (const action of actions) {
      const val = outcomes[action]?.[state] ?? 0;
      bestOutcome = Math.max(bestOutcome, val);
    }
    
    // Calculate regret for each action
    for (const action of actions) {
      if (!regrets[action]) regrets[action] = {};
      const val = outcomes[action]?.[state] ?? 0;
      regrets[action][state] = bestOutcome - val;
    }
  }
  
  // Find maximum regret for each action
  const maxRegrets: Record<string, number> = {};
  for (const action of actions) {
    maxRegrets[action] = Math.max(...Object.values(regrets[action]));
  }
  
  // Find action with minimum maximum regret
  const ranking = actions.slice().sort((a, b) => maxRegrets[a] - maxRegrets[b]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "minimax_regret",
      computedAt: new Date().toISOString(),
      scores: maxRegrets,
      processingTimeMs: 0,
    },
  };
}

function maximinFallback(input: DecisionInput): DecisionOutput {
  const { actions, states, outcomes } = input;
  
  const minOutcomes: Record<string, number> = {};
  for (const action of actions) {
    const values = states.map(s => outcomes[action]?.[s] ?? 0);
    minOutcomes[action] = Math.min(...values);
  }
  
  const ranking = actions.slice().sort((a, b) => minOutcomes[b] - minOutcomes[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "maximin",
      computedAt: new Date().toISOString(),
      scores: minOutcomes,
      processingTimeMs: 0,
    },
  };
}

function weightedSumFallback(input: DecisionInput): DecisionOutput {
  const { actions, states, outcomes, weights } = input;
  
  // Use uniform weights if not provided
  const uniformWeight = 1 / states.length;
  const effectiveWeights: Record<string, number> = weights || {};
  for (const state of states) {
    if (!(state in effectiveWeights)) {
      effectiveWeights[state] = uniformWeight;
    }
  }
  
  const scores: Record<string, number> = {};
  for (const action of actions) {
    let sum = 0;
    for (const state of states) {
      sum += (outcomes[action]?.[state] ?? 0) * effectiveWeights[state];
    }
    scores[action] = sum;
  }
  
  const ranking = actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "weighted_sum",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

function softmaxFallback(input: DecisionInput): DecisionOutput {
  const { actions, states, outcomes, temperature = 1.0 } = input;
  
  // Calculate average outcome for each action
  const avgOutcomes: Record<string, number> = {};
  for (const action of actions) {
    const values = states.map(s => outcomes[action]?.[s] ?? 0);
    avgOutcomes[action] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  // Apply softmax
  const expValues: Record<string, number> = {};
  let sumExp = 0;
  for (const action of actions) {
    const expVal = Math.exp(avgOutcomes[action] / temperature);
    expValues[action] = expVal;
    sumExp += expVal;
  }
  
  const scores: Record<string, number> = {};
  for (const action of actions) {
    scores[action] = expValues[action] / sumExp;
  }
  
  const ranking = actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "softmax",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

function hurwiczFallback(input: DecisionInput): DecisionOutput {
  const { actions, states, outcomes, optimism = 0.5 } = input;
  
  const scores: Record<string, number> = {};
  for (const action of actions) {
    const values = states.map(s => outcomes[action]?.[s] ?? 0);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    scores[action] = optimism * maxVal + (1 - optimism) * minVal;
  }
  
  const ranking = actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hurwicz",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

function laplaceFallback(input: DecisionInput): DecisionOutput {
  // Laplace is just equal-weighted sum
  return weightedSumFallback({ ...input, weights: undefined });
}

function starrFallback(input: DecisionInput): DecisionOutput {
  // Starr's rule: weighted sum with partial information
  // Similar to Laplace for this simplified implementation
  return weightedSumFallback(input);
}

function hodgesLehmannFallback(input: DecisionInput): DecisionOutput {
  // Hodges-Lehmann combines minimax regret and expected value
  // Simplified: use weighted average of minimax regret and Laplace scores
  const minimaxResult = minimaxRegretFallback(input);
  const laplaceResult = laplaceFallback(input);
  
  const scores: Record<string, number> = {};
  for (const action of input.actions) {
    const minimaxScore = minimaxResult.trace.scores[action] || 0;
    const laplaceScore = (laplaceResult.trace.scores[action] || 0);
    // Combine (lower minimax regret is better, higher laplace is better)
    scores[action] = laplaceScore - minimaxScore;
  }
  
  const ranking = input.actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "hodges_lehmann",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

function brownRobinsonFallback(input: DecisionInput): DecisionOutput {
  // Iterative algorithm for zero-sum games
  // Simplified: use weighted sum as approximation
  return weightedSumFallback(input);
}

function nashFallback(input: DecisionInput): DecisionOutput {
  // Nash equilibrium for non-cooperative games
  // Simplified: use softmax as approximation
  return softmaxFallback(input);
}

function paretoFallback(input: DecisionInput): DecisionOutput {
  // Pareto optimality
  // Simplified: rank by number of states where action is optimal
  const { actions, states, outcomes } = input;
  
  const paretoScores: Record<string, number> = {};
  for (const action of actions) {
    let score = 0;
    for (const state of states) {
      const val = outcomes[action]?.[state] ?? 0;
      const isOptimal = actions.every(a => (outcomes[a]?.[state] ?? 0) <= val);
      if (isOptimal) score++;
    }
    paretoScores[action] = score;
  }
  
  const ranking = actions.slice().sort((a, b) => paretoScores[b] - paretoScores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "pareto",
      computedAt: new Date().toISOString(),
      scores: paretoScores,
      processingTimeMs: 0,
    },
  };
}

function epsilonContaminationFallback(input: DecisionInput): DecisionOutput {
  const { epsilon = 0.1 } = input;
  // Mixture of best estimate and uniform distribution
  const laplaceResult = laplaceFallback(input);
  const minimaxResult = maximinFallback(input);
  
  const scores: Record<string, number> = {};
  for (const action of input.actions) {
    const laplaceScore = laplaceResult.trace.scores[action] || 0;
    const minimaxScore = minimaxResult.trace.scores[action] || 0;
    scores[action] = (1 - epsilon) * laplaceScore + epsilon * minimaxScore;
  }
  
  const ranking = input.actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "epsilon_contamination",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

function topsisFallback(input: DecisionInput): DecisionOutput {
  // TOPSIS: Technique for Order Preference by Similarity to Ideal Solution
  const { actions, states, outcomes } = input;
  
  // Calculate normalized scores
  const normalized: Record<string, Record<string, number>> = {};
  for (const state of states) {
    let sumSquares = 0;
    for (const action of actions) {
      const val = outcomes[action]?.[state] ?? 0;
      sumSquares += val * val;
    }
    const norm = Math.sqrt(sumSquares);
    
    for (const action of actions) {
      if (!normalized[action]) normalized[action] = {};
      const val = outcomes[action]?.[state] ?? 0;
      normalized[action][state] = norm > 0 ? val / norm : 0;
    }
  }
  
  // Find ideal and anti-ideal solutions
  const ideal: Record<string, number> = {};
  const antiIdeal: Record<string, number> = {};
  for (const state of states) {
    const values = actions.map(a => normalized[a][state]);
    ideal[state] = Math.max(...values);
    antiIdeal[state] = Math.min(...values);
  }
  
  // Calculate distances
  const scores: Record<string, number> = {};
  for (const action of actions) {
    let distToIdeal = 0;
    let distToAntiIdeal = 0;
    for (const state of states) {
      distToIdeal += Math.pow(normalized[action][state] - ideal[state], 2);
      distToAntiIdeal += Math.pow(normalized[action][state] - antiIdeal[state], 2);
    }
    distToIdeal = Math.sqrt(distToIdeal);
    distToAntiIdeal = Math.sqrt(distToAntiIdeal);
    scores[action] = distToAntiIdeal / (distToIdeal + distToAntiIdeal);
  }
  
  const ranking = actions.slice().sort((a, b) => scores[b] - scores[a]);
  
  return {
    recommended_action: ranking[0],
    ranking,
    trace: {
      algorithm: "topsis",
      computedAt: new Date().toISOString(),
      scores,
      processingTimeMs: 0,
    },
  };
}

