export type Definition={id:string;title:string;crop:number;nativeHeight?:(host:HTMLElement,scale:number)=>number;params:Record<string,number>;mount?:(host:HTMLElement,options:SceneOptions)=>PixelEngine};
export type SceneOptions={time:string;season:string;date:string;motion?:boolean;params?:Record<string,number>};
export type PixelEngine={params:(values:Record<string,number>)=>void;set:(values:Partial<SceneOptions>)=>void;destroy:()=>void;complete:()=>void;stats:()=>Record<string,unknown>;drawAt:(seconds:number)=>void;followTrain?:()=>void;raf:number;state:SceneOptions&{frames:number};visible:boolean;sync:()=>void};
export const SceneEngine:{Engine:new(host:HTMLElement,definition:Definition,options:SceneOptions)=>PixelEngine};
