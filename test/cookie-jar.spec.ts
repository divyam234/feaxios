import axios from "../src";
import cookieJar, { CookieJar } from "../src/plugins/cookie-jar";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

let seenCookie = "";

const server = setupServer(
	http.get(
		"http://cookie.test/login",
		() =>
			new HttpResponse(null, {
				status: 204,
				headers: { "set-cookie": "session=abc123; Path=/; HttpOnly" },
			}),
	),
	http.get("http://cookie.test/login-multi", () => {
		const headers = new Headers();
		headers.append("set-cookie", "session=abc123; Path=/; HttpOnly");
		headers.append("set-cookie", "theme=dark; Path=/");
		return new HttpResponse(null, { status: 204, headers });
	}),
	http.get("http://cookie.test/me", ({ request }) => {
		seenCookie = request.headers.get("cookie") || "";
		return HttpResponse.json({ ok: true });
	}),
	http.get("http://cookie.test/explicit", ({ request }) => {
		seenCookie = request.headers.get("cookie") || "";
		return HttpResponse.json({ ok: true });
	}),
	http.get("http://cookie-explicit.test/explicit", ({ request }) => {
		seenCookie = request.headers.get("cookie") || "";
		return HttpResponse.json({ ok: true });
	}),
);

describe("cookie jar plugin", () => {
	beforeAll(() => server.listen({}));
	afterEach(() => {
		seenCookie = "";
		server.resetHandlers();
	});
	afterAll(() => server.close());

	it("should store set-cookie headers and send cookies on later requests", async () => {
		const client = axios.create();
		client.use(cookieJar, { jar: new CookieJar() });

		const login = await client.get("http://cookie.test/login", {
			validateStatus: null,
		});
		expect(login.status).toBe(204);

		const res = await client.get("http://cookie.test/me");
		expect(res.status).toBe(200);
		expect(seenCookie).toContain("session=abc123");
	});

	it("should not overwrite an explicit cookie header", async () => {
		const client = axios.create();
		client.use(cookieJar, { jar: new CookieJar() });

		await client.get("http://cookie.test/login", {
			validateStatus: null,
		});

		await client.get("http://cookie-explicit.test/explicit", {
			headers: { cookie: "manual=yes" },
		});

		expect(seenCookie).toBe("manual=yes");
	});

	it("should store multiple set-cookie headers", async () => {
		const client = axios.create();
		client.use(cookieJar, { jar: new CookieJar() });

		const login = await client.get("http://cookie.test/login-multi", {
			validateStatus: null,
		});
		expect(login.status).toBe(204);

		await client.get("http://cookie.test/me");
		expect(seenCookie).toContain("session=abc123");
		expect(seenCookie).toContain("theme=dark");
	});
});
