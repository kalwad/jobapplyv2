# Issue-ledger layout correction

The unchanged strict validator originally reports four KI-0131 duplicate/invalid Severity/State fields. General Update rules were positioned after an actual issue header and before the next numeric issue, so those fields belonged to that parsed section. Move the exact general rules/template block above the first actual issue. Every old line remains, and factual additions preserve historical outcomes. No parser, assertion or test is changed.

The retained original validator closes1/four violations; the corrected validator closes0/45groups. Both direct children reaped/groupsABSENT/no signals. Exact before/after/diff/raw outcomes are retained. This documents a metadata-layout correction and grants no package, native or release acceptance.
