export const parseRiskCard = (item) => typeof item === 'string' ? JSON.parse(item) : item;
