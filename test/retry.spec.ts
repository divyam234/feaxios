import axios, { AxiosError } from "../src";
import retry, {
	exponentialDelay,
	isIdempotentRequestError,
	isNetworkError,
	isNetworkOrIdempotentRequestError,
	isRetryableError,
	isSafeRequestError,
} from "../src/plugins/retry";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

let getAttempts = 0;
let postAttempts = 0;

const server = setupServer(
	http.get("http://retry.test/test", () => {
		getAttempts += 1;
		return getAttempts < 2
			? HttpResponse.text("Failed", { status: 500 })
			: HttpResponse.text("It worked!", { status: 200 });
	}),
	http.get("http://retry.test/fail-always", () => {
		getAttempts += 1;
		return HttpResponse.text("Failed", { status: 500 });
	}),
	http.post("http://retry.test/test", async ({ request }) => {
		postAttempts += 1;
		const body = await request.json();
		expect(body).toEqual({ a: "b" });
		return postAttempts < 2
			? HttpResponse.text("Failed", { status: 500 })
			: HttpResponse.text("ok", { status: 200 });
	}),
);

const NETWORK_ERROR = new AxiosError("Some connection error");
NETWORK_ERROR.code = "ECONNRESET";

function createRetryError(method?: string, status?: number, code?: string) {
	const error = new AxiosError("Error response");
	if (method) {
		error.config = { method } as AxiosError["config"];
	}
	if (status !== undefined) {
		error.response = { status } as AxiosError["response"];
	}
	if (code) {
		error.code = code;
	}
	return error;
}

describe("retry plugin", () => {
	beforeAll(() => server.listen({}));
	afterEach(() => {
		getAttempts = 0;
		postAttempts = 0;
		server.resetHandlers();
	});
	afterAll(() => server.close());

	it("retries a failed request and eventually succeeds", async () => {
		const client = axios.create();
		client.use(retry, { retries: 1, retryCondition: () => true });

		const res = await client.get("http://retry.test/test");
		expect(res.status).toBe(200);
		expect(res.data).toBe("It worked!");
		expect(getAttempts).toBe(2);
		expect(res.config.retry?.retryCount).toBe(1);
	});

	it("does not retry when the retry condition is false", async () => {
		const client = axios.create();
		client.use(retry, { retries: 3, retryCondition: () => false });

		await expect(
			client.get("http://retry.test/fail-always"),
		).rejects.toMatchObject({
			response: { status: 500 },
		});
		expect(getAttempts).toBe(1);
	});

	it("supports async retry conditions", async () => {
		const client = axios.create();
		client.use(retry, { retries: 1, retryCondition: async () => true });

		const res = await client.get("http://retry.test/test");
		expect(res.status).toBe(200);
		expect(getAttempts).toBe(2);
	});

	it("uses request-specific retry config over client defaults", async () => {
		const client = axios.create();
		client.use(retry, { retries: 0 });

		const res = await client.get("http://retry.test/test", {
			retry: { retries: 1, retryCondition: () => true },
		});

		expect(res.status).toBe(200);
		expect(getAttempts).toBe(2);
	});

	it("calls onRetry for each retry attempt", async () => {
		const client = axios.create();
		const retryCounts: number[] = [];
		client.use(retry, { retries: 1, retryCondition: () => true, onRetry });
		function onRetry(retryCount: number) {
			retryCounts.push(retryCount);
		}

		await client.get("http://retry.test/test");
		expect(retryCounts).toEqual([1]);
	});

	it("uses the custom retryDelay callback", async () => {
		const client = axios.create();
		let delayCalls = 0;
		const retryDelay = () => {
			delayCalls += 1;
			return 0;
		};
		client.use(retry, { retries: 1, retryCondition: () => true, retryDelay });

		await client.get("http://retry.test/test");
		expect(delayCalls).toBe(1);
	});

	it("does not run transformRequest twice across retries", async () => {
		let transformCalls = 0;
		const client = axios.create({
			transformRequest: [
				(data) => {
					transformCalls += 1;
					return JSON.stringify(data);
				},
			],
		});
		client.use(retry, { retries: 1, retryCondition: () => true });

		const res = await client.post("http://retry.test/test", { a: "b" });
		expect(res.status).toBe(200);
		expect(transformCalls).toBe(1);
		expect(postAttempts).toBe(2);
	});

	it("adds retry interceptors via use()", () => {
		const client = axios.create();
		// @ts-ignore
		expect(client.interceptors.request.handlers.length).toBe(0);
		// @ts-ignore
		expect(client.interceptors.response.handlers.length).toBe(0);

		client.use(retry, { retries: 1 });

		// @ts-ignore
		expect(client.interceptors.request.handlers.length).toBe(1);
		// @ts-ignore
		expect(client.interceptors.response.handlers.length).toBe(1);
	});
});

describe("retry helpers", () => {
	it("detects network errors", () => {
		const error = new AxiosError();
		error.code = "ECONNREFUSED";
		expect(isNetworkError(error)).toBe(true);
		expect(
			isNetworkError(createRetryError("get", undefined, "ECONNABORTED")),
		).toBe(false);
		expect(isNetworkError(createRetryError("get", 500))).toBe(false);
	});

	it("detects retryable errors", () => {
		expect(isRetryableError(createRetryError("get", 500))).toBe(true);
		expect(isRetryableError(createRetryError("get", 404))).toBe(false);
		expect(
			isRetryableError(createRetryError("get", undefined, "ECONNABORTED")),
		).toBe(false);
	});

	it("detects safe request errors", () => {
		expect(isSafeRequestError(createRetryError("get", 500))).toBe(true);
		expect(isSafeRequestError(createRetryError("GET", 500))).toBe(true);
		expect(isSafeRequestError(createRetryError("post", 500))).toBe(false);
	});

	it("detects idempotent request errors", () => {
		expect(isIdempotentRequestError(createRetryError("put", 500))).toBe(true);
		expect(isIdempotentRequestError(createRetryError("DELETE", 500))).toBe(
			true,
		);
		expect(isIdempotentRequestError(createRetryError("patch", 500))).toBe(
			false,
		);
	});

	it("detects network or idempotent errors", () => {
		const network = new AxiosError();
		network.code = "ECONNREFUSED";
		expect(isNetworkOrIdempotentRequestError(network)).toBe(true);
		expect(
			isNetworkOrIdempotentRequestError(createRetryError("put", 500)),
		).toBe(true);
		expect(
			isNetworkOrIdempotentRequestError(createRetryError("post", 404)),
		).toBe(false);
	});

	it("computes exponential delay", () => {
		const delay = exponentialDelay(2, undefined, 100);
		expect(delay).toBeGreaterThanOrEqual(400);
		expect(delay).toBeLessThan(500);
	});
});
