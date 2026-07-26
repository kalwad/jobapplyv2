# services/job-index-api

Late-stage public-job service (docs/MASTER_IMPLEMENTATION_SPEC.md §5.1,
§5.3): serves normalized public job metadata and incremental sync to the
local app. By design it stores no private profile, resume, answer, or
application data (§5.4 boundary 7, REQ-PLAT-010).

This directory is intentionally empty apart from this README. The service
is implemented in phase G (M31+), and it joins the Python workspace in
`pyproject.toml` at that point. Creating code here earlier would violate
owner decision OD-005 (aggregation is deliberately late-stage work).
