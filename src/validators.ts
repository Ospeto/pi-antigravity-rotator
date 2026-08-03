import {
	MAX_QUOTA_POLL_INTERVAL_MS,
	MIN_QUOTA_POLL_INTERVAL_MS,
	type AccountConfig,
	type AccountTier,
	type Config,
} from "./types.js";

export interface ValidationResult<T> {
	ok: boolean;
	value?: T;
	errors: string[];
}

function ok<T>(value: T): ValidationResult<T> {
	return { ok: true, value, errors: [] };
}

function fail<T>(errors: string[]): ValidationResult<T> {
	return { ok: false, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
	return isNonNegativeNumber(value) && Number.isInteger(value);
}

export function normalizeAccountConfig(raw: Record<string, unknown>): AccountConfig {
	const email = typeof raw.email === "string" ? raw.email.trim() : "";
	const refreshToken = (
		typeof raw.refreshToken === "string"
			? raw.refreshToken
			: typeof raw.refresh_token === "string"
			? raw.refresh_token
			: ""
	).trim();
	const projectId = (
		typeof raw.projectId === "string"
			? raw.projectId
			: typeof raw.project_id === "string"
			? raw.project_id
			: "default-project"
	).trim();
	const label = (
		typeof raw.label === "string" && raw.label.trim()
			? raw.label.trim()
			: email ? email.split("@")[0] : "Account"
	).trim();

	const rawType = raw.type ?? raw.account_type;
	const type = rawType === "pro" || rawType === "free" ? (rawType as "pro" | "free") : undefined;
	const tier = typeof raw.tier === "string" && ["ultra", "pro", "plus", "free", "unknown"].includes(raw.tier)
		? (raw.tier as AccountTier)
		: undefined;

	const normalized: AccountConfig = {
		email,
		refreshToken,
		projectId: projectId || "default-project",
		label,
	};
	if (type) normalized.type = type;
	if (tier) normalized.tier = tier;
	if (typeof raw.familyManager === "boolean") normalized.familyManager = raw.familyManager;
	if (raw.projectSource === "google" || raw.projectSource === "manual") normalized.projectSource = raw.projectSource;

	return normalized;
}

export function validateAccountConfig(value: unknown, path = "account"): ValidationResult<AccountConfig> {
	if (!isRecord(value)) return fail([`${path} must be an object`]);
	const norm = normalizeAccountConfig(value);
	const errors: string[] = [];

	if (!isNonEmptyString(norm.email)) errors.push(`${path}.email must be a non-empty string`);
	if (!isNonEmptyString(norm.refreshToken)) errors.push(`${path}.refreshToken must be a non-empty string`);
	if (!isNonEmptyString(norm.projectId)) errors.push(`${path}.projectId must be a non-empty string`);
	if (value.label !== undefined && typeof value.label !== "string") errors.push(`${path}.label must be a string`);
	if (value.type !== undefined && value.type !== "pro" && value.type !== "free" && value.account_type !== "pro" && value.account_type !== "free") errors.push(`${path}.type must be "pro" or "free"`);
	if (value.tier !== undefined && !["ultra", "pro", "plus", "free", "unknown"].includes(String(value.tier))) {
		errors.push(`${path}.tier must be "ultra", "pro", "plus", "free", or "unknown"`);
	}
	if (value.familyManager !== undefined && typeof value.familyManager !== "boolean") errors.push(`${path}.familyManager must be a boolean`);

	return errors.length > 0 ? fail(errors) : ok(norm);
}

export function validateConfig(value: unknown): ValidationResult<Config> {
	if (value === null || value === undefined) return fail(["config must be an object or array"]);

	let rawCandidate = value;
	if (isRecord(rawCandidate) && "config" in rawCandidate && rawCandidate.config && (typeof rawCandidate.config === "object" || Array.isArray(rawCandidate.config))) {
		rawCandidate = rawCandidate.config;
	}

	let target: Record<string, unknown>;
	if (Array.isArray(rawCandidate)) {
		target = { accounts: rawCandidate };
	} else if (isRecord(rawCandidate)) {
		if (!("accounts" in rawCandidate) && (isNonEmptyString(rawCandidate.email) || isNonEmptyString(rawCandidate.refresh_token) || isNonEmptyString(rawCandidate.refreshToken))) {
			target = { accounts: [rawCandidate] };
		} else {
			target = { ...rawCandidate };
		}
	} else {
		return fail(["config must be an object or array"]);
	}

	const errors: string[] = [];

	if (!Array.isArray(target.accounts)) {
		errors.push("config.accounts must be an array");
	} else {
		const normalizedAccounts: AccountConfig[] = [];
		target.accounts.forEach((account, index) => {
			if (!isRecord(account)) {
				errors.push(`config.accounts[${index}] must be an object`);
				return;
			}
			const result = validateAccountConfig(account, `config.accounts[${index}]`);
			if (result.ok && result.value) {
				normalizedAccounts.push(result.value);
			} else {
				errors.push(...result.errors);
			}
		});
		target.accounts = normalizedAccounts;
	}

	if (target.proxyPort !== undefined && !isPositiveNumber(target.proxyPort)) errors.push("config.proxyPort must be a positive number");
	if (target.bindHost !== undefined && !isNonEmptyString(target.bindHost)) errors.push("config.bindHost must be a non-empty string");
	if (target.routingPolicy !== undefined && !["timer-first", "tier-first", "quota-first", "hybrid"].includes(String(target.routingPolicy))) {
		errors.push('config.routingPolicy must be "timer-first", "tier-first", "quota-first", or "hybrid"');
	}
	if (target.requestsPerRotation !== undefined && !isPositiveNumber(target.requestsPerRotation)) errors.push("config.requestsPerRotation must be a positive number");
	if (target.rotateOnQuotaDrop !== undefined && !isNonNegativeNumber(target.rotateOnQuotaDrop)) errors.push("config.rotateOnQuotaDrop must be a non-negative number");
	if (target.quotaPollIntervalMs !== undefined && (!isPositiveNumber(target.quotaPollIntervalMs) || target.quotaPollIntervalMs < MIN_QUOTA_POLL_INTERVAL_MS || target.quotaPollIntervalMs > MAX_QUOTA_POLL_INTERVAL_MS)) {
		errors.push(`config.quotaPollIntervalMs must be between ${MIN_QUOTA_POLL_INTERVAL_MS} and ${MAX_QUOTA_POLL_INTERVAL_MS} ms`);
	}
	if (target.proSlots !== undefined && !isPositiveNumber(target.proSlots)) errors.push("config.proSlots must be a positive number");
	if (target.maxConcurrentRequestsPerAccount !== undefined && !isPositiveNumber(target.maxConcurrentRequestsPerAccount)) errors.push("config.maxConcurrentRequestsPerAccount must be a positive number");
	if (target.maxConcurrentRequestsPerProjectModel !== undefined && !isPositiveNumber(target.maxConcurrentRequestsPerProjectModel)) errors.push("config.maxConcurrentRequestsPerProjectModel must be a positive number");
	if (target.projectCircuitBreaker429Threshold !== undefined && !isPositiveNumber(target.projectCircuitBreaker429Threshold)) errors.push("config.projectCircuitBreaker429Threshold must be a positive number");
	if (target.projectCircuitBreakerWindowMs !== undefined && !isPositiveNumber(target.projectCircuitBreakerWindowMs)) errors.push("config.projectCircuitBreakerWindowMs must be a positive number");
	if (target.projectCircuitBreakerCooldownMs !== undefined && !isPositiveNumber(target.projectCircuitBreakerCooldownMs)) errors.push("config.projectCircuitBreakerCooldownMs must be a positive number");
	if (target.modelCircuitBreaker429Threshold !== undefined && !isPositiveNumber(target.modelCircuitBreaker429Threshold)) errors.push("config.modelCircuitBreaker429Threshold must be a positive number");
	if (target.modelCircuitBreakerCooldownMs !== undefined && !isPositiveNumber(target.modelCircuitBreakerCooldownMs)) errors.push("config.modelCircuitBreakerCooldownMs must be a positive number");
	if (target.dailyAccountSlowRequests !== undefined && !isPositiveNumber(target.dailyAccountSlowRequests)) errors.push("config.dailyAccountSlowRequests must be a positive number");
	if (target.dailyAccountStopRequests !== undefined && !isPositiveNumber(target.dailyAccountStopRequests)) errors.push("config.dailyAccountStopRequests must be a positive number");
	if (target.dailyProjectSlowRequests !== undefined && !isPositiveNumber(target.dailyProjectSlowRequests)) errors.push("config.dailyProjectSlowRequests must be a positive number");
	if (target.dailyProjectStopRequests !== undefined && !isPositiveNumber(target.dailyProjectStopRequests)) errors.push("config.dailyProjectStopRequests must be a positive number");
	if (target.slowModeJitterMinMs !== undefined && !isNonNegativeNumber(target.slowModeJitterMinMs)) errors.push("config.slowModeJitterMinMs must be a non-negative number");
	if (target.slowModeJitterMaxMs !== undefined && !isNonNegativeNumber(target.slowModeJitterMaxMs)) errors.push("config.slowModeJitterMaxMs must be a non-negative number");
	if (target.protectivePauseMs !== undefined && !isNonNegativeNumber(target.protectivePauseMs)) errors.push("config.protectivePauseMs must be a non-negative number");
	if (target.useRequestCountRotationWhenQuotaUnknownOnly !== undefined && typeof target.useRequestCountRotationWhenQuotaUnknownOnly !== "boolean") {
		errors.push("config.useRequestCountRotationWhenQuotaUnknownOnly must be a boolean");
	}
	if (target.tokenBucketEnabled !== undefined && typeof target.tokenBucketEnabled !== "boolean") {
		errors.push("config.tokenBucketEnabled must be a boolean");
	}
	if (target.tokenBucketMaxTokens !== undefined && !isPositiveNumber(target.tokenBucketMaxTokens)) {
		errors.push("config.tokenBucketMaxTokens must be a positive number");
	}
	if (target.tokenBucketRefillPerMinute !== undefined && !isPositiveNumber(target.tokenBucketRefillPerMinute)) {
		errors.push("config.tokenBucketRefillPerMinute must be a positive number");
	}
	if (target.tokenBucketInitialTokens !== undefined && !isNonNegativeNumber(target.tokenBucketInitialTokens)) {
		errors.push("config.tokenBucketInitialTokens must be a non-negative number");
	}
	if (target.streamRecoveryMaxRetries !== undefined && !isNonNegativeInteger(target.streamRecoveryMaxRetries)) {
		errors.push("config.streamRecoveryMaxRetries must be a non-negative integer");
	}
	if (target.modelSpecs !== undefined) {
		if (!isRecord(target.modelSpecs)) {
			errors.push("config.modelSpecs must be an object when provided");
		} else {
			for (const [key, spec] of Object.entries(target.modelSpecs)) {
				if (!isRecord(spec)) {
					errors.push(`config.modelSpecs.${key} must be an object`);
					continue;
				}
				if (spec.maxOutputTokens !== undefined && !isPositiveNumber(spec.maxOutputTokens)) {
					errors.push(`config.modelSpecs.${key}.maxOutputTokens must be a positive number`);
				}
				if (spec.thinkingBudget !== undefined && (typeof spec.thinkingBudget !== "number" || !Number.isFinite(spec.thinkingBudget))) {
					errors.push(`config.modelSpecs.${key}.thinkingBudget must be a number`);
				}
				if (spec.isThinking !== undefined && typeof spec.isThinking !== "boolean") {
					errors.push(`config.modelSpecs.${key}.isThinking must be a boolean`);
				}
			}
		}
	}
	if (target.modelAliases !== undefined) {
		if (!isRecord(target.modelAliases)) {
			errors.push("config.modelAliases must be an object when provided");
		} else {
			for (const [from, to] of Object.entries(target.modelAliases)) {
				if (typeof from !== "string" || from.length === 0) {
					errors.push("config.modelAliases keys must be non-empty strings");
					break;
				}
				if (typeof to !== "string" || to.length === 0) {
					errors.push(`config.modelAliases.${from} must be a non-empty string`);
				}
			}
		}
	}

	return errors.length > 0 ? fail(errors) : ok(target as unknown as Config);
}

export interface MinimalProxyRequestBody {
	model: string;
	request: unknown;
	project?: string;
	requestType?: string;
	userAgent?: string;
	requestId?: string;
	[key: string]: unknown;
}

export function validateProxyRequestBody(value: unknown): ValidationResult<MinimalProxyRequestBody> {
	if (!isRecord(value)) return fail(["request body must be a JSON object"]);
	const errors: string[] = [];

	if (!isNonEmptyString(value.model)) errors.push("body.model must be a non-empty string");
	if (!("request" in value)) errors.push("body.request is required");
	if (value.project !== undefined && typeof value.project !== "string") errors.push("body.project must be a string when provided");
	if (value.requestType !== undefined && typeof value.requestType !== "string") errors.push("body.requestType must be a string when provided");
	if (value.userAgent !== undefined && typeof value.userAgent !== "string") errors.push("body.userAgent must be a string when provided");
	if (value.requestId !== undefined && typeof value.requestId !== "string") errors.push("body.requestId must be a string when provided");

	return errors.length > 0 ? fail(errors) : ok(value as MinimalProxyRequestBody);
}

export function formatValidationErrors(errors: string[]): string {
	return errors.join("; ");
}
