import type { AxiosRetryConfigExtended } from "./plugins/retry";
import type { CookieJar } from "tough-cookie";

export type AxiosRequestTransformer = (
	this: InternalAxiosRequestConfig,
	data: any,
	headers: Headers,
) => any;

export type AxiosResponseTransformer = (
	this: InternalAxiosRequestConfig,
	data: any,
	headers: HeadersInit,
	status?: number,
) => any;

export type ResponseType = "arrayBuffer" | "blob" | "json" | "text" | "stream";

export interface RuntimeFetchOptions extends RequestInit {
	agent?: unknown;
	dispatcher?: unknown;
	[key: string]: unknown;
}

export interface AxiosResponseTypeMap {
	arrayBuffer: ArrayBuffer;
	blob: Blob;
	json: any;
	text: string;
	stream: ReadableStream<Uint8Array> | null;
}

export type AxiosResponseData<RT extends ResponseType | undefined> =
	RT extends ResponseType ? AxiosResponseTypeMap[RT] : any;

export type Method =
	| "get"
	| "GET"
	| "delete"
	| "DELETE"
	| "head"
	| "HEAD"
	| "options"
	| "OPTIONS"
	| "post"
	| "POST"
	| "put"
	| "PUT"
	| "patch"
	| "PATCH"
	| "purge"
	| "PURGE"
	| "link"
	| "LINK"
	| "unlink"
	| "UNLINK";

export interface FormDataVisitorHelpers {
	defaultVisitor: SerializerVisitor;
	convertValue: (value: any) => any;
	isVisitable: (value: any) => boolean;
}

export type SerializerVisitor = (
	this: GenericFormData,
	value: any,
	key: string | number,
	path: null | Array<string | number>,
	helpers: FormDataVisitorHelpers,
) => boolean;

interface GenericFormData {
	append(name: string, value: any, options?: any): any;
}

export interface SerializerOptions {
	visitor?: SerializerVisitor;
	dots?: boolean;
	metaTokens?: boolean;
	indexes?: boolean | null;
}

export type ParamEncoder = (
	value: any,
	defaultEncoder: (value: any) => any,
) => any;

export type CustomParamsSerializer = (
	params: Record<string, any>,
	options?: ParamsSerializerOptions,
) => string;

export interface ParamsSerializerOptions extends SerializerOptions {
	encode?: ParamEncoder;
	serialize?: CustomParamsSerializer;
}

export interface AxiosRequestConfig<
	D = any,
	RT extends ResponseType = ResponseType,
> {
	url?: string;
	method?: Method | string;
	baseURL?: string;
	transformRequest?: AxiosRequestTransformer | AxiosRequestTransformer[];
	transformResponse?: AxiosResponseTransformer | AxiosResponseTransformer[];
	headers?: HeadersInit;
	params?: Record<string, any>;
	paramsSerializer?: CustomParamsSerializer;
	data?: D;
	timeout?: number;
	timeoutErrorMessage?: string;
	withCredentials?: boolean;
	responseType?: RT;
	validateStatus?: ((status: number) => boolean) | null;
	signal?: AbortSignal;
	fetchOptions?: RuntimeFetchOptions;
	retry?: AxiosRetryConfigExtended;
}

export type RawAxiosRequestConfig<D = any> = AxiosRequestConfig<D>;

export interface InternalAxiosRequestConfig<
	D = any,
	RT extends ResponseType = ResponseType,
> extends Omit<AxiosRequestConfig<D, RT>, "headers"> {
	headers: Headers;
	_meta?: Record<string, unknown>;
	_transformedData?: D;
	_hasTransformedData?: boolean;
}

export interface AxiosLoggerRequestContext {
	config: InternalAxiosRequestConfig;
	method: string;
	url: string;
	headers: Headers;
	startedAt: number;
}

export interface AxiosLoggerResponseContext {
	config: InternalAxiosRequestConfig;
	response: AxiosResponse;
	duration: number;
	method: string;
	url: string;
	status: number;
}

export interface AxiosLoggerErrorContext {
	config?: InternalAxiosRequestConfig;
	error: unknown;
	duration?: number;
	method?: string;
	url?: string;
}

export interface AxiosLoggerConfig {
	onRequest?: (context: AxiosLoggerRequestContext) => void;
	onResponse?: (context: AxiosLoggerResponseContext) => void;
	onError?: (context: AxiosLoggerErrorContext) => void;
}

export interface AxiosCookieJarConfig {
	jar: CookieJar;
}

export interface AxiosDefaults<D = any>
	extends Omit<AxiosRequestConfig<D>, "headers"> {
	headers: HeadersInit;
}

export interface CreateAxiosDefaults<D = any>
	extends Omit<AxiosRequestConfig<D>, "headers"> {
	headers?: HeadersInit;
}

export interface AxiosResponse<T = any, D = any> {
	data: T;
	status: number;
	statusText: string;
	headers: Headers;
	config: InternalAxiosRequestConfig<D>;
	request?: Request;
}

export type AxiosPromise<T = any> = Promise<AxiosResponse<T>>;

export interface AxiosInterceptorOptions {
	runWhen?: (config: InternalAxiosRequestConfig) => boolean;
}

export type FulfillCallback<V> = ((value: V) => V | Promise<V>) | null;

export type RejectCallback = ((error: any) => any) | null;

export interface AxiosInterceptorManager<V> {
	use(
		onFulfilled?: FulfillCallback<V>,
		onRejected?: RejectCallback,
		options?: AxiosInterceptorOptions,
	): number;
	eject(id: number): void;
	clear(): void;
}

export type AxiosPlugin<
	TOptions = void,
	TInstance extends AxiosInstance = AxiosInstance,
> = (instance: TInstance, options?: TOptions) => unknown;

export type AxiosInterceptor<V> = {
	fulfilled?: FulfillCallback<V>;
	rejected?: RejectCallback;
	synchronous?: boolean;
	runWhen?: (config: InternalAxiosRequestConfig) => boolean;
};

export interface AxiosInstance {
	defaults: CreateAxiosDefaults;
	interceptors: {
		request: AxiosInterceptorManager<InternalAxiosRequestConfig>;
		response: AxiosInterceptorManager<AxiosResponse>;
	};
	use: <TOptions = void>(
		plugin: AxiosPlugin<TOptions, AxiosInstance>,
		options?: TOptions,
	) => AxiosInstance;
	getUri: (config?: AxiosRequestConfig) => string;
	request: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		config: AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>,
	) => Promise<AxiosResponse<T, D>>;
	get: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	delete: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	head: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	options: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	post: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	put: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	patch: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	postForm: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	putForm: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	patchForm: <
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		data?: D | undefined,
		config?:
			| AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>
			| undefined,
	) => Promise<AxiosResponse<T, D>>;
	<
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		config: AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>,
	): Promise<AxiosResponse<T, D>>;
	<
		RT extends ResponseType | undefined = undefined,
		T = AxiosResponseData<RT>,
		D = any,
	>(
		url: string,
		config?: AxiosRequestConfig<D, RT extends ResponseType ? RT : ResponseType>,
	): Promise<AxiosResponse<T, D>>;
}

export interface AxiosStatic extends AxiosInstance {
	create: (defaults?: CreateAxiosDefaults) => AxiosInstance;
	all: <T>(values: Array<T | Promise<T>>) => Promise<Awaited<T>[]>;
	spread: <T extends unknown[], R>(
		callback: (...args: T) => R,
	) => (array: T) => R;
}
