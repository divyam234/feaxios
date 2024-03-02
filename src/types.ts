import type { AxiosRetryConfigExtended } from "./retry";

export interface AxiosRequestTransformer {
	(this: InternalAxiosRequestConfig, data: any, headers: HeadersInit): any;
}

export interface AxiosResponseTransformer {
	(
		this: InternalAxiosRequestConfig,
		data: any,
		headers: HeadersInit,
		status?: number,
	): any;
}

export type ResponseType = "arrayBuffer" | "blob" | "json" | "text" | "stream";

export interface FormDataVisitorHelpers {
	defaultVisitor: SerializerVisitor;
	convertValue: (value: any) => any;
	isVisitable: (value: any) => boolean;
}

export interface SerializerVisitor {
	(
		this: GenericFormData,
		value: any,
		key: string | number,
		path: null | Array<string | number>,
		helpers: FormDataVisitorHelpers,
	): boolean;
}

interface GenericFormData {
	append(name: string, value: any, options?: any): any;
}

export interface SerializerOptions {
	visitor?: SerializerVisitor;
	dots?: boolean;
	metaTokens?: boolean;
	indexes?: boolean | null;
}

export interface ParamEncoder {
	(value: any, defaultEncoder: (value: any) => any): any;
}

export interface CustomParamsSerializer {
	(params: Record<string, any>, options?: ParamsSerializerOptions): string;
}

export interface ParamsSerializerOptions extends SerializerOptions {
	encode?: ParamEncoder;
	serialize?: CustomParamsSerializer;
}

export interface AxiosRequestConfig<D = any> {
	url?: string;
	method?:string;
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
	responseType?: ResponseType;
	validateStatus?: ((status: number) => boolean) | null;
	signal?: AbortSignal;
	fetchOptions?: RequestInit;
	retry?: AxiosRetryConfigExtended;
}

export type RawAxiosRequestConfig<D = any> = AxiosRequestConfig<D>;

export interface InternalAxiosRequestConfig<D = any>
	extends Omit<AxiosRequestConfig<D>, "headers">{
	headers: Headers;
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

export type  FulfillCallback<V>  = ((value: V) => V | Promise<V>) | null

export type  RejectCallback  =  ((error: any) => any) | null

export interface AxiosInterceptorManager<V> {
	use(
		onFulfilled?: FulfillCallback<V>,
		onRejected?:  RejectCallback,
		options?: AxiosInterceptorOptions,
	): number;
	eject(id: number): void;
	clear(): void;
}

export type AxiosInterceptor<V> = {
	fulfilled?: FulfillCallback<V>;
	rejected?: RejectCallback;
	synchronous?: boolean;
	runWhen?: (config: InternalAxiosRequestConfig) => boolean;
};
