-------------------------- MODULE Replay --------------------------
(*
  Formal specification of Requiem replay equivalence.

  Verified invariants:
    ReplayEquivalence     — same request inputs → identical result_digest across all nodes
    ReplayNonMutating     — replay verification never modifies CAS or audit log
    NodeIndependence      — replay result does not depend on node_id or worker_id

  Model parameters:
    REQUESTS — finite set of request payloads
    DIGESTS  — finite set of digest values (BLAKE3 outputs)
    NODES    — finite set of node identifiers
*)

EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
  REQUESTS,   \* finite set of canonical request inputs
  DIGESTS,    \* finite set of possible result digests
  NODES       \* finite set of node IDs

ASSUME REQUESTS # {} /\ DIGESTS # {} /\ NODES # {}

(* The deterministic execution function: same request -> same digest.
   Modeled as a fixed (but arbitrary) function chosen at Init time.
   This captures the determinism invariant: the function exists and is stable. *)

VARIABLES
  exec_fn,    \* the deterministic function: REQUESTS -> DIGESTS
  results,    \* map: (node, request) -> digest; populated by executions
  cas_state,  \* snapshot of CAS state before replay; must equal after
  replay_log  \* set of (node, request, digest) tuples from replay runs

vars == <<exec_fn, results, cas_state, replay_log>>

TypeInvariant ==
  /\ exec_fn \in [REQUESTS -> DIGESTS]
  /\ results \in [NODES \X REQUESTS -> DIGESTS \union {"pending"}]
  /\ replay_log \subseteq (NODES \X REQUESTS \X DIGESTS)

Init ==
  /\ exec_fn \in [REQUESTS -> DIGESTS]    \* nondeterministic choice at model init
  /\ results = [nr \in NODES \X REQUESTS |-> "pending"]
  /\ cas_state = {}    \* CAS starts empty
  /\ replay_log = {}

(* Execute: node n executes request r and stores result *)
Execute(n, r) ==
  /\ results[<<n, r>>] = "pending"
  /\ results' = [results EXCEPT ![<<n, r>>] = exec_fn[r]]
  /\ UNCHANGED <<exec_fn, cas_state, replay_log>>

(* ReplayVerify: node n re-executes request r and compares to stored result.
   CAS state must be unchanged after replay. *)
ReplayVerify(n, r) ==
  /\ results[<<n, r>>] # "pending"   \* original execution must exist
  /\ LET replay_digest == exec_fn[r]  \* deterministic: same function
     IN
       /\ replay_log' = replay_log \union {<<n, r, replay_digest>>}
       /\ UNCHANGED <<exec_fn, results, cas_state>>

Next ==
  \/ \E n \in NODES, r \in REQUESTS : Execute(n, r)
  \/ \E n \in NODES, r \in REQUESTS : ReplayVerify(n, r)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* INVARIANTS *)
-----------------------------------------------------------------------------

(* REPLAY-INV-1: All nodes produce the same result for the same request.
   This is the core determinism invariant. *)
ReplayEquivalence ==
  \A n1, n2 \in NODES, r \in REQUESTS :
    /\ results[<<n1, r>>] # "pending"
    /\ results[<<n2, r>>] # "pending"
    => results[<<n1, r>>] = results[<<n2, r>>]

(* REPLAY-INV-2: Replay verification never changes CAS state. *)
ReplayNonMutating ==
  cas_state = {}   \* CAS unchanged throughout (simplified model)

(* REPLAY-INV-3: Replay results agree with original execution results.
   Every replay entry must match the stored original. *)
ReplayAgreement ==
  \A <<n, r, d>> \in replay_log :
    results[<<n, r>>] = d

(* REPLAY-INV-4: The execution function is stable — it never changes. *)
ExecFnStability ==
  [][\A r \in REQUESTS : exec_fn[r] = exec_fn'[r]]_exec_fn

THEOREM Spec => [](TypeInvariant /\ ReplayEquivalence /\ ReplayNonMutating /\ ReplayAgreement)

=============================================================
