// Lab-owned node:test reporter. Counts come from runner events in the parent process, so text a
// candidate prints (for example a fake "# pass 5" line) cannot change them.
export default async function* countReporter(source) {
  const leaf = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  let summary = null;
  for await (const event of source) {
    if (event.type === "test:summary" && event.data.file === undefined) summary = event.data.counts;
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const d = event.data;
    if (d.details?.type === "suite") continue;
    leaf.tests++;
    if (d.skip !== undefined) leaf.skipped++;
    else if (d.todo !== undefined) leaf.todo++;
    else if (event.type === "test:pass") leaf.pass++;
    else if (d.details?.error?.failureType === "cancelledByParent") leaf.cancelled++;
    else leaf.fail++;
  }
  yield JSON.stringify({ leaf, summary }) + "\n";
}
