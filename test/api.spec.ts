import axios, { AxiosError, CanceledError, isAxiosError } from "../src";
import cookieJar, { CookieJar } from "../src/plugins/cookie-jar";
import logger from "../src/plugins/logger";
import retry from "../src/plugins/retry";
import { describe, expect, it } from "bun:test";

describe("api surface", () => {
	it("should expose the main request helpers", () => {
		expect(typeof axios).toBe("function");
		expect(typeof axios.request).toBe("function");
		expect(typeof axios.get).toBe("function");
		expect(typeof axios.delete).toBe("function");
		expect(typeof axios.head).toBe("function");
		expect(typeof axios.options).toBe("function");
		expect(typeof axios.post).toBe("function");
		expect(typeof axios.put).toBe("function");
		expect(typeof axios.patch).toBe("function");
		expect(typeof axios.postForm).toBe("function");
		expect(typeof axios.putForm).toBe("function");
		expect(typeof axios.patchForm).toBe("function");
		expect(typeof axios.create).toBe("function");
		expect(typeof axios.getUri).toBe("function");
		expect(typeof axios.use).toBe("function");
		expect(typeof axios.all).toBe("function");
		expect(typeof axios.spread).toBe("function");
	});

	it("should expose defaults and interceptors", () => {
		expect(typeof axios.defaults).toBe("object");
		expect(typeof axios.interceptors.request.use).toBe("function");
		expect(typeof axios.interceptors.request.eject).toBe("function");
		expect(typeof axios.interceptors.request.clear).toBe("function");
		expect(typeof axios.interceptors.response.use).toBe("function");
		expect(typeof axios.interceptors.response.eject).toBe("function");
		expect(typeof axios.interceptors.response.clear).toBe("function");
	});

	it("should create instances with the same helper surface", () => {
		const instance = axios.create({ baseURL: "http://example.com" });
		expect(typeof instance).toBe("function");
		expect(typeof instance.request).toBe("function");
		expect(typeof instance.get).toBe("function");
		expect(typeof instance.post).toBe("function");
		expect(typeof instance.use).toBe("function");
		expect(typeof instance.interceptors.request.use).toBe("function");
		expect(typeof instance.interceptors.response.use).toBe("function");
		expect(instance.defaults.baseURL).toBe("http://example.com");
	});

	it("should support plugin installation via use()", () => {
		const instance = axios.create();
		const returned = instance.use(retry, { retries: 1 });
		expect(returned).toBe(instance);
	});

	it("should support logger plugin installation via use()", () => {
		const instance = axios.create();
		const returned = instance.use(logger, {});
		expect(returned).toBe(instance);
	});

	it("should support cookie jar plugin installation via use()", () => {
		const instance = axios.create();
		const returned = instance.use(cookieJar, { jar: new CookieJar() });
		expect(returned).toBe(instance);
	});

	it("should support plugins without options", () => {
		const instance = axios.create();
		const returned = instance.use((client) => {
			client.defaults.baseURL = "http://plugin.test";
		});
		expect(returned.defaults.baseURL).toBe("http://plugin.test");
	});

	it("should support all and spread helpers", async () => {
		const values = await axios.all([Promise.resolve(1), 2, Promise.resolve(3)]);
		expect(values).toEqual([1, 2, 3]);

		const join = axios.spread(
			(a: number, b: number, c: number) => `${a}-${b}-${c}`,
		);
		expect(join([1, 2, 3])).toBe("1-2-3");
	});
});

describe("AxiosError", () => {
	it("should capture message, code, config, request, response, status and flags", () => {
		const config = { url: "http://example.com", method: "get" } as any;
		const request = { id: 1 };
		const response = {
			status: 418,
			statusText: "I'm a teapot",
			headers: new Headers(),
			config,
			data: "short and stout",
		};

		const error = new AxiosError(
			"boom",
			AxiosError.ERR_BAD_RESPONSE,
			config,
			request,
			response as any,
		);

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("AxiosError");
		expect(error.message).toBe("boom");
		expect(error.code).toBe(AxiosError.ERR_BAD_RESPONSE);
		expect(error.config).toBe(config);
		expect(error.request).toBe(request);
		expect(error.response).toBe(response);
		expect(error.status).toBe(418);
		expect(error.isAxiosError).toBe(true);
		expect(isAxiosError(error)).toBe(true);
	});

	it("should expose static error code constants", () => {
		expect(AxiosError.ERR_BAD_OPTION_VALUE).toBe("ERR_BAD_OPTION_VALUE");
		expect(AxiosError.ERR_BAD_OPTION).toBe("ERR_BAD_OPTION");
		expect(AxiosError.ERR_NETWORK).toBe("ERR_NETWORK");
		expect(AxiosError.ERR_BAD_RESPONSE).toBe("ERR_BAD_RESPONSE");
		expect(AxiosError.ERR_BAD_REQUEST).toBe("ERR_BAD_REQUEST");
		expect(AxiosError.ERR_INVALID_URL).toBe("ERR_INVALID_URL");
		expect(AxiosError.ERR_CANCELED).toBe("ERR_CANCELED");
		expect(AxiosError.ECONNABORTED).toBe("ECONNABORTED");
		expect(AxiosError.ETIMEDOUT).toBe("ETIMEDOUT");
	});

	it("should serialize safely to JSON", () => {
		const error = new AxiosError("boom", AxiosError.ERR_NETWORK, {
			url: "http://example.com",
		} as any);

		expect(error.toJSON()).toMatchObject({
			message: "boom",
			name: "AxiosError",
			code: AxiosError.ERR_NETWORK,
			config: { url: "http://example.com" },
			status: undefined,
		});
	});

	it("should identify non-Axios errors correctly", () => {
		expect(isAxiosError(new Error("boom"))).toBe(false);
		expect(isAxiosError(null)).toBe(false);
		expect(isAxiosError({})).toBe(false);
	});
});

describe("CanceledError", () => {
	it("should set the canceled name, code and default message", () => {
		const error = new CanceledError(undefined);
		expect(error).toBeInstanceOf(AxiosError);
		expect(error.name).toBe("CanceledError");
		expect(error.code).toBe(AxiosError.ERR_CANCELED);
		expect(error.message).toBe("canceled");
	});
});
