/* Offline date-driven scene decorations. Dates are taken from the unchanged engine's state.date. */

 export const tsukimiDates={2021:'09-21',2022:'09-10',2023:'09-29',2024:'09-17',2025:'10-06',2026:'09-25',2027:'09-15',2028:'10-03',2029:'09-22',2030:'09-12',2031:'10-01',2032:'09-19',2033:['09-08','10-07'],2034:'09-27',2035:'09-16',2036:'10-04',2037:'09-24',2038:'09-13',2039:'10-02',2040:'09-21',2041:'09-10',2042:'09-28',2043:'09-17',2044:'10-05',2045:'09-25',2046:'09-15',2047:'10-04',2048:'09-22',2049:'09-11',2050:'09-30'};
 // NAOJ: https://eco.mtk.nao.ac.jp/koyomi/wiki/C3E6BDA9A4CECCBEB7EEA4C8A4CF.html
 export const catalog=[
  {id:'hatsumode',scene:'shadowing-inari',label:'Tết · Hatsumōde',monthDay:'01-02',time:'night',season:'winter',window:'1–3/1'},
  {id:'hanami',scene:'home-tokyo',label:'Hanami · Ngắm hoa',monthDay:'04-01',time:'day',season:'spring',window:'20/3–10/4'},
  {id:'tanabata',scene:'vocab-market',label:'Tanabata · Thất tịch',monthDay:'07-07',time:'sunset',season:'summer',window:'7/7'},
  {id:'matsuri',scene:'home-tokyo',label:'Lễ hội mùa hè · Pháo hoa',monthDay:'08-01',time:'night',season:'summer',window:'20/7–31/8; pháo hoa ban đêm'},
  {id:'tsukimi',scene:'grammar-kinkakuji',label:'Tsukimi · Ngắm trăng',time:'night',season:'autumn',window:'Theo lịch NAOJ từng năm (2021–2050)'}
 ];
 export function eventFor(scene,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;const year=Number(date.slice(0,4)),md=date.slice(5),month=Number(date.slice(5,7)),day=Number(date.slice(8)),check=new Date(Date.UTC(year,month-1,day));if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;let id=null;
  if(scene==='shadowing-inari'&&md>='01-01'&&md<='01-03')id='hatsumode';
  if(scene==='home-tokyo'&&md>='03-20'&&md<='04-10')id='hanami';
  if(scene==='home-tokyo'&&md>='07-20'&&md<='08-31')id='matsuri';
  if(scene==='vocab-market'&&md==='07-07')id='tanabata';
  if(scene==='grammar-kinkakuji'&&[tsukimiDates[year]].flat().includes(md))id='tsukimi';
  return catalog.find(e=>e.id===id)||null;
 }
