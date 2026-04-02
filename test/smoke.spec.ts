import axiosDefault, * as mod from "../src";
import { describe, expect, it } from "bun:test";

describe("module smoke", () => {
	it("should expose the default client and named error helpers", () => {
		expect(typeof axiosDefault).toBe("function");
		expect(mod.default).toBe(axiosDefault);
		expect(typeof mod.AxiosError).toBe("function");
		expect(typeof mod.CanceledError).toBe("function");
		expect(typeof mod.isAxiosError).toBe("function");
	});
});
