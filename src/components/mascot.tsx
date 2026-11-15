export type Species = 'shiba' | 'tanuki' | 'fox' | 'cat' | 'owl' | 'bird' | 'crane' | 'turtle';
export function Mascot({species='shiba',pose='normal',size=80}:{species?:Species;pose?:'normal'|'happy'|'cheer'|'sleepy';size?:number}) {
 return <img className="pixel-mascot" src={'/mascots/'+species+'-'+pose+'.svg'} alt="" aria-hidden="true" width={size} height={size} decoding="async" />;
}
