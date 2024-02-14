import { AxiosError, CanceledError } from "./axiosError";
import type {
	AxiosInterceptor,
	AxiosInterceptorOptions,
	AxiosRequestConfig,
	AxiosResponse,
	CreateAxiosDefaults,
	FulfillCallback,
	InternalAxiosRequestConfig,
	Method,
	RejectCallback,
} from "./types";

function deepMerge<T, U>(
	opts: T,
	overrides?: U,
	lowerCase?: boolean,
): {} & (T | U | U[]) {
	let out: any = {},
		i: string;
	if (Array.isArray(opts)) {
		return opts.concat(overrides as U);
	}
	for (i in opts) {
		const key = lowerCase ? i.toLowerCase() : i;
		out[key] = (opts as Record<string, any>)[i];
	}
	for (i in overrides) {
		const key = lowerCase ? i.toLowerCase() : i;
		const value = (overrides as any)[i];
		out[key] =
			key in out && typeof value === "object"
				? deepMerge(out[key], value, key === "headers")
				: Array.isArray(value)
					? [...(out[key] || []), ...value]
					: value;
	}
	return out;
}

async function parseAndValidateResponse(
	res: Response,
	req: any,
	options: InternalAxiosRequestConfig,
	response: AxiosResponse,
): Promise<AxiosResponse> {
	response.status = res.status;
	response.statusText = res.statusText;
	response.headers = res.headers;
	if (options.responseType == "stream") {
		response.data = res.body;
		return response;
	}

	return res[options.responseType || "text"]()
		.then((data) => {
			if (options.transformResponse) {
				Array.isArray(options.transformResponse)
					? options.transformResponse.map(
							(fn) => (data = fn.call(options, data, res.headers, res.status)),
						)
					: (data = options.transformResponse(data, res.headers, res.status));
				response.data = data;
			} else {
				response.data = data;
				response.data = JSON.parse(data);
			}
		})
		.catch(Object)
		.then(() => {
			const ok = options.validateStatus
				? options.validateStatus(res.status)
				: res.ok;
			return ok
				? response
				: Promise.reject(
						new AxiosError(
							"Request failed with status code " + response.status,
							[AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][
								Math.floor(response.status / 100) - 4
							],
							options,
							req,
							response,
						),
					);
		});
}

async function request(
	configOrUrl: string | AxiosRequestConfig,
	config?: AxiosRequestConfig,
	defaults?: CreateAxiosDefaults,
	method?: Method,
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

	const options = deepMerge(defaults, config) as InternalAxiosRequestConfig;

	const response: AxiosResponse = { config: options } as AxiosResponse;

	data = data || options.data;

	let headers = new Headers(options.headers || {});

	if (options.transformRequest) {
		Array.isArray(options.transformRequest)
			? options.transformRequest.map(
					(fn) => (data = fn.call(options, data, options.headers)),
				)
			: options.transformRequest(data, options.headers);
	}

	if (options.auth) {
		headers.set(
			"authorization",
			`Basic ${btoa(`${options.auth.username}:${options.auth.password}`)}`,
		);
	}
	if (
		data &&
		typeof data === "object" &&
		typeof data.append !== "function" &&
		typeof data.text !== "function"
	) {
		data = JSON.stringify(data);
		headers.set("content-type", "application/json");
	}

	if (options.baseURL) {
		options.url = options.url?.replace(/^(?!.*\/\/)\/?/, options.baseURL + "/");
	}

	if (options.params) {
		options.url +=
			(~options.url!.indexOf("?") ? "&" : "?") +
			(options.paramsSerializer
				? options.paramsSerializer(options.params)
				: new URLSearchParams(options.params));
	}

	options.headers = headers;

	options.method = method || options.method || "get";

	const request = new Request(options.url!, {
		method: options.method.toUpperCase(),
		body: data,
		headers,
		credentials: options.withCredentials ? "include" : undefined,
		signal: options.signal,
	});

	if (interceptors && interceptors.request.length > 0) {
		const chain = interceptors.request
			.filter(
				(interceptor) =>
					!interceptor?.runWhen ||
					(typeof interceptor.runWhen === "function" &&
						interceptor.runWhen(options)),
			)
			.map((interceptor) => [interceptor.fulfilled, interceptor.rejected])
			.flat();

		let result = options;

		for (let i = 0, len = chain.length; i < len; i += 2) {
			const onFulfilled = chain[i];
			const onRejected = chain[i + 1];

			try {
				if (onFulfilled) result = onFulfilled(result);
			} catch (error) {
				if (onRejected) (onRejected as RejectCallback)!(error);
				break;
			}
		}
	}

	const fetchPromise = fetch(request);

	let resp: Promise<AxiosResponse>;

	if (options.timeout) {
		const timeoutPromise = new Promise<AxiosResponse>((_, reject) => {
			setTimeout(() => {
				reject(
					new AxiosError("timeout", AxiosError.ETIMEDOUT, options, request),
				);
			}, options.timeout);
		});

		try {
			const res = await Promise.race([fetchPromise, timeoutPromise]);
			resp = parseAndValidateResponse(
				res as Response,
				request,
				options,
				response,
			);
		} catch (error) {
			if ((error as Error).name == "AbortError") {
				return Promise.reject(new CanceledError(null, options, request));
			}
			return Promise.reject(error);
		}
	} else {
		try {
			const res = await fetchPromise;
			resp = parseAndValidateResponse(res, request, options, response);
		} catch (error) {
			if ((error as Error).name == "AbortError") {
				return Promise.reject(new CanceledError(null, options, request));
			}
			return Promise.reject(error);
		}
	}

	if (interceptors && interceptors.response.length > 0) {
		const chain = interceptors.response
			.map((interceptor) => [interceptor.fulfilled, interceptor.rejected])
			.flat();

		for (let i = 0, len = chain.length; i < len; i += 2) {
			resp = resp.then(chain[i], chain[i + 1]);
		}
	}
	return resp;
}

