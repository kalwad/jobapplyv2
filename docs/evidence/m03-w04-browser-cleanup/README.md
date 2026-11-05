# Browser cleanup correction during W04 validation

The fixture now captures only its freshly launched persistent Browser, keeps Context.close first so trace/snapshot hooks run, preserves every close error, and settles its owned Browser before awaiting asynchronous profile removal with the unchanged ten retries/100ms delay. Unexpected disconnection before cleanup remains an error. No TargetClosed normalization, extra test retry, private SDK access, user-profile inspection or broader process cleanup was added.

Default browser, visual and the two controlled suites use distinct children of the uploaded test-results directory. Actual negative tests reproduce missing retirement and erased artifacts; their corrected runs retain the failure marker and trace through every later suite. Original28 assertions remain,16 additive cases bring focused coverage to44. The exact earlier research case passes once locally. This is local evidence; the earlier Windows failure remains failed and actual Windows validation is still required.

The finite reviewed archive contains333 safe regular members (6,449,975 compressed bytes), SHA256680d87a96197e6fca1470c9bcf80aea12c818ab707d394cf07b17f13342c2e2f. It preserves source, actual10-case RED/44GREEN,355 Python contract checks, real trace/snapshot/screenshot/error-context bytes, corrected same-root visual retention, original failures and independent review465e8e22. No video/HAR bytes are claimed. The reported1132ms replay duration includes fixture work, not a separately measured body interval.

Canonical integration caught an additional strict mypy error for the command table's unannotated empty lists. Its original failed log remains; a single local tuple/list type annotation changes no values, assertions, IDs or control flow. The complete typecheck then passes, alongside44 root unit tests, changed TypeScript lint and2 root artifact/registry tests. The independent review verifies the annotation and its actual rerun within the same report.

Current canonical full verification and native Windows validation remain pending. KI-0108 stays IN_PROGRESS and no milestone/platform/release acceptance follows from this correction.
