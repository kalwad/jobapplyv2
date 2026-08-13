// Deliberately re-export the production entrypoint: this test variant executes
// the actual W07 content-script behavior, not a helper or a duplicate.
export { default } from "../../../../../entrypoints/feasibility.content.ts";
