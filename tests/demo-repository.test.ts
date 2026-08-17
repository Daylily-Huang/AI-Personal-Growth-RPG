import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DemoRepository } from "@/lib/store/demo-repository";

let tempDir: string;
let dbFile: string;
let repo: DemoRepository;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "growth-rpg-corr-"));
  dbFile = path.join(tempDir, "demo.json");
  process.env.DEMO_DB_PATH = dbFile;
  repo = new DemoRepository();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.DEMO_DB_PATH;
});

describe("DemoRepository corruption safety (Round4 item)", () => {
  test("missing file -> fresh empty world", () => {
    const db = repo.readDb();
    expect(db.activities).toEqual([]);
    expect(db.transactions).toEqual([]);
    expect(db.player.totalXp).toBe(0);
  });

  test("invalid JSON -> throws, original kept, backup created, NOT overwritten", () => {
    const garbage = "this is {{ not json";
    fs.writeFileSync(dbFile, garbage, "utf8");

    expect(() => repo.readDb()).toThrow();

    // Original file untouched.
    expect(fs.readFileSync(dbFile, "utf8")).toBe(garbage);

    // Backup exists.
    const backups = fs.readdirSync(tempDir).filter((f) => f.startsWith("demo.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tempDir, backups[0]), "utf8")).toBe(garbage);
  });

  test("invalid shape -> throws and keeps original", () => {
    fs.writeFileSync(dbFile, JSON.stringify({ version: 99, hello: "world" }), "utf8");

    expect(() => repo.readDb()).toThrow();

    const backups = fs.readdirSync(tempDir).filter((f) => f.startsWith("demo.json.corrupt-"));
    expect(backups).toHaveLength(1);
  });

  test("legacy v1 file without masteryVerifications is tolerated", async () => {
    fs.writeFileSync(
      dbFile,
      JSON.stringify({
        version: 1,
        activities: [],
        assessments: [],
        transactions: [],
        skills: {},
        skillEdges: [],
        player: { totalXp: 5, playerLevel: 1, energy: 70, focus: 70, momentum: 30 },
      }),
      "utf8",
    );

    const db = repo.readDb();
    expect(db.masteryVerifications).toEqual([]);
    expect(db.player.totalXp).toBe(5);

    const p = await repo.getPlayer();
    expect(p.totalXp).toBe(5);
  });
});
