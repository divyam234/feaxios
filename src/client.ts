import type {
	AxiosInstance,
	AxiosInterceptor,
	AxiosInterceptorOptions,
	AxiosPlugin,
	AxiosRequestConfig,
	AxiosResponse,
	AxiosStatic,
	CreateAxiosDefaults,
	FulfillCallback,
	InternalAxiosRequestConfig,
	RejectCallback,
	RuntimeFetchOptions,
} from "./types";

function runTransforms<TArgs extends unknown[]>(
	context: InternalAxiosRequestConfig,
	transforms:
		| ((this: InternalAxiosRequestConfig, data: any, ...args: TArgs) => any)[]
		| ((this: InternalAxiosRequestConfig, data: any, ...args: TArgs) => any)
		| undefined,
	data: unknown,
	...args: TArgs
) {
	if (!transforms) {
		return data;
	}
	for (const transform of Array.isArray(transforms)
		? transforms
		: [transforms]) {
		data = transform.call(context, data, ...args);
	}
	return data;
}

function createAxiosResponse(
	config: InternalAxiosRequestConfig,
	response: Response,
) {
	return {
		config,
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	} as AxiosResponse;
}

async function readResponseData(
	options: InternalAxiosRequestConfig,
	response: Response,
) {
	if (options.responseType === "stream") {
		return response.body;
	}

	const responseType = options.responseType || "text";
	if (responseType !== "json" && options.responseType) {
		return response[responseType]();
	}

	const text = await response.text();
	if (responseType === "json") {
		return text ? JSON.parse(text) : "";
	}

	if (!text) {
		return text;
	}

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit) {
	if (!base && !extra) {
		return undefined;
	}
	const headers = new Headers(base || {});
	new Headers(extra || {}).forEach((value, key) => headers.set(key, value));
	return headers;
}

function mergeOptions<T extends { headers?: HeadersInit }>(
	defaults: T,
	input: T,
) {
	const merged = { ...defaults, ...input };
	if (defaults?.headers || input?.headers) {
		merged.headers = mergeHeaders(defaults.headers, input.headers);
	}
	return merged;
}

function runInterceptorChain<T>(
	promise: Promise<T>,
	handlers: Array<AxiosInterceptor<any>>,
	filter?: (handler: AxiosInterceptor<any>) => boolean,
) {
	for (const handler of handlers) {
		if (!handler || (filter && !filter(handler))) {
			continue;
		}
		promise = promise.then(handler.fulfilled, handler.rejected);
	}
	return promise;
}

function runRejectedInterceptorChain(
	error: unknown,
	handlers: Array<AxiosInterceptor<any>>,
) {
	return runInterceptorChain(Promise.reject(error), handlers);
}

async function prepareAxiosResponse(
	options: InternalAxiosRequestConfig,
	res: Response,
) {
	const response = createAxiosResponse(options, res);

	try {
		response.data = runTransforms(
			options,
			options.transformResponse,
			await readResponseData(options, res),
			res.headers,
			res.status,
		);
		return response;
	} catch (error) {
		throw new AxiosError(
			(error as Error).message,
			AxiosError.ERR_BAD_RESPONSE,
			options,
			undefined,
			response,
		);
	}
}

function createTimeoutSignal(timeout: number) {
	if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
		return AbortSignal.timeout(timeout);
	}

	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(new DOMException("TimeoutError")),
		timeout,
	);
	controller.signal.addEventListener("abort", () => clearTimeout(timer), {
		once: true,
	});
	return controller.signal;
}

function combineSignals(signals: AbortSignal[]) {
	if (signals.length === 0) {
		return undefined;
	}

	if (signals.length === 1) {
		return signals[0];
	}

	if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
		return (
			AbortSignal as typeof AbortSignal & {
				any: (signals: AbortSignal[]) => AbortSignal;
			}
		).any(signals);
	}

	const controller = new AbortController();
	const abort = (signal: AbortSignal) => {
		if (!controller.signal.aborted) {
			controller.abort(signal.reason);
		}
	};

	for (const signal of signals) {
		if (signal.aborted) {
			abort(signal);
			break;
		}
		signal.addEventListener("abort", () => abort(signal), { once: true });
	}

	return controller.signal;
}

