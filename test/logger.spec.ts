import axios from "../src";
import { AxiosError } from "../src/client";
import logger from "../src/plugins/logger";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
	http.get("http://logger.test/ok", () => HttpResponse.json({ ok: true })),
	http.get("http://logger.test/fail", () =>
		HttpResponse.json({ ok: false }, { status: 500 }),
	),
);

describe("logger plugin", () => {
	beforeAll(() => server.listen({}));
	afterEach(() => {
		server.resetHandlers();
	});
	afterAll(() => server.close());

	it("should call request and response callbacks", async () => {
		const requestCalls: any[] = [];
		const responseCalls: any[] = [];
		const client = axios.create();
		client.use(logger, {
			onRequest: (context) => requestCalls.push(context),
			onResponse: (context) => responseCalls.push(context),
		});

		const res = await client.get("http://logger.test/ok");

		expect(res.status).toBe(200);
		expect(requestCalls).toHaveLength(1);
		expect(responseCalls).toHaveLength(1);
		expect(requestCalls[0]).toMatchObject({
			method: "GET",
			url: "http://logger.test/ok",
		});
		expect(requestCalls[0].headers).toBeInstanceOf(Headers);
		expect(requestCalls[0].startedAt).toBeGreaterThanOrEqual(0);
		expect(responseCalls[0]).toMatchObject({
			method: "GET",
			url: "http://logger.test/ok",
			status: 200,
		});
		expect(responseCalls[0].response).toBe(res);
		expect(responseCalls[0].duration).toBeGreaterThanOrEqual(0);
	});

	it("should call error callback and preserve request failure", async () => {
		const errorCalls: any[] = [];
		const client = axios.create();
		client.use(logger, { onError: (context) => errorCalls.push(context) });

		await expect(client.get("http://logger.test/fail")).rejects.toMatchObject({
			response: { status: 500 },
		});

		expect(errorCalls).toHaveLength(1);
		expect(errorCalls[0]).toMatchObject({
			method: "GET",
			url: "http://logger.test/fail",
		});
		expect(errorCalls[0].error).toBeInstanceOf(AxiosError);
		expect(errorCalls[0].duration).toBeGreaterThanOrEqual(0);
	});

	it("should not change the successful response payload", async () => {
		const client = axios.create();
		client.use(logger, {
			onRequest: () => {},
			onResponse: () => {},
			onError: () => {},
		});

		const res = await client.get("http://logger.test/ok");

		expect(res.data).toEqual({ ok: true });
		expect(res.status).toBe(200);
	});

	it("should call error callback for request-interceptor failures", async () => {
		const errorCalls: any[] = [];
		const client = axios.create();
		client.use(logger, { onError: (context) => errorCalls.push(context) });
		client.interceptors.request.use(() => {
			throw new Error("request boom");
		});

		await expect(client.get("http://logger.test/ok")).rejects.toThrow(
			"request boom",
		);

		expect(errorCalls).toHaveLength(1);
		expect(errorCalls[0]).toMatchObject({
			error: expect.any(Error),
		});
	});
});
