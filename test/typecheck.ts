import axios, { type AxiosResponse, type RuntimeFetchOptions } from "../src";
import cookieJar, { CookieJar } from "../src/plugins/cookie-jar";
import logger from "../src/plugins/logger";
import retry from "../src/plugins/retry";

function expectType<T>(_value: T) {}

const fetchOptions: RuntimeFetchOptions = {
	agent: {},
	dispatcher: {},
	headers: { foo: "bar" },
};

expectType<RuntimeFetchOptions>(fetchOptions);

const textPromise = axios.get("/user", {
	responseType: "text",
	fetchOptions,
});

const arrayBufferPromise = axios.get("/user", {
	responseType: "arrayBuffer",
});

const blobPromise = axios.get("/user", {
	responseType: "blob",
});

const streamPromise = axios.get("/user", {
	responseType: "stream",
});

expectType<Promise<AxiosResponse<string>>>(textPromise);
expectType<Promise<AxiosResponse<ArrayBuffer>>>(arrayBufferPromise);
expectType<Promise<AxiosResponse<Blob>>>(blobPromise);
expectType<Promise<AxiosResponse<ReadableStream<Uint8Array> | null>>>(
	streamPromise,
);

expectType<typeof axios>(axios.use(retry, { retries: 1 }) as typeof axios);
expectType<typeof axios>(
	axios.use(logger, {
		onRequest: (context) => context.startedAt,
		onResponse: (context) => context.duration,
		onError: (context) => context.error,
	}) as typeof axios,
);
expectType<typeof axios>(
	axios.use(cookieJar, { jar: new CookieJar() }) as typeof axios,
);
