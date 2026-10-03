import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { expect, test } from "vitest";

// Exercise the actual launch expressions, without a live DB or contaminating
// Vitest's own unhandled-rejection listener. Delay consumption across event-loop
// turns to model the advisory-lock observation / first transaction commit gap.
const source = ts.createSourceFile(
  "phase8e-rpc-authority.test.ts",
  readFileSync(resolve("tests/phase8e-rpc-authority.test.ts"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const launches: { line: number; expression: string }[] = [];
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer &&
      /^(loser|secondPending)$/.test(node.name.getText(source))) {
    launches.push({
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      expression: node.initializer.getText(source),
    });
  }
  ts.forEachChild(node, visit);
}
visit(source);

function probe(expression: string, reject: boolean) {
  const script = `
    const vm = require('node:vm');
    const unhandled = [];
    process.on('unhandledRejection', (error) => unhandled.push(error));
    process.on('rejectionHandled', () => {});
    const error = Object.assign(new Error('IDEMPOTENCY_KEY_REUSED'), {code:'23505'});
    const value = {rows:[{result:{replayed:true}}]};
    const context = {
      second: {query: () => new Promise((resolve, reject) => queueMicrotask(() =>
        ${reject ? "reject(error)" : "resolve(value)"}))},
      sql: 'test-sql', secondParams: [], key: 'key', alternateTarget: undefined,
      fixture: {sql:'test-sql', params: () => [], targetId:'target'},
      QUEST_CONCURRENT: 'quest', WISH_CONCURRENT: 'wish',
    };
    (async () => {
      const pending = vm.runInNewContext(${JSON.stringify(expression)}, context);
      await new Promise(setImmediate);
      await new Promise(setImmediate);
      let outcome;
      try {
        const result = await pending;
        outcome = Array.isArray(result) ? result[0] : {status:'fulfilled', value:result};
      } catch (reason) {
        outcome = {status:'rejected', reason};
      }
      process.stdout.write(JSON.stringify({
        unhandled:unhandled.length, status:outcome.status,
        sameReason:outcome.reason === error, sameValue:outcome.value === value,
        code:outcome.reason?.code, message:outcome.reason?.message,
      }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["--unhandled-rejections=throw", "-e", script], {
    encoding: "utf8", timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as {
    unhandled: number; status: string; sameReason: boolean; sameValue: boolean;
    code?: string; message?: string;
  };
}

test("covers all four concurrent query launches", () => {
  expect(launches).toHaveLength(4);
});

test("negative control detects the original late-handler rejection", () => {
  expect(probe("second.query(sql, secondParams)", true)).toMatchObject({
    unhandled: 1, status: "rejected", sameReason: true, code: "23505",
  });
});

test.each(launches)("launch at line $line observes early rejection without losing the error", ({ expression }) => {
  expect(probe(expression, true)).toMatchObject({
    unhandled: 0, status: "rejected", sameReason: true,
    code: "23505", message: "IDEMPOTENCY_KEY_REUSED",
  });
});

test.each(launches)("launch at line $line preserves successful replay", ({ expression }) => {
  expect(probe(expression, false)).toMatchObject({
    unhandled: 0, status: "fulfilled", sameValue: true,
  });
});