async function handleFetch(
	options: InternalAxiosRequestConfig,
	fetchOptions: RuntimeFetchOptions,
) {
	let res: Response | null = null;
	const signals: AbortSignal[] = [];
	if (options.timeout) {
		signals.push(createTimeoutSignal(options.timeout));
	}
	if (options.signal) {
		signals.push(options.signal);
	}

	const combinedSignal = combineSignals(signals);
	if (combinedSignal) {
		fetchOptions.signal = combinedSignal;
	}

	let request: Request;
	try {
		request = new Request(options.url as string, fetchOptions);
	} catch (error) {
		return Promise.reject(
			new AxiosError(
				(error as Error).message,
				AxiosError.ERR_INVALID_URL,
				options,
			),
		);
	}

	try {
		res = await fetch(request);
		const ok =
			options.validateStatus === null
				? true
				: options.validateStatus
					? options.validateStatus(res.status)
					: res.ok;
		if (!ok) {
			return Promise.reject(
				new AxiosError(
					`Request failed with status code ${res?.status}`,
					[AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][
						Math.floor(res?.status / 100) - 4
					],
					options,
					request,
					await prepareAxiosResponse(options, res),
				),
			);
		}
		return await prepareAxiosResponse(options, res);
	} catch (error) {
		if (isAxiosError(error)) {
			return Promise.reject(error);
		}
		if (
			(error as Error).name === "AbortError" ||
			(error as Error).name === "TimeoutError"
		) {
			const isTimeoutError = (error as Error).name === "TimeoutError";
			return Promise.reject(
				isTimeoutError
					? new AxiosError(
							options.timeoutErrorMessage ||
								`timeout of ${options.timeout} ms exceeded`,
							AxiosError.ECONNABORTED,
							options,
							request,
						)
					: new CanceledError(null, options),
			);
		}
		return Promise.reject(
			Object.assign(
				new AxiosError(
					(error as Error).message,
					AxiosError.ERR_NETWORK,
					options,
					request,
					undefined,
				),
				{ cause: error },
			),
		);
	}
}

function buildURL(options: InternalAxiosRequestConfig) {
	let url = options.url || "";
	if (options.baseURL && options.url) {
		const baseURL = options.baseURL.replace(/\/+$/, "");
		url = options.url.replace(/^(?!.*\/\/)\/?/, `${baseURL}/`)!;
	}

	if (options.params && Object.keys(options.params).length > 0 && options.url) {
		const query = options.paramsSerializer
			? options.paramsSerializer(options.params)
			: serializeParams(options.params);
		if (query) {
			url += (~options.url.indexOf("?") ? "&" : "?") + query;
		}
	}

	return url;
}

function serializeParams(params: Record<string, any>) {
	const searchParams = new URLSearchParams();

	const appendValue = (key: string, value: unknown) => {
		if (value == null) {
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				appendValue(`${key}[]`, item);
			}
			return;
		}
		if (
			typeof value === "object" &&
			!(value instanceof Date) &&
			!(value instanceof URLSearchParams)
		) {
			for (const [nestedKey, nestedValue] of Object.entries(value)) {
				appendValue(`${key}[${nestedKey}]`, nestedValue);
			}
			return;
		}
		searchParams.append(
			key,
			value instanceof Date ? value.toISOString() : String(value),
		);
	};

	for (const [key, value] of Object.entries(params)) {
		appendValue(key, value);
	}

	return searchParams.toString();
}

function mergeAxiosOptions(
	input: AxiosRequestConfig,
	defaults: CreateAxiosDefaults,
) {
	const merged = mergeOptions(defaults, input);

	if (defaults?.params && input?.params) {
		merged.params = {
			...defaults?.params,
			...input?.params,
		};
	}
	return merged as InternalAxiosRequestConfig;
}

function mergeFetchOptions(
	input: RuntimeFetchOptions,
	defaults: RuntimeFetchOptions,
) {
	return mergeOptions(defaults, input) as RuntimeFetchOptions;
}

