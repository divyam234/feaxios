import { axios, AxiosError, CanceledError } from "../src/client";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	test,
	beforeAll,
	afterAll,
} from "vitest";
import { setupServer } from "msw/node";
import { HttpResponse, http } from "msw";

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
			const instance = axios.create({ baseURL: "http://test.com",params: { a: 1, b: 2 }})
			const res = instance.getUri({
				url: "/test",
				params: { c: 1 },
			});
			expect(res).toEqual("http://test.com/test?a=1&b=2&c=1");
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

		it("should force JSON for responseType:json", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "json",
			});
			expect(res.data).toEqual(posts);
		});

		it("should fall back to undefined for failed JSON parse", async () => {
			const res = await axios.get(testHost, {
				responseType: "json",
			});
			expect(res.data).toEqual(undefined);
		});

		it("should still parse JSON when responseType:text", async () => {
			const res = await axios.get(jsonExample, {
				responseType: "text",
			});
			expect(res.data).toEqual(posts);
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

			it("send FormData when using postForm", async () => {
				const res = await axios.postForm("/post", {a:1,b:2}, {
					baseURL: testHost,
				});
				expect(res.status).toEqual(200);
				expect(res.data).toBeTypeOf("string");
			});
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

		it("should accept a URLSearchParams instance", async () => {
			const params = new URLSearchParams({ d: "test" });
			const res = await axios.get(jsonExample, { params });
			expect(res.config.url).toEqual(`${jsonExample}?d=test`);
		});

		it("should accept a custom paramsSerializer function", async () => {
			const params = { a: 1, b: true };
			const paramsSerializer = () => "e=iamthelaw";
			const res = await axios.get(jsonExample, { params, paramsSerializer });
			expect(res.config.url).toEqual(`${jsonExample}?e=iamthelaw`);
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
	});
});
