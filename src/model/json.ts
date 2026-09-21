// What fits in a jsonb column: details of an ingest attempt (SPEC-006 N-9)
// and of an Alert. Lives in the model because both src/ingest/ and the pure
// engine of src/decide/ build them (SPEC-007 CA-2).
export type Json =
  | null
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json | undefined };

export type Details = { readonly [key: string]: Json | undefined };
