import type {
	AxiosError,
	AxiosInstance,
	AxiosRequestConfig,
	AxiosStatic,
} from "../index";
import isRetryAllowed from "is-retry-allowed";

export interface AxiosRetryConfig {
	retries?: number;
	shouldResetTimeout?: boolean;
	retryCondition?: (error: AxiosError) => boolean | Promise<boolean>;
	retryDelay?: (retryCount: number, error: AxiosError) => number;
	onRetry?: (
		retryCount: number,
		error: AxiosError,
		requestConfig: AxiosRequestConfig,
	) => Promise<void> | void;
}

export interface AxiosRetryConfigExtended extends AxiosRetryConfig {
	retryCount?: number;
	lastRequestTime?: number;
}

export interface AxiosRetryReturn {
	requestInterceptorId: number;
	responseInterceptorId: number;
}

export interface AxiosRetry {
	(
		axiosInstance: AxiosStatic | AxiosInstance,
		axiosRetryConfig?: AxiosRetryConfig,
	): AxiosRetryReturn;
	isNetworkError(error: AxiosError): boolean;
	isRetryableError(error: AxiosError): boolean;
	isSafeRequestError(error: AxiosError): boolean;
	isIdempotentRequestError(error: AxiosError): boolean;
	isNetworkOrIdempotentRequestError(error: AxiosError): boolean;
	exponentialDelay(
		retryNumber?: number,
		error?: AxiosError,
		delayFactor?: number,
	): number;
}

const EXCLUDED_NETWORK_CODES = new Set(["ERR_CANCELED", "ECONNABORTED"]);
const SAFE_HTTP_METHODS = new Set(["get", "head", "options"]);
const IDEMPOTENT_HTTP_METHODS = new Set([
	"get",
	"head",
	"options",
	"put",
	"delete",
]);

function zeroDelay() {
	return 0;
}

export const DEFAULT_OPTIONS: Required<AxiosRetryConfig> = {
	retries: 3,
	shouldResetTimeout: false,
	retryCondition: isNetworkOrIdempotentRequestError,
	retryDelay: zeroDelay,
	onRetry: () => {},
};

type ResolvedRetryOptions = Required<AxiosRetryConfig> &
	AxiosRetryConfigExtended;

function normalizeMethod(method?: string) {
	return method?.toLowerCase();
}

function resolveRetryOptions(
	config: AxiosRequestConfig,
	defaults?: AxiosRetryConfig,
): ResolvedRetryOptions {
	const current = config.retry || {};
	return {
		...DEFAULT_OPTIONS,
		...(defaults || {}),
		...current,
		retryCount: current.retryCount ?? 0,
		lastRequestTime: current.lastRequestTime ?? Date.now(),
	};
}

function storeRetryOptions(
	config: AxiosRequestConfig,
	defaults?: AxiosRetryConfig,
): ResolvedRetryOptions {
	const state = resolveRetryOptions(config, defaults);
	config.retry = state;
	return state;
}

function canRetryAttempt(state: ResolvedRetryOptions) {
	return (state.retryCount || 0) < state.retries;
}

async function evaluateRetryCondition(
	state: ResolvedRetryOptions,
	error: AxiosError,
) {
	if (!canRetryAttempt(state)) {
		return false;
	}

	try {
		return (await state.retryCondition(error)) !== false;
	} catch {
		return false;
	}
}

function updateTimeoutForRetry(
	config: AxiosRequestConfig,
	state: ResolvedRetryOptions,
	delay: number,
	error: AxiosError,
) {
	if (state.shouldResetTimeout || !config.timeout || !state.lastRequestTime) {
		return null;
	}

	const elapsed = Date.now() - state.lastRequestTime;
	const remaining = config.timeout - elapsed - delay;
	if (remaining <= 0) {
		return error;
	}

	config.timeout = remaining;
	return null;
}

async function runRetryLifecycle(
	instance: AxiosStatic | AxiosInstance,
	config: AxiosRequestConfig,
	state: ResolvedRetryOptions,
	error: AxiosError,
) {
	state.retryCount = (state.retryCount || 0) + 1;
	state.lastRequestTime = Date.now();
	config.retry = state;

	const delay = state.retryDelay(state.retryCount, error);
	const timeoutError = updateTimeoutForRetry(config, state, delay, error);
	if (timeoutError) {
		throw timeoutError;
	}

	await state.onRetry(state.retryCount, error, config);

	return new Promise((resolve) => {
		setTimeout(() => resolve(instance(config)), delay);
	});
}

export function isNetworkError(error: AxiosError) {
	if (error.response || !error.code || EXCLUDED_NETWORK_CODES.has(error.code)) {
		return false;
	}

	return isRetryAllowed(error);
}

export function isRetryableError(error: AxiosError): boolean {
	if (error.code === "ECONNABORTED") {
		return false;
	}

	return (
		!error.response ||
		(error.response.status >= 500 && error.response.status <= 599)
	);
}

export function isSafeRequestError(error: AxiosError): boolean {
	const method = normalizeMethod(error.config?.method);
	return !!method && SAFE_HTTP_METHODS.has(method) && isRetryableError(error);
}

export function isIdempotentRequestError(error: AxiosError): boolean {
	const method = normalizeMethod(error.config?.method);
	return (
		!!method && IDEMPOTENT_HTTP_METHODS.has(method) && isRetryableError(error)
	);
}

export function isNetworkOrIdempotentRequestError(error: AxiosError): boolean {
	return isNetworkError(error) || isIdempotentRequestError(error);
}

export function exponentialDelay(
	retryNumber = 0,
	_error: AxiosError | undefined = undefined,
	delayFactor = 100,
): number {
	const delay = 2 ** retryNumber * delayFactor;
	return delay + delay * 0.2 * Math.random();
}

const axiosRetry: AxiosRetry = (axiosInstance, defaultOptions) => {
	const requestInterceptorId = axiosInstance.interceptors.request.use(
		(config) => {
			storeRetryOptions(config, defaultOptions);
			return config;
		},
	);

	const responseInterceptorId = axiosInstance.interceptors.response.use(
		null,
		async (error) => {
			const config = error?.config;
			if (!config) {
				return Promise.reject(error);
			}

			const state = storeRetryOptions(config, defaultOptions);
			const shouldRetry = await evaluateRetryCondition(state, error);
			if (!shouldRetry) {
				return Promise.reject(error);
			}

			return runRetryLifecycle(axiosInstance, config, state, error);
		},
	);

	return { requestInterceptorId, responseInterceptorId };
};

axiosRetry.isNetworkError = isNetworkError;
axiosRetry.isRetryableError = isRetryableError;
axiosRetry.isSafeRequestError = isSafeRequestError;
axiosRetry.isIdempotentRequestError = isIdempotentRequestError;
axiosRetry.isNetworkOrIdempotentRequestError =
	isNetworkOrIdempotentRequestError;
axiosRetry.exponentialDelay = exponentialDelay;

export default axiosRetry;
