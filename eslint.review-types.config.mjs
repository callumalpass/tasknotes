import baseConfig from "./eslint.config.mjs";

export default baseConfig.map((config) => {
	const project = config.languageOptions?.parserOptions?.project;

	if (project !== "./tsconfig.json") {
		return config;
	}

	return {
		...config,
		languageOptions: {
			...config.languageOptions,
			parserOptions: {
				...config.languageOptions.parserOptions,
				project: "./tsconfig.review-types.json",
			},
		},
		rules: {
			...config.rules,
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
		},
	};
});
