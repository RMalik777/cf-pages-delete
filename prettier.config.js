//  @ts-check

/** @type {import('prettier').Config} */
const config = {
	tabWidth: 2,
	useTabs: true,
	printWidth: 100,
	plugins: ["prettier-plugin-tailwindcss"],
	tailwindStylesheet: "./src/styles.css",
	tailwindFunctions: ["clsx", "cn", "cva", "twMerge", "tv"],
};

export default config;
