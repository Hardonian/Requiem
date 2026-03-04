import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __resetProofDependencyConfigForTests, enforceProofDependencies, ProofDependencyError } from '../../packages/cli/src/lib/proof-dependency.js';


function resetProofConfig(): void {
  delete process.env.REQUIEM_SIMULATION_ENABLED;
  delete process.env.REQUIEM_REQUIRED_PROOFS;
  __resetProofDependencyConfigForTests();
}

const baseProofs = {
  determinism: 'cas:det',
  integrity: 'cas:int',
  trust: 'cas:trust',
  economics: 'cas:econ',
};

describe('Proof dependency enforcement', () => {
  it('fails with 409 when determinism proof is missing', () => {
    resetProofConfig();
    assert.throws(
      () => enforceProofDependencies({ proofs: { ...baseProofs, determinism: undefined } }),
      (error: unknown) => {
        assert(error instanceof ProofDependencyError);
        assert.equal(error.problem.status, 409);
        assert.deepEqual(error.problem.reasons, ['determinism']);
        return true;
      },
    );
  });

  it('fails with 409 when integrity proof is missing', () => {
    resetProofConfig();
    assert.throws(
      () => enforceProofDependencies({ proofs: { ...baseProofs, integrity: undefined } }),
      (error: unknown) => {
        assert(error instanceof ProofDependencyError);
        assert.deepEqual(error.problem.reasons, ['integrity']);
        return true;
      },
    );
  });

  it('fails with 409 when trust proof is missing', () => {
    resetProofConfig();
    assert.throws(
      () => enforceProofDependencies({ proofs: { ...baseProofs, trust: undefined } }),
      (error: unknown) => {
        assert(error instanceof ProofDependencyError);
        assert.deepEqual(error.problem.reasons, ['trust']);
        return true;
      },
    );
  });

  it('fails with 409 when economics proof is missing', () => {
    resetProofConfig();
    assert.throws(
      () => enforceProofDependencies({ proofs: { ...baseProofs, economics: undefined } }),
      (error: unknown) => {
        assert(error instanceof ProofDependencyError);
        assert.deepEqual(error.problem.reasons, ['economics']);
        return true;
      },
    );
  });

  it('fails with 409 when simulation proof is enabled and missing', () => {
    resetProofConfig();
    process.env.REQUIEM_SIMULATION_ENABLED = 'true';
    process.env.REQUIEM_REQUIRED_PROOFS = 'determinism,integrity,trust,economics,simulation';

    assert.throws(
      () => enforceProofDependencies({ proofs: { ...baseProofs } }),
      (error: unknown) => {
        assert(error instanceof ProofDependencyError);
        assert.deepEqual(error.problem.reasons, ['simulation']);
        return true;
      },
    );

    resetProofConfig();
  });
});
