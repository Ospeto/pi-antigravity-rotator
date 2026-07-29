import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupFile, readJsonFile, writeJsonFileAtomic, writeTextFileAtomic } from "../src/storage.js";

describe("storage helpers", () => {
	it("writes text atomically", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-rotator-storage-"));
		const file = join(dir, "state.json");
		await writeTextFileAtomic(file, "hello");
		assert.equal(existsSync(file), true);
	});

	it("writes and reads json", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-rotator-storage-"));
		const file = join(dir, "config.json");
		await writeJsonFileAtomic(file, { ok: true, n: 2 });
		assert.deepEqual(await readJsonFile(file), { ok: true, n: 2 });
	});

	it("creates backups for existing files", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-rotator-storage-"));
		const file = join(dir, "accounts.json");
		writeFileSync(file, '{"a":1}\n', "utf-8");
		const backup = await backupFile(file, "accounts");
		assert.ok(backup);
		assert.equal(existsSync(backup), true);
	});

	it("serializes concurrent atomic writes to the same path", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-rotator-storage-"));
		const file = join(dir, "state.json");
		await Promise.all([
			writeTextFileAtomic(file, "first"),
			writeTextFileAtomic(file, "second"),
		]);
		assert.equal(await readFile(file, "utf-8"), "second");
		assert.equal(existsSync(`${file}.tmp`), false);
	});
});