export function defaultTransformer(data: any, headers: Headers) {
	const contentType = headers.get("content-type");
	if (!contentType) {
		if (typeof data === "string") {
			headers.set("content-type", "text/plain");
		} else if (data instanceof URLSearchParams) {
			headers.set("content-type", "application/x-www-form-urlencoded");
		} else if (
			data instanceof Blob ||
			data instanceof ArrayBuffer ||
			ArrayBuffer.isView(data)
		) {
			headers.set("content-type", "application/octet-stream");
		} else if (
			typeof data === "object" &&
			typeof data.append !== "function" &&
			typeof data.text !== "function"
		) {
			data = JSON.stringify(data);
			headers.set("content-type", "application/json");
		}
	} else {
		if (
			contentType === "application/x-www-form-urlencoded" &&
			!(data instanceof URLSearchParams)
		) {
			data = new URLSearchParams(data);
		} else if (contentType === "application/json" && typeof data === "object") {
			data = JSON.stringify(data);
		}
	}
	return data;
}

async function request(
	configOrUrl: string | AxiosRequestConfig,
	config?: AxiosRequestConfig,
	defaults?: CreateAxiosDefaults,
	method?: string,
	interceptors?: {
		request: AxiosInterceptorManager<InternalAxiosRequestConfig>;
		response: AxiosInterceptorManager<AxiosResponse>;
	},
	data?: any,
) {
	if (typeof configOrUrl === "string") {
		config = config || {};
		config.url = configOrUrl;
	} else {
		config = configOrUrl || {};
	}

	const options = mergeAxiosOptions(config, defaults || {});
	options.fetchOptions ||= {};
	options.timeout ||= 0;
	options.headers = new Headers(options.headers || {});
	options.transformRequest = options.transformRequest ?? defaultTransformer;
	data = options._hasTransformedData
		? options._transformedData
		: data ?? options.data;

	if (!options._hasTransformedData && data !== undefined) {
		data = runTransforms(
			options,
			options.transformRequest,
			data,
			options.headers,
		);
	}

	options._transformedData = data;
	options._hasTransformedData = true;
	options.url = buildURL(options);
	options.method = (method || options.method || "get").toLowerCase();

	if (interceptors && interceptors.request.handlers.length > 0) {
		try {
			const result = runInterceptorChain(
				Promise.resolve(options),
				interceptors.request.handlers,
				(interceptor) => !interceptor.runWhen || interceptor.runWhen(options),
			);
			options.headers = new Headers(options.headers);
			Object.assign(options, await result);
		} catch (error) {
			return interceptors.response.handlers.length > 0
				? runRejectedInterceptorChain(error, interceptors.response.handlers)
				: Promise.reject(error);
		}
	}

	const init = mergeFetchOptions(
		{
			method: options.method?.toUpperCase(),
			body: options._transformedData,
			headers: options.headers,
			credentials:
				options.fetchOptions?.credentials ??
				(options.withCredentials ? "include" : undefined),
			signal: options.signal,
		},
		options.fetchOptions || {},
	);

	let resp = handleFetch(options, init);
	if (interceptors && interceptors.response.handlers.length > 0) {
		resp = runInterceptorChain(resp, interceptors.response.handlers);
	}

	return resp;
}
class AxiosInterceptorManager<V> {
	handlers: Array<AxiosInterceptor<V>> = [];
	constructor() {
		this.handlers = [];
	}
	use = (
		onFulfilled?: FulfillCallback<V>,
		onRejected?: RejectCallback,
		options?: AxiosInterceptorOptions,
	): number => {
		this.handlers.push({
			fulfilled: onFulfilled,
			rejected: onRejected,
			runWhen: options?.runWhen,
		});
		return this.handlers.length - 1;
	};

	eject = (id: number): void => {
		if (this.handlers[id]) {
			//@ts-expect-error
			this.handlers[id] = null;
		}
	};

	clear = (): void => {
		this.handlers = [];
	};
}

