import { updateCorpusManifest } from "./corpus-loader.ts";

if (
  process.argv.length !== 3 ||
  process.argv[2] !== "--update-corpus-manifest"
) {
  process.stderr.write(
    "usage: node update-corpus-manifest.ts --update-corpus-manifest\n",
  );
  process.exitCode = 2;
} else {
  updateCorpusManifest();
  process.stdout.write("updated M01-W05 corpus manifest\n");
}
