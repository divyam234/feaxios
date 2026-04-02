import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/plugins/index.ts",
		"src/plugins/retry.ts",
		"src/plugins/logger.ts",
		"src/plugins/cookie-jar.ts",
	],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	splitting: false,
	treeshake: true,
	target: "es2022",
	minify: "terser",
});
