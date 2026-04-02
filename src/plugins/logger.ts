import type {
	AxiosPlugin,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from "../types";
import type {
	AxiosLoggerConfig,
	AxiosLoggerErrorContext,
	AxiosLoggerRequestContext,
	AxiosLoggerResponseContext,
} from "../types";

const LOGGER_META_KEY = "loggerStartedAt";

function now() {
	return typeof performance !== "undefined" &&
		typeof performance.now === "function"
		? performance.now()
		: Date.now();
}

function durationFrom(startedAt?: number) {
	return startedAt === undefined ? undefined : Math.max(0, now() - startedAt);
}

function getMethod(config?: InternalAxiosRequestConfig) {
	return (config?.method || "get").toUpperCase();
}

function getUrl(config?: InternalAxiosRequestConfig) {
	return config?.url || "";
}

function getStartedAt(config?: InternalAxiosRequestConfig) {
	const value = config?._meta?.[LOGGER_META_KEY];
	return typeof value === "number" ? value : undefined;
}

function buildRequestContext(
	config: InternalAxiosRequestConfig,
): AxiosLoggerRequestContext {
	const startedAt = now();
	config._meta = { ...(config._meta || {}), [LOGGER_META_KEY]: startedAt };
	return {
		config,
		method: getMethod(config),
		url: getUrl(config),
		headers: config.headers,
		startedAt,
	};
}

function buildResponseContext(
	response: AxiosResponse,
): AxiosLoggerResponseContext {
	const startedAt = getStartedAt(response.config) ?? now();
	return {
		config: response.config,
		response,
		duration: durationFrom(startedAt) || 0,
		method: getMethod(response.config),
		url: getUrl(response.config),
		status: response.status,
	};
}

function buildErrorContext(error: any): AxiosLoggerErrorContext {
	const config = error?.config as InternalAxiosRequestConfig | undefined;
	const startedAt = getStartedAt(config);
	return {
		config,
		error,
		duration: config ? durationFrom(startedAt ?? now()) : undefined,
		method: config ? getMethod(config) : undefined,
		url: config ? getUrl(config) : undefined,
	};
}

const logger: AxiosPlugin<AxiosLoggerConfig> = (instance, options = {}) => {
	instance.interceptors.request.use(
		(config) => {
			options.onRequest?.(buildRequestContext(config));
			return config;
		},
		(error) => {
			options.onError?.(buildErrorContext(error));
			return Promise.reject(error);
		},
	);

	instance.interceptors.response.use(
		(response) => {
			options.onResponse?.(buildResponseContext(response));
			return response;
		},
		(error) => {
			options.onError?.(buildErrorContext(error));
			return Promise.reject(error);
		},
	);
};

export default logger;
