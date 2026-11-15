import type {ReactNode} from 'react';
import {Mascot,type Species} from './mascot.tsx';
export function RouteHeading({title,eyebrow,children,species='shiba'}:{title:string;eyebrow?:string;children:ReactNode;species?:Species}) {
 return <header className="page-heading route-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><div className="route-subtitle">{children}</div></div><Mascot species={species}/></header>;
}
