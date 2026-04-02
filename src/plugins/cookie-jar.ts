import type { AxiosPlugin, AxiosResponse } from "../types";
import type {
	AxiosCookieJarConfig,
	InternalAxiosRequestConfig,
} from "../types";
export * from "tough-cookie";

function getUrl(config?: InternalAxiosRequestConfig) {
	return config?.url || "";
}

function splitSetCookieHeader(value: string) {
	return value
		.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/)
		.map((cookie) => cookie.trim())
		.filter(Boolean);
}

function getSetCookieHeaders(response: AxiosResponse) {
	const headers = response.headers as Headers & {
		getSetCookie?: () => string[];
		raw?: () => Record<string, string[]>;
	};

	if (typeof headers.getSetCookie === "function") {
		return headers.getSetCookie();
	}

	if (typeof headers.raw === "function") {
		return headers.raw()["set-cookie"] || [];
	}

	const setCookie = response.headers.get("set-cookie");
	return setCookie ? splitSetCookieHeader(setCookie) : [];
}

async function storeCookies(
	config: InternalAxiosRequestConfig | undefined,
	response: AxiosResponse | undefined,
	jar: AxiosCookieJarConfig["jar"],
) {
	if (!config || !response) {
		return;
	}

	const url = getUrl(config);
	if (!url) {
		return;
	}

	for (const cookie of getSetCookieHeaders(response)) {
		await jar.setCookie(cookie, url);
	}
}

const cookieJar: AxiosPlugin<AxiosCookieJarConfig> = (instance, options) => {
	if (!options?.jar) {
		return;
	}

	instance.interceptors.request.use(async (config) => {
		config.fetchOptions ||= {};
		if (config.fetchOptions.credentials == null && !config.withCredentials) {
			config.fetchOptions.credentials = "omit";
		}

		if (!config.headers.has("cookie")) {
			const url = getUrl(config);
			if (url) {
				const cookie = await options.jar.getCookieString(url);
				if (cookie) {
					config.headers.set("cookie", cookie);
				}
			}
		}
		return config;
	});

	instance.interceptors.response.use(
		async (response) => {
			await storeCookies(response.config, response, options.jar);
			return response;
		},
		async (error) => {
			await storeCookies(error?.config, error?.response, options.jar);
			return Promise.reject(error);
		},
	);
};

export default cookieJar;
