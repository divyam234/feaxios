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

export type Method =
    | 'get' | 'GET'
    | 'delete' | 'DELETE'
    | 'head' | 'HEAD'
    | 'options' | 'OPTIONS'
    | 'post' | 'POST'
    | 'put' | 'PUT'
    | 'patch' | 'PATCH'
    | 'purge' | 'PURGE'
    | 'link' | 'LINK'
    | 'unlink' | 'UNLINK';


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

export interface AxiosInstance {
	defaults: CreateAxiosDefaults;
	interceptors: {
		request: AxiosInterceptorManager<InternalAxiosRequestConfig>;
		response: AxiosInterceptorManager<AxiosResponse>;
	};
    getUri: (config?: AxiosRequestConfig) => string;
    request: <T = any, R = AxiosResponse<T, any>, D = any>(config: AxiosRequestConfig<D>) => Promise<R>;
    get: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    delete: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    head: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    options: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    post: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    put: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    patch: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    postForm: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    putForm: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
    patchForm: <T = any, R = AxiosResponse<T, any>, D = any>(url: string, data?: D | undefined, config?: AxiosRequestConfig<D> | undefined) => Promise<R>;
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