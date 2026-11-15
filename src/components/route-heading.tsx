import type {ReactNode} from 'react';
import {Mascot,type Species} from './mascot.tsx';
export function RouteHeading({title,eyebrow,children,species='shiba',heading='h1'}:{title:string;eyebrow?:string;children:ReactNode;species?:Species;heading?:'h1'|'h2'}) {
 const Heading=heading;
 return <header className="page-heading route-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<Heading>{title}</Heading><div className="route-subtitle">{children}</div></div><Mascot species={species}/></header>;
}
