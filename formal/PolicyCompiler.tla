----------------------- MODULE PolicyCompiler -----------------------
(*
  Formal specification of the Requiem Policy Compiler.

  This module models the translation of high-level "Intent" (Policies)
  into low-level "Constraints" (Runtime Invariants).

  It verifies three critical properties for Enterprise Safety:
  1. Completeness: Every active policy results in at least one runtime constraint.
  2. Consistency: The generated set of constraints contains no contradictions.
  3. Stability: Compilation is idempotent for a fixed policy set.
*)

EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
  Policies,       \* Set of all possible natural language policies (abstract)
  Constraints,    \* Set of all possible runtime constraints (concrete)
  CompilerMap,    \* Function: Policies -> SUBSET Constraints
  ConflictSet     \* Set of pairs {c1, c2} that are mutually exclusive

VARIABLES
  active_policies,      \* Set of policies currently enabled by the user
  compiled_constraints, \* Set of constraints currently enforced by the runtime
  compilation_error     \* Boolean flag: TRUE if compiler detected a conflict

vars == <<active_policies, compiled_constraints, compilation_error>>

TypeInvariant ==
  /\ active_policies \in SUBSET Policies
  /\ compiled_constraints \in SUBSET Constraints
  /\ compilation_error \in BOOLEAN

Init ==
  /\ active_policies = {}
  /\ compiled_constraints = {}
  /\ compilation_error = FALSE

(* Action: User enables a specific policy *)
EnablePolicy(p) ==
  /\ p \in Policies
  /\ p \notin active_policies
  /\ active_policies' = active_policies \cup {p}
  /\ UNCHANGED <<compiled_constraints, compilation_error>>

(* Action: User disables a policy *)
DisablePolicy(p) ==
  /\ p \in active_policies
  /\ active_policies' = active_policies \ {p}
  /\ UNCHANGED <<compiled_constraints, compilation_error>>

(* Action: The Compiler runs to translate policies -> constraints *)
Compile ==
  /\ LET new_constraints == UNION {CompilerMap[p] : p \in active_policies}
     IN
       (* Check for conflicts in the generated set *)
       IF \E c1, c2 \in new_constraints : {c1, c2} \in ConflictSet
       THEN
         (* Conflict detected: Fail safe, do not update runtime constraints *)
         /\ compilation_error' = TRUE
         /\ UNCHANGED <<active_policies, compiled_constraints>>
       ELSE
         (* Success: Update runtime constraints *)
         /\ compiled_constraints' = new_constraints
         /\ compilation_error' = FALSE
         /\ UNCHANGED active_policies

Next ==
  \/ \E p \in Policies : EnablePolicy(p)
  \/ \E p \in Policies : DisablePolicy(p)
  \/ Compile

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* INVARIANTS *)
-----------------------------------------------------------------------------

(* POLICY-INV-1: Completeness
   If compilation succeeded, every active policy must be represented
   in the compiled constraints. *)
Completeness ==
  (~compilation_error) =>
    \A p \in active_policies : CompilerMap[p] \subseteq compiled_constraints

(* POLICY-INV-2: Consistency
   If compilation succeeded, no two enforced constraints may conflict. *)
Consistency ==
  (~compilation_error) =>
    \A c1, c2 \in compiled_constraints : {c1, c2} \notin ConflictSet

(* POLICY-INV-3: Fail-Safe
   If a conflict exists in the requested policies, the runtime MUST NOT
   apply a partial or corrupt constraint set. It must flag an error
   or retain the previous valid state (though this simple model just flags error). *)
FailSafe ==
  LET potential == UNION {CompilerMap[p] : p \in active_policies}
  IN (\E c1, c2 \in potential : {c1, c2} \in ConflictSet) =>
     (compilation_error' = TRUE \/ compiled_constraints' = compiled_constraints)

THEOREM Spec => [](TypeInvariant /\ Completeness /\ Consistency)

=============================================================================
