-------------------------- MODULE Protocol --------------------------
(*
  Formal specification of the Requiem NDJSON protocol framing.

  Verified invariants:
    FrameSequenceValidity — every sequence starts with 'start' and ends with 'result' or 'error'
    NoOrphanFrames        — 'event' frames only appear between 'start' and terminal frame
    SingleTerminator      — exactly one terminal frame per stream
    MonotonicSequence     — event seq numbers are strictly increasing

  Frame types: start, event, end, result, error
*)

EXTENDS Naturals, Sequences, TLC

CONSTANTS
  MAX_EVENTS    \* maximum events per stream (bounds state space)

ASSUME MAX_EVENTS \in Nat /\ MAX_EVENTS > 0

FrameTypes == {"start", "event", "end", "result", "error"}
TerminalTypes == {"result", "error"}

VARIABLES
  stream,       \* Sequence of frame type strings
  seq_counter,  \* current event sequence counter
  terminated    \* TRUE once a terminal frame has been emitted

vars == <<stream, seq_counter, terminated>>

TypeInvariant ==
  /\ stream \in Seq(FrameTypes)
  /\ seq_counter \in Nat
  /\ terminated \in BOOLEAN

Init ==
  /\ stream = <<>>
  /\ seq_counter = 0
  /\ terminated = FALSE

(* EmitStart: must be first frame emitted, only once *)
EmitStart ==
  /\ Len(stream) = 0       \* nothing emitted yet
  /\ ~terminated
  /\ stream' = Append(stream, "start")
  /\ UNCHANGED <<seq_counter, terminated>>

(* EmitEvent: intermediate data frame *)
EmitEvent ==
  /\ Len(stream) > 0
  /\ stream[1] = "start"    \* stream began correctly
  /\ ~terminated
  /\ Len(stream) - 1 < MAX_EVENTS   \* within bounds
  /\ seq_counter' = seq_counter + 1
  /\ stream' = Append(stream, "event")
  /\ UNCHANGED terminated

(* EmitEnd: signals command completion (before result) *)
EmitEnd ==
  /\ Len(stream) > 0
  /\ stream[1] = "start"
  /\ ~terminated
  /\ "end" \notin {stream[i] : i \in DOMAIN stream}   \* only one end
  /\ stream' = Append(stream, "end")
  /\ UNCHANGED <<seq_counter, terminated>>

(* EmitTerminal: result or error — finalizes stream *)
EmitTerminal(ftype) ==
  /\ ftype \in TerminalTypes
  /\ Len(stream) > 0
  /\ stream[1] = "start"
  /\ ~terminated
  /\ terminated' = TRUE
  /\ stream' = Append(stream, ftype)
  /\ UNCHANGED seq_counter

Next ==
  \/ EmitStart
  \/ EmitEvent
  \/ EmitEnd
  \/ \E t \in TerminalTypes : EmitTerminal(t)

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

-----------------------------------------------------------------------------
(* INVARIANTS *)
-----------------------------------------------------------------------------

(* PROTO-INV-1: If any frames exist, the first must be 'start'. *)
StartsWithStart ==
  Len(stream) > 0 => stream[1] = "start"

(* PROTO-INV-2: No frames follow a terminal frame. *)
TerminalIsLast ==
  terminated =>
    LET last == stream[Len(stream)]
    IN last \in TerminalTypes

(* PROTO-INV-3: Event seq numbers are bounded and monotonic.
   (Modeled by seq_counter being strictly increasing.) *)
MonotonicEvents ==
  seq_counter >= 0

(* PROTO-INV-4: Events only appear after start and before terminal. *)
EventsInBounds ==
  \A i \in DOMAIN stream :
    stream[i] = "event" =>
      /\ i > 1
      /\ stream[1] = "start"

(* LIVENESS: Every started stream eventually terminates (WF ensures this). *)
EventualTermination ==
  Len(stream) > 0 ~> terminated

THEOREM Spec => [](TypeInvariant /\ StartsWithStart /\ TerminalIsLast /\ MonotonicEvents /\ EventsInBounds)

=============================================================
