import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAccountsPath } from "./paths.js";
import type { AccountConfig } from "./types.js";
import { writeJsonFileAtomic } from "./storage.js";
import {
	loadConfig,
	loadOrCreateAccountsConfig,
	saveAccountsConfig,
} from "./config-storage.js";
import { applyConfigDefaults, getDefaultConfig } from "./config-defaults.js";

import { validateConfig } from "./validators.js";

export {
	loadConfig,
	loadOrCreateAccountsConfig,
	saveAccountsConfig,
	applyConfigDefaults,
	getDefaultConfig,
};

const ACCOUNTS_FILE = getAccountsPath();
const PI_DIR = join(homedir(), ".pi", "agent");
const PI_MODELS_FILE = join(PI_DIR, "models.json");
const PI_AUTH_FILE = join(PI_DIR, "auth.json");
const TOKEN_USAGE_FILE = join(join(ACCOUNTS_FILE, ".."), "token-usage.json");

export function getTokenUsagePath(): string {
	return TOKEN_USAGE_FILE;
}

// Reasonable upper bounds on per-account fields. These are defensive
// limits to prevent a malicious or buggy caller from growing
// accounts.json without bound, which would slow every subsequent
// saveState. The numbers are well above any realistic real value.
export const MAX_EMAIL_LENGTH = 254; // RFC 5321
export const MAX_LABEL_LENGTH = 100;
export const MAX_PROJECT_ID_LENGTH = 100;
export const MAX_REFRESH_TOKEN_LENGTH = 4096;

function validateAccountConfigLengths(entry: AccountConfig): void {
	const checks: Array<[string, number]> = [
		["email", MAX_EMAIL_LENGTH],
		["label", MAX_LABEL_LENGTH],
		["projectId", MAX_PROJECT_ID_LENGTH],
		["refreshToken", MAX_REFRESH_TOKEN_LENGTH],
	];
	for (const [field, max] of checks) {
		const value = entry[field as keyof AccountConfig];
		if (typeof value === "string" && value.length > max) {
			throw new Error(
				`Account ${field} exceeds maximum length ${max} (got ${value.length}). ` +
					`This usually indicates a malformed input — refusing to write to accounts.json.`,
			);
		}
	}
}

export { validateAccountConfigLengths };

export async function addAccountToConfig(
	entry: AccountConfig,
): Promise<{ isNew: boolean }> {
	validateAccountConfigLengths(entry);
	const config = loadOrCreateAccountsConfig();
	const existing = config.accounts.findIndex((a) => a.email === entry.email);

	if (existing >= 0) {
		config.accounts[existing] = { ...config.accounts[existing], ...entry };
		await saveAccountsConfig(config);
		return { isNew: false };
	}

	config.accounts.push(entry);
	await saveAccountsConfig(config);
	return { isNew: true };
}

export async function importAccountsToConfig(
	input: unknown,
): Promise<{ added: number; updated: number; total: number }> {
	const validation = validateConfig(input);
	if (!validation.ok || !validation.value) {
		throw new Error(`Invalid accounts format: ${validation.errors.join("; ")}`);
	}
	let added = 0;
	let updated = 0;
	for (const account of validation.value.accounts) {
		const res = await addAccountToConfig(account);
		if (res.isNew) added++;
		else updated++;
	}
	await ensurePiModelsConfig();
	await ensurePiAuthConfig();
	return { added, updated, total: validation.value.accounts.length };
}

export async function removeAccountFromConfig(email: string): Promise<boolean> {
	const config = loadOrCreateAccountsConfig();
	const idx = config.accounts.findIndex((a) => a.email === email);
	if (idx < 0) return false;
	config.accounts.splice(idx, 1);
	await saveAccountsConfig(config);
	return true;
}

export async function ensurePiModelsConfig(): Promise<void> {
	await mkdir(PI_DIR, { recursive: true });

	let models: Record<string, unknown> = {};
	try {
		models = JSON.parse(await readFile(PI_MODELS_FILE, "utf-8"));
	} catch {
		// Missing or corrupted, will overwrite.
	}

	const providers = (models.providers || {}) as Record<
		string,
		Record<string, unknown>
	>;
	const antigravity = providers["google-antigravity"] || {};

	if (antigravity.baseUrl === "http://localhost:51200") {
		return;
	}

	antigravity.baseUrl = "http://localhost:51200";
	providers["google-antigravity"] = antigravity;
	models.providers = providers;

	await writeJsonFileAtomic(PI_MODELS_FILE, models);
	console.log(`  Updated ${PI_MODELS_FILE}`);
}

export async function ensurePiAuthConfig(): Promise<void> {
	await mkdir(PI_DIR, { recursive: true });

	let auth: Record<string, unknown> = {};
	try {
		auth = JSON.parse(await readFile(PI_AUTH_FILE, "utf-8"));
	} catch {
		// Missing or corrupted, will overwrite.
	}

	const existing = auth["google-antigravity"] as
		| Record<string, unknown>
		| undefined;
	if (existing?.type === "oauth" && existing?.refresh === "proxy-managed") {
		return;
	}

	auth["google-antigravity"] = {
		type: "oauth",
		refresh: "proxy-managed",
		access: "proxy-managed",
		expires: 32503680000000,
		projectId: "proxy-managed",
	};

	await writeJsonFileAtomic(PI_AUTH_FILE, auth);
	console.log(`  Updated ${PI_AUTH_FILE}`);
}
