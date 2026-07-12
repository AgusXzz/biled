import { defineConfig, globalIgnores } from "eslint/config"
import js from "@eslint/js"

export default defineConfig([
	globalIgnores(["node_modules", "WAProto", "proto-extract", "auth_info"]),
	{
		plugins: {
			js,
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
		},
		linterOptions: {
			reportUnusedDisableDirectives: "off",
		},
		rules: {
			"no-unused-vars": "off",
			"no-constant-condition": "error",
			"no-constant-binary-expression": "error",
			"no-trailing-spaces": "error",
			"no-multiple-empty-lines": "error",
			"no-unneeded-ternary": "error",
			eqeqeq: "error",
			"prefer-const": "error",
			"prefer-arrow-callback": "error",
		},
	},
])
