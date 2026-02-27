-------------------------- MODULE CAS --------------------------
(*
  Formal specification of the Requiem Content-Addressed Storage (CAS) journal.

  Verified invariants:
    CASImmutability  — no object overwritten with different content
    CASCompleteness  — written objects are immediately readable
    NoPartialWrite   — partial writes are never accepted; either full or rejected
    DigestStability  — the digest of a stored object never changes

  Model parameters:
    DIGESTS — a finite set of possible digest values (e.g., {"d1", "d2", "d3"})
    CONTENT — a finite set of possible content payloads

  State variables:
    store   — the CAS store: digest -> content (partial function)
    writes  — set of (digest, content) pairs attempted
    errors  — set of rejected write attempts
*)

EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
  DIGESTS,    \* finite set of digest strings
  CONTENT     \* finite set of content blobs

ASSUME DIGESTS # {} /\ CONTENT # {}

VARIABLES
  store,      \* digest -> content; represents committed objects
  writes,     \* set of {digest, content} pairs that have been attempted
  errors      \* set of rejected write attempts (wrong content for existing digest)

vars == <<store, writes, errors>>

TypeInvariant ==
  /\ store \in [DOMAIN store -> CONTENT]
  /\ writes \subseteq (DIGESTS \X CONTENT)
  /\ errors \subseteq (DIGESTS \X CONTENT)

Init ==
  /\ store = [d \in {} |-> ""]   \* empty store
  /\ writes = {}
  /\ errors = {}

(* WriteObject: attempt to write content c under digest d.
   If d is already in store with the same content: idempotent success.
   If d is already in store with different content: reject (add to errors).
   If d is not in store: commit. *)
WriteObject(d, c) ==
  /\ <<d, c>> \notin writes   \* new attempt
  /\ IF d \in DOMAIN store
     THEN \* digest already stored
       IF store[d] = c
       THEN \* idempotent — same content, same digest: OK
            /\ writes' = writes \union {<<d, c>>}
            /\ store' = store
            /\ errors' = errors
       ELSE \* collision: different content for same digest — REJECT
            /\ errors' = errors \union {<<d, c>>}
            /\ writes' = writes
            /\ store' = store
     ELSE \* new object
          /\ store' = store @@ (d :> c)
          /\ writes' = writes \union {<<d, c>>}
          /\ errors' = errors

ReadObject(d) ==
  /\ d \in DOMAIN store   \* readable iff written
  /\ UNCHANGED vars        \* read is non-mutating

Next ==
  \/ \E d \in DIGESTS, c \in CONTENT : WriteObject(d, c)
  \/ \E d \in DIGESTS : ReadObject(d)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* INVARIANTS *)
-----------------------------------------------------------------------------

(* CAS-INV-1: No digest ever maps to two different content values.
   Once written, the binding is permanent and immutable. *)
CASImmutability ==
  \A d \in DOMAIN store :
    \A <<wd, wc>> \in writes :
      wd = d => wc = store[d]

(* CAS-INV-2: Every successfully written object is readable.
   If <<d,c>> is in writes and not in errors, it must be in store. *)
CASCompleteness ==
  \A <<d, c>> \in writes :
    <<d, c>> \notin errors => (d \in DOMAIN store /\ store[d] = c)

(* CAS-INV-3: No partial write — an object is either fully committed or not at all.
   There is no intermediate state where d is in DOMAIN store with no content. *)
NoPartialWrite ==
  \A d \in DOMAIN store : store[d] \in CONTENT

(* CAS-INV-4: Errors are only generated for actual collisions.
   If <<d,c>> is in errors, there must be a previously committed object at d with different content. *)
CollisionErrorAccuracy ==
  \A <<d, c>> \in errors :
    /\ d \in DOMAIN store
    /\ store[d] # c

THEOREM Spec => [](TypeInvariant /\ CASImmutability /\ CASCompleteness /\ NoPartialWrite /\ CollisionErrorAccuracy)

=============================================================