function createAxiosInstance(defaults?: CreateAxiosDefaults) {
	defaults = defaults || ({} as CreateAxiosDefaults);

	const interceptors = {
		request: new AxiosInterceptorManager<InternalAxiosRequestConfig>(),
		response: new AxiosInterceptorManager<AxiosResponse>(),
	};

	const axios = (
		url: string | AxiosRequestConfig,
		config?: AxiosRequestConfig,
	) => request(url, config, defaults, undefined, interceptors);

	axios.defaults = defaults;

	axios.interceptors = interceptors as AxiosInstance["interceptors"];

	axios.use = (<TOptions>(
		plugin: AxiosPlugin<TOptions, AxiosInstance>,
		options?: TOptions,
	) => {
		plugin(axios as AxiosInstance, options);
		return axios as AxiosInstance;
	}) as AxiosInstance["use"];

	axios.getUri = (config?: AxiosRequestConfig) => {
		//@ts-ignore
		const merged = mergeAxiosOptions(config || {}, defaults);
		return buildURL(merged);
	};
	axios.request = <T = any, R = AxiosResponse<T>, D = any>(
		config: AxiosRequestConfig<D>,
	) =>
		request(config, undefined, defaults, undefined, interceptors) as Promise<R>;

	const attachMethod = (method: string, isForm = false) => {
		axios[method] = <T = any, R = AxiosResponse<T>, D = any>(
			url: string,
			dataOrConfig?: D | AxiosRequestConfig<D>,
			config?: AxiosRequestConfig<D>,
		) => {
			if (["get", "delete", "head", "options"].includes(method)) {
				return request(
					url,
					dataOrConfig as AxiosRequestConfig<D> | undefined,
					defaults,
					method,
					interceptors,
				) as Promise<R>;
			}

			const body = dataOrConfig as D | undefined;
			const finalConfig = config || {};
			if (isForm) {
				finalConfig.headers = new Headers(finalConfig.headers || {});
				finalConfig.headers.set(
					"content-type",
					"application/x-www-form-urlencoded",
				);
			}
			return request(
				url,
				finalConfig,
				defaults,
				method.replace("Form", ""),
				interceptors,
				body,
			) as Promise<R>;
		};
	};

	["get", "delete", "head", "options", "post", "put", "patch"].forEach(
		(method) => attachMethod(method),
	);
	["postForm", "putForm", "patchForm"].forEach((method) =>
		attachMethod(method, true),
	);

	return axios as AxiosInstance;
}
export class AxiosError<T = unknown, D = any> extends Error {
	config?: InternalAxiosRequestConfig<D>;
	code?: string;
	request?: any;
	response?: AxiosResponse<T, D>;
	status?: number;
	isAxiosError: boolean;
	constructor(
		message?: string,
		code?: string,
		config?: InternalAxiosRequestConfig<D>,
		request?: any,
		response?: AxiosResponse<T, D>,
	) {
		super(message);

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		} else {
			this.stack = new Error().stack;
		}

		this.name = "AxiosError";
		this.code = code;
		this.config = config;
		this.request = request;
		this.response = response;
		this.status = response?.status;
		this.isAxiosError = true;
	}
	toJSON() {
		return {
			message: this.message,
			name: this.name,
			stack: this.stack,
			config: this.config,
			code: this.code,
			status: this.status,
		};
	}
	static readonly ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
	static readonly ERR_BAD_OPTION = "ERR_BAD_OPTION";
	static readonly ERR_NETWORK = "ERR_NETWORK";
	static readonly ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
	static readonly ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
	static readonly ERR_INVALID_URL = "ERR_INVALID_URL";
	static readonly ERR_CANCELED = "ERR_CANCELED";
	static readonly ECONNABORTED = "ECONNABORTED";
	static readonly ETIMEDOUT = "ETIMEDOUT";
}

export class CanceledError<T = unknown, D = any> extends AxiosError<T, D> {
	constructor(
		message: string | null | undefined,
		config?: InternalAxiosRequestConfig<D>,
		request?: any,
	) {
		super(
			!message ? "canceled" : message,
			AxiosError.ERR_CANCELED,
			config,
			request,
		);
		this.name = "CanceledError";
	}
}
export function isAxiosError<T = any, D = any>(
	payload: any,
): payload is AxiosError<T, D> {
	return !!(
		payload !== null &&
		typeof payload === "object" &&
		(payload as AxiosError<T, D>).isAxiosError
	);
}

const axios = createAxiosInstance() as AxiosStatic;

axios.create = (defaults?: CreateAxiosDefaults) =>
	createAxiosInstance(defaults);

axios.all = <T>(values: Array<T | Promise<T>>) => Promise.all(values);

axios.spread =
	<T extends unknown[], R>(callback: (...args: T) => R) =>
	(array: T) =>
		callback(...array);

export { axios };
