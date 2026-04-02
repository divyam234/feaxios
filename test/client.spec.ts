import {
	axios,
	AxiosError,
	CanceledError,
	defaultTransformer,
} from "../src/client";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	test,
	beforeAll,
	afterAll,
	mock,
} from "bun:test";
import { setupServer } from "msw/node";
import { HttpResponse, http } from "msw";
import { InternalAxiosRequestConfig } from "../src/types";

const posts = [
	{
		userId: 1,
		id: 1,
		title: "first post title",
		body: "first post body",
	},
];
const restHandlers = [
	http.get("http://test.com", () => {
		return HttpResponse.json(posts);
	}),
	http.get("http://test1.com", () => {
		return HttpResponse.text("hello");
	}),
	http.post("http://test1.com/post", (c) => {
		return new HttpResponse(c.request.body, { status: 200 });
	}),
	http.get("http://test1.com/timeout", async (c) => {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return HttpResponse.text("hello");
	}),
	http.get("http://test1.com/retry", async (c) => {
		return new HttpResponse("hello", { status: 500 });
	}),
];

describe("feaxios", () => {
	const jsonExample = "http://test.com";
	const testHost = "http://test1.com";

	const server = setupServer(...restHandlers);

	beforeAll(() => server.listen({}));

	afterAll(() => server.close());

	afterEach(() => server.resetHandlers());

	describe("basic functionality", () => {
		test("should return text and a 200 status for a simple GET request", async () => {
			const res = await axios(jsonExample);
			expect(res).toBeInstanceOf(Object);
			expect(res.status).toEqual(200);
			expect(res.data).toMatchObject(posts);
		});

		test("should return full url", async () => {
			const res = axios.getUri({
				url: "/test",
				baseURL: "http://test.com",
				params: { a: 1, b: 2 },
			});
			expect(res).toEqual("http://test.com/test?a=1&b=2");
		});

		test("should return full url merged params", async () => {
			const instance = axios.create({
				baseURL: "http://test.com",
				params: { a: 1, b: 2 },
			});
			const res = instance.getUri({
				url: "/test",
				params: { c: 1 },
			});
			expect(res).toEqual("http://test.com/test?a=1&b=2&c=1");
		});

		test("should not prepend baseURL to absolute urls", () => {
			const res = axios.getUri({
				url: "http://other.test/path",
				baseURL: "http://test.com",
			});
			expect(res).toBe("http://other.test/path");
		});

		test("should combine baseURL and relative urls without duplicate slashes", () => {
			const res = axios.getUri({
				url: "users",
				baseURL: "http://test.com/api/",
			});
			expect(res).toBe("http://test.com/api/users");
		});

		test("should keep existing query string when params are empty", () => {
			const res = axios.getUri({
				url: "http://test.com/test?x=1",
				params: {},
			});
			expect(res).toBe("http://test.com/test?x=1");
		});

		test("should return an Axios invalid url error", async () => {
			await expect(axios.get("http://[invalid")).rejects.toMatchObject({
				code: AxiosError.ERR_INVALID_URL,
			});
		});
	});

	describe("options.responseType", () => {
		it("should parse responses as JSON by default", async () => {
			const res = await axios.get(jsonExample);
			expect(res.data).toEqual(posts);
		});

		it("should fall back to text for non-JSON by default", async () => {
			const res = await axios.get(testHost);
			expect(res.data).toEqual("hello");
		});

		it("should keep XML as text by default", async () => {
			server.use(
				http.get("http://test.com/xml", () => {
					return HttpResponse.xml("<message>hello</message>");
				}),
			);

			const res = await axios.get("http://test.com/xml");
			expect(res.data).toBe("<message>hello</message>");
		});

		it("should force JSON for responseType:json", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "json",
			});
			expect(res.data).toEqual(posts);
		});

		it("should not parse empty strings for json responses", async () => {
			server.use(
				http.get("http://test.com/empty", () => {
					return HttpResponse.text("");
				}),
			);

			const res = await axios.get("http://test.com/empty", {
				responseType: "json",
			});
			expect(res.status).toBe(200);
			expect(res.data).toBe("");
		});

		it("should preserve empty strings for default responses", async () => {
			server.use(
				http.get("http://test.com/blank", () => {
					return HttpResponse.text("");
				}),
			);

			const res = await axios.get("http://test.com/blank");
			expect(res.data).toBe("");
		});

		it("should reject for failed JSON parse when responseType:json", async () => {
			try {
				await axios.get(testHost, {
					responseType: "json",
				});
			} catch (error) {
				expect(error).toBeInstanceOf(AxiosError);
				expect((error as AxiosError).code).toBe(AxiosError.ERR_BAD_RESPONSE);
				return;
			}

			throw new Error("expected request to fail");
		});

		it("should keep text responses as text when responseType:text", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "text",
			});
			expect(res.data).toEqual(JSON.stringify(posts));
		});

		it("should support arrayBuffer responseType", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "arrayBuffer",
			});
			expect(res.data).toBeInstanceOf(ArrayBuffer);
			expect(new TextDecoder().decode(res.data)).toEqual(JSON.stringify(posts));
		});

		it("should support blob responseType", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "blob",
			});
			expect(res.data).toBeInstanceOf(Blob);
			expect(await res.data.text()).toEqual(JSON.stringify(posts));
		});

		it("should support stream responseType", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "stream",
			});
			expect(res.data).not.toBeNull();
			expect(res.data).toBeInstanceOf(ReadableStream);
		});
	});

	describe("options.baseURL", () => {
		it("should resolve URLs relative to baseURL if provided", async () => {
			const data = { hello: "world" };
			const res = await axios.post("/post", data, {
				baseURL: testHost,
			});
			expect(res.status).toEqual(200);
			expect(res.data).toEqual(data);
		});
	});

	describe("options.body (request bodies)", () => {
		it("should issue POST requests (with JSON body)", async () => {
			const data = { hello: "world" };
			const res = await axios.post("/post", data, {
				baseURL: testHost,
			});
			expect(res.status).toEqual(200);
			expect(res.data).toMatchObject(data);
		});

		it("should transform falsy request bodies", async () => {
			const instance = axios.create({
				transformRequest: [(data) => String(data)],
			});
			const res = await instance.post("/post", 0, {
				baseURL: testHost,
			});
			expect(res.status).toEqual(200);
			expect(res.data).toEqual(0);
		});

		describe("FormData support", () => {
			it("should not send JSON content-type when data contains FormData", async () => {
				const formData = new FormData();
				formData.append("hello", "world");
				const res = await axios.post("/post", formData, {
					baseURL: testHost,
				});
				expect(res.status).toEqual(200);
				expect(res.data).toBeTypeOf("string");
			});

			it("should preserve native multipart uploads with Blob parts", async () => {
				let contentType = "";
				let uploadedFile = "";
				server.use(
					http.post("http://test1.com/upload", async ({ request }) => {
						contentType = request.headers.get("content-type") || "";
						const data = await request.formData();
						uploadedFile = await (data.get("file") as File).text();
						return HttpResponse.json({ ok: true });
					}),
				);

				const formData = new FormData();
				formData.append("file", new Blob(["hello multipart"]), "hello.txt");

				const res = await axios.post("/upload", formData, {
					baseURL: testHost,
				});

				expect(res.status).toEqual(200);
				expect(res.data).toEqual({ ok: true });
				expect(contentType).toContain("multipart/form-data");
				expect(uploadedFile).toBe("hello multipart");
			});

			it("send FormData when using postForm", async () => {
				const res = await axios.postForm(
					"/post",
					{ a: 1, b: 2 },
					{
						baseURL: testHost,
					},
				);
				expect(res.status).toEqual(200);
				expect(res.data).toBeTypeOf("string");
			});
		});

		it("should override the default transformRequest", async () => {
			const res = await axios.post(
				"/post",
				{ hello: "world" },
				{
					baseURL: testHost,
					transformRequest: [() => "hello=world"],
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
				},
			);
			expect(res.data).toEqual("hello=world");
		});

		it("should allow an array of request transformers", async () => {
			const res = await axios.post(
				"/post",
				{ foo: "bar" },
				{
					baseURL: testHost,
					transformRequest: [
						(data, headers) => defaultTransformer(data, headers),
						(data) => String(data).replace("bar", "baz"),
					],
				},
			);
			expect(res.data).toEqual({ foo: "baz" });
		});

		it("should allow request transforms to mutate headers", async () => {
			let authorization: string | null = null;
			server.use(
				http.post("http://test1.com/post", ({ request }) => {
					authorization = request.headers.get("x-authorization");
					return HttpResponse.text("ok");
				}),
			);

			await axios.post(
				"/post",
				{ foo: "bar" },
				{
					baseURL: testHost,
					transformRequest: [
						(data, headers) => {
							headers.set("x-authorization", "token");
							return defaultTransformer(data, headers);
						},
					],
				},
			);

			expect(authorization).toBe("token");
		});
	});

	describe("options.params & options.paramsSerializer", () => {
		it("should serialize numeric and boolean params", async () => {
			const params = { a: 1, b: true };
			const res = await axios.get(jsonExample, { params });
			expect(res.config.url).toEqual(`${jsonExample}?a=1&b=true`);
		});

		it("should merge params into existing url querystring", async () => {
			const params = { a: 1, b: true };
			const res = await axios.get(jsonExample + "?c=42", { params });
			expect(res.config.url).toEqual(`${jsonExample}?c=42&a=1&b=true`);
		});

		it("should accept a custom paramsSerializer function", async () => {
			const params = { a: 1, b: true };
			const paramsSerializer = () => "e=iamthelaw";
			const res = await axios.get(jsonExample, { params, paramsSerializer });
			expect(res.config.url).toEqual(`${jsonExample}?e=iamthelaw`);
		});

		it("should serialize arrays and nested objects", async () => {
			const res = await axios.get(jsonExample, {
				params: {
					tags: ["a", "b"],
					filter: { published: true },
					skip: null,
				},
			});
			expect(res.config.url).toEqual(
				`${jsonExample}?tags%5B%5D=a&tags%5B%5D=b&filter%5Bpublished%5D=true`,
			);
		});

		it("should skip null and undefined params", async () => {
			const res = await axios.get(jsonExample, {
				params: { a: 1, b: null, c: undefined },
			});
			expect(res.config.url).toEqual(`${jsonExample}?a=1`);
		});

		it("should allow validateStatus null to resolve 500 responses", async () => {
			const res = await axios.get("/retry", {
				baseURL: testHost,
				validateStatus: null,
			});
			expect(res.status).toBe(500);
			expect(res.data).toBe("hello");
		});
	});

	describe("options.params & options.paramsSerializer", () => {
		it("should throw timeout error", async () => {
			axios
				.get("/timeout", {
					baseURL: testHost,
					timeout: 300,
				})
				.catch((e) => {
					expect(e).toBeInstanceOf(AxiosError);
					expect(e.code).toBe(AxiosError.ECONNABORTED);
				});
		});

		it("should throw cancelled error", async () => {
			const controller = new AbortController();
			axios
				.get("/timeout", {
					baseURL: testHost,
					signal: controller.signal,
				})
				.catch((e) => {
					expect(e).toBeInstanceOf(CanceledError);
				});
			controller.abort();
		});

		it("should not throw timeout error", async () => {
			const res = await axios.get("/timeout", {
				baseURL: testHost,
				timeout: 2000,
			});
			expect(res.data).toEqual("hello");
		});

		it("should wrap fetch failures as ERR_NETWORK", async () => {
			const fetchError = new TypeError("Failed to fetch");
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mock(() =>
				Promise.reject(fetchError),
			) as unknown as typeof fetch;

			try {
				await axios.get("http://test.com");
			} catch (error) {
				expect(error).toBeInstanceOf(AxiosError);
				expect((error as AxiosError).code).toBe(AxiosError.ERR_NETWORK);
				expect((error as AxiosError & { cause?: unknown }).cause).toBe(
					fetchError,
				);
				return;
			} finally {
				globalThis.fetch = originalFetch;
			}

			throw new Error("expected request to fail");
		});
	});

	describe("interceptors", () => {
		beforeEach(function () {
			axios.interceptors.request.clear();
			axios.interceptors.response.clear();
		});

		afterAll(function () {
			axios.interceptors.request.clear();
			axios.interceptors.response.clear();
		});

		it("should add a request interceptor (asynchronous by default)", async () => {
			let asyncFlag = false;
			axios.interceptors.request.use(function (config) {
				config.headers.set("test", "added by interceptor");
				expect(asyncFlag).toBe(true);
				return config;
			});
			const p = axios(jsonExample);
			asyncFlag = true;
			const res = await p;
			expect(res.config.headers.get("test")).toBe("added by interceptor");
		});

		it("runs the interceptor if runWhen function is provided and resolves to true", () => {
			axios.interceptors.request.clear();
			axios.interceptors.request.use(
				function (config) {
					config.headers.set("test", "added by interceptor");
					return config;
				},
				null,
				{ runWhen: (config) => config.method === "get" },
			);
			axios(jsonExample).then((res) => {
				expect(res.config.headers.get("test")).toBe("added by interceptor");
			});
		});

		it("runs the interceptor if runWhen function is provided and resolves to true", () => {
			axios.interceptors.request.use(
				function (config) {
					config.headers.set("test", "added by interceptor");
					return config;
				},
				null,
				{ runWhen: (config) => config.method === "post" },
			);
			axios.get(jsonExample).then((res) => {
				expect(res.config.headers.get("test")).toBeNull();
			});
		});

		it("should add a response interceptor that returns a new data object", () => {
			axios.interceptors.response.use((v) => {
				return {
					...v,
					data: "stuff",
				};
			});
			axios(jsonExample).then((res) => {
				expect(res.data).toBe("stuff");
			});
		});

		it("test chain of response middleware", () => {
			axios.interceptors.response.use((v) => {
				return {
					...v,
					data: "stuff",
				};
			});
			axios.interceptors.response.use((v) => {
				return {
					...v,
					data: "hello",
				};
			});
			axios(jsonExample).then((res) => {
				expect(res.data).toBe("hello");
			});
		});

		it("should preserve the same AxiosError instance from interceptors", async () => {
			const error = new AxiosError("boom", AxiosError.ERR_BAD_REQUEST);
			axios.interceptors.request.use(() => {
				throw error;
			});

			await expect(axios(jsonExample)).rejects.toBe(error);
		});

		it("should chain response transforms like axios", async () => {
			const res = await axios.get(jsonExample, {
				transformResponse: [
					(data) => ({ posts: data }),
					(data) => ({ ...data, count: data.posts.length }),
				],
			});
			expect(res.data).toEqual({ posts, count: 1 });
		});

		it("should execute request interceptors in registration order", async () => {
			const seen: string[] = [];
			axios.interceptors.request.use((config) => {
				seen.push("first");
				return config;
			});
			axios.interceptors.request.use((config) => {
				seen.push("second");
				return config;
			});

			await axios.get(jsonExample);
			expect(seen).toEqual(["first", "second"]);
		});

		it("should run rejected request interceptors when a request interceptor throws", async () => {
			const error = new Error("boom");
			axios.interceptors.request.use(() => {
				throw error;
			});
			axios.interceptors.request.use(
				(config) => config,
				(err) => {
					throw new AxiosError(String(err.message), AxiosError.ERR_BAD_REQUEST);
				},
			);

			await expect(axios.get(jsonExample)).rejects.toMatchObject({
				code: AxiosError.ERR_BAD_REQUEST,
				message: "boom",
			});
		});
	});

	describe("defaultTransformer", () => {
		let headers: Headers;

		beforeEach(() => {
			headers = new Headers();
		});

		test("should set content-type to text/plain for string data", () => {
			const data = "Hello, World!";
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("text/plain");
		});

		test("should set content-type to application/x-www-form-urlencoded for URLSearchParams", () => {
			const data = new URLSearchParams({ key: "value" });
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe(
				"application/x-www-form-urlencoded",
			);
		});

		test("should set content-type to application/octet-stream for Blob", () => {
			const data = new Blob();
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("application/octet-stream");
		});

		test("should set content-type to application/octet-stream for ArrayBuffer", () => {
			const data = new ArrayBuffer(16);
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("application/octet-stream");
		});

		test("should set content-type to application/octet-stream for TypedArray", () => {
			const data = new Uint8Array(16);
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("application/octet-stream");
		});

		test("should set content-type to application/json for plain object", () => {
			const data = { key: "value" };
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("application/json");
		});

		test("should not overwrite existing content-type", () => {
			headers.set("content-type", "custom/type");
			const data = "Hello, World!";
			defaultTransformer(data, headers);
			expect(headers.get("content-type")).toBe("custom/type");
		});

		test("should convert plain object to URLSearchParams if content-type is application/x-www-form-urlencoded", () => {
			headers.set("content-type", "application/x-www-form-urlencoded");
			const data = { key: "value" };
			const transformedData = defaultTransformer(data, headers);
			expect(transformedData.toString()).toBe(
				new URLSearchParams(data).toString(),
			);
		});

		test("should stringify object if content-type is application/json", () => {
			headers.set("content-type", "application/json");
			const data = { key: "value" };
			const transformedData = defaultTransformer(data, headers);
			expect(transformedData).toBe(JSON.stringify(data));
		});

		test("should leave primitive json values serializable", () => {
			headers.set("content-type", "application/json");
			expect(defaultTransformer(123, headers)).toBe(123);
		});
	});
});
