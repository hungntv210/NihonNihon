export type Weather='clear'|'cloudy'|'drizzle'|'rain'|'snow'|'fog'|'wind';
export const weatherLabels:Record<Weather,string>;
export const weatherWeights:number[][];
export const tsuyuWeights:number[];
export function weightsFor(date:string):number[];
export function dailyWeather(date:string,period?:string):Weather;
export function isWet(weather:string):boolean;
export function overcast(weather:string):boolean;
