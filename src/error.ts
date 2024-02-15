import { AxiosResponse, InternalAxiosRequestConfig } from "./types";

export class AxiosError<T = unknown, D = any> extends Error {
	config?: InternalAxiosRequestConfig<D>;
	code?: string;
	request?: any;
	response?: AxiosResponse<T, D>;
	status?: number;
    isAxiosError:boolean
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
        this.isAxiosError = true
	}
	static readonly ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
	static readonly ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
	static readonly ERR_BAD_OPTION = "ERR_BAD_OPTION";
	static readonly ERR_NETWORK = "ERR_NETWORK";
	static readonly ERR_DEPRECATED = "ERR_DEPRECATED";
	static readonly ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
	static readonly ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
	static readonly ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
	static readonly ERR_INVALID_URL = "ERR_INVALID_URL";
	static readonly ERR_CANCELED = "ERR_CANCELED";
	static readonly ECONNABORTED = "ECONNABORTED";
	static readonly ETIMEDOUT = "ETIMEDOUT";
}

export class CanceledError<T = unknown, D = any> extends AxiosError<T,D> {
    static readonly ERR_CANCELED = 'ERR_CANCELED';

    constructor(message: string | null | undefined, config?: InternalAxiosRequestConfig<D>, request?: any) {
      super(
        message == null ? 'canceled' : message,
        AxiosError.ERR_CANCELED,
        config,
        request,
      );
      this.name = 'CanceledError';
    }
  }
  