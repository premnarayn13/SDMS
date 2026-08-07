export const cleanMarkdownSymbols = (str) => (str || '').replace(/#{1,6}\s?/g, '').replace(/\*{1,3}/g, '').trim();
