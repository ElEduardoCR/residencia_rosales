export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "rosales-appearance";

/** Runs in the document head, before the first paint; contains no user input. */
export const THEME_BOOTSTRAP = `(function(){var t;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`;
