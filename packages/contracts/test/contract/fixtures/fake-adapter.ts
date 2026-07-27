const mode = process.argv[2];

if (mode === "nonzero") {
  process.exitCode = 7;
} else if (mode === "timeout") {
  setTimeout(() => {
    process.stdout.write("{}\n");
  }, 10_000);
} else if (mode === "malformed") {
  process.stdout.write("{not-json\n");
} else if (mode === "stderr") {
  process.stderr.write("hostile adapter diagnostic\n");
  process.stdout.write("{}\n");
} else {
  process.exitCode = 2;
}