class Axios {
	defaults: CreateAxiosDefaults;
	interceptors: {
		request: AxiosInterceptorManager<InternalAxiosRequestConfig>;
		response: AxiosInterceptorManager<AxiosResponse>;
	};
	constructor(defaults?: CreateAxiosDefaults) {
		this.defaults = defaults || ({} as CreateAxiosDefaults);
		this.interceptors = {
			request: new AxiosInterceptorManager<InternalAxiosRequestConfig>(),
			response: new AxiosInterceptorManager<AxiosResponse>(),
		};
	}

	request = <T = any, R = AxiosResponse<T>, D = any>(
		config: AxiosRequestConfig<D>,
	) => request(config, this.defaults) as Promise<R>;

	get = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: AxiosRequestConfig<D>,
	) =>
		request(url, config, this.defaults, "get", this.interceptors) as Promise<R>;

	delete = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"delete",
			this.interceptors,
		) as Promise<R>;

	head = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"head",
			this.interceptors,
		) as Promise<R>;

	options = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"options",
			this.interceptors,
		) as Promise<R>;

	post = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"post",
			this.interceptors,
			data,
		) as Promise<R>;

	put = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"put",
			this.interceptors,
			data,
		) as Promise<R>;

	patch = <T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: AxiosRequestConfig<D>,
	) =>
		request(
			url,
			config,
			this.defaults,
			"patch",
			this.interceptors,
			data,
		) as Promise<R>;

	all = <T>(promises: Array<T | Promise<T>>) => Promise.all(promises);
}

class AxiosInterceptorManager<V> {
	#interceptors: Array<AxiosInterceptor<V>> = [];

	use = (
		onFulfilled?: FulfillCallback<V>,
		onRejected?: RejectCallback,
		options?: AxiosInterceptorOptions,
	): number => {
		this.#interceptors.push({
			fulfilled: onFulfilled,
			rejected: onRejected,
			runWhen: options?.runWhen,
		});
		return this.#interceptors.length - 1;
	};

	eject = (id: number): void => {
		if (this.#interceptors[id]) {
			this.#interceptors[id] = null!;
		}
	};

	clear = (): void => {
		this.#interceptors = [];
	};

	map = <U>(fn: (value: AxiosInterceptor<V>, index: number) => U) => {
		return this.#interceptors.map(fn);
	};

	filter = (fn: (value: AxiosInterceptor<V>) => boolean) => {
		return this.#interceptors.filter(fn);
	};

	get length() {
		return this.#interceptors.length;
	}
}

export function isAxiosError<T = any, D = any>(
	payload: any,
): payload is AxiosError<T, D> {
	return (
		payload !== null &&
		typeof payload === "object" &&
		(payload as AxiosError<T, D>).isAxiosError
	);
}

function createAxiosInstance(defaults?: CreateAxiosDefaults) {
	const axiosInstance = new Axios(defaults);

	const axios = (
		url: string | AxiosRequestConfig,
		config?: AxiosRequestConfig,
	) => request(url, config, defaults, undefined, axiosInstance.interceptors);

	axios.defaults = axiosInstance.defaults;

	axios.interceptors = axiosInstance.interceptors;

	[
		"get",
		"delete",
		"head",
		"options",
		"post",
		"put",
		"patch",
		"all",
		"request",
	].forEach((method) => (axios[method] = axiosInstance[method]));

	return axios as AxiosInstance;
}

function createAxiosStatic(defaults?: CreateAxiosDefaults) {
	const axios = createAxiosInstance(defaults) as AxiosStatic;

	axios.create = (newDefaults?: CreateAxiosDefaults) =>
		createAxiosInstance(newDefaults);

	return axios;
}

export interface AxiosInstance extends Axios {
	<T = any, R = AxiosResponse<T>, D = any>(
		config: AxiosRequestConfig<D>,
	): Promise<R>;
	<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: AxiosRequestConfig<D>,
	): Promise<R>;
}

export interface AxiosStatic extends AxiosInstance {
	create: (defaults?: CreateAxiosDefaults) => AxiosInstance;
}

export default createAxiosStatic();

export * from "./types";

export { AxiosError, CanceledError };
