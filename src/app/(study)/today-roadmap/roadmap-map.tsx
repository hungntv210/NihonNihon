'use client';
import {Mascot} from '../../../components/mascot.tsx';
import styles from './roadmap-map.module.css';
type Stage={week:number;level:string;date:string;count:number};
const regions=[['N5','Làng khởi đầu'],['N4','Phố ven sông'],['N3','Đường qua núi'],['N2','Thành phố tri thức']] as const;
const gates:Record<string,string>={N4:'04/07/2027',N3:'05/12/2027',N2:'02/07/2028'};
export function RoadmapMap({stages,current}:{stages:Stage[];current:number}){
 function openWeek(week:number){const detail=document.getElementById('week-'+week);if(detail instanceof HTMLDetailsElement){detail.open=true;detail.scrollIntoView({block:'start'});detail.querySelector('summary')?.focus();}}
 return <div className={styles.map} aria-label="Bản đồ lộ trình 87 tuần">
  <p className={styles.legend}>■ Đã qua theo lịch · ◎ Hiện tại · ◇ Sắp tới<br/><small>Mỗi chặng mở chi tiết bên dưới. Chặng đã qua chưa có nghĩa là đã học xong.</small></p>
  {regions.map(([level,name])=>{
   const weeks=stages.filter(s=>s.level===level),height=weeks.length*90+130;
   const nodes=weeks.map((stage,i)=>({...stage,x:500+Math.sin(i*Math.PI/3)*230,y:65+i*90}));
   const path=nodes.map((n,i)=>i?`C${nodes[i-1].x} ${n.y-45},${n.x} ${n.y-45},${n.x} ${n.y}`:`M${n.x} ${n.y}`).join(' ');
   return <section className={styles.region} data-level={level} key={level} aria-label={level+' · '+name}>
    <header><div><p className="eyebrow">{level} · {weeks.length} CHẶNG</p><h3>{name}</h3></div>{gates[level]&&<div className={styles.gate}><svg aria-hidden="true" viewBox="0 0 80 60"><path d="M4 6h72v7H4zM10 21h60v6H10zM17 12h7v43h-7zM56 12h7v43h-7z" fill="currentColor"/></svg><span>Mốc thi dự kiến<br/><strong>{gates[level]}</strong></span></div>}</header>
    <div className={styles.plot} style={{height}}>
     <svg className={styles.terrain} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id={'terrain-'+level} width="220" height="270" patternUnits="userSpaceOnUse">
       {level==='N5'?<path d="M20 80h40V45H20zM12 45l28-24 28 24zM38 80v12M144 178h28v-32h-28zM136 146l22-30 22 30z"/>:level==='N4'?<><path d="M10 90q45-30 90 0t90 0M10 102q45-30 90 0t90 0" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M160 202v-55h30v55zM152 147l23-23 23 23z"/></>:level==='N3'?<path d="m10 120 60-100 60 100zm105 93 45-74 45 74z"/>:<path d="M14 110V36h30v74zM48 110V16h34v94zM89 110V51h25v59zM145 245v-70h45v70z"/>}
      </pattern></defs>
      <rect width="1000" height={height} fill={`url(#terrain-${level})`}/>
      <path d={path} fill="none" stroke="var(--color-border)" strokeWidth="30"/><path d={path} fill="none" stroke="var(--color-surface)" strokeWidth="23"/><path d={path} fill="none" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="8 12"/>
     </svg>
     {nodes.map(stage=>{const state=stage.week<current?'past':stage.week===current?'current':'future';return <button type="button" key={stage.week} className={styles.node} data-state={state} style={{left:stage.x/10+'%',top:stage.y}} onClick={()=>openWeek(stage.week)} aria-label={`Tuần ${stage.week} · ${level} · ${state==='past'?'Đã qua theo lịch':state==='current'?'Hiện tại':'Sắp tới'} · ${stage.count} mục`} aria-current={state==='current'?'step':undefined}>
      {state==='current'&&<Mascot species="turtle" size={54}/>}<span className={styles.marker} aria-hidden="true">{state==='past'?'■':state==='current'?'◎':'◇'}</span><strong>Tuần {stage.week}</strong><small>{state==='past'?'Đã qua theo lịch':state==='current'?'Hiện tại':'Sắp tới'}</small>
     </button>})}
    </div>
   </section>;
  })}
 </div>;
}
