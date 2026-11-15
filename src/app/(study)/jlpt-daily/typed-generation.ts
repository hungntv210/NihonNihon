import {questionSchema,type Provider} from './generation.ts';
import {requireValue,type Draft} from './model.ts';

export function nonOrderPrompt(prompt:string){return prompt.replace(/For order,[\s\S]*?Paragraph has/u,'Paragraph has').replace('Other types use order=[] and starSlot=0.','').replaceAll('grammar/order/paragraph','grammar/paragraph').replaceAll('all8 types','requested types').replaceAll('grammar/order/paragraph','grammar/paragraph').replaceAll('order/','');}
export function typedQuestionSchema(count:number,order:boolean){
 const {order:orderField,starSlot,...properties}=questionSchema.items.properties;
 return {...questionSchema,minItems:count,maxItems:count,items:{...questionSchema.items,properties:{...properties,type:{type:'string',enum:questionSchema.items.properties.type.enum.filter(t=>order?t==='order':t!=='order')},...(order?{order:orderField,starSlot}:{})},required:questionSchema.items.required.filter(k=>order||!['order','starSlot'].includes(k))}};
}
export async function generateTypedRows(provider:Provider,prompt:string,payload:(positions:number[])=>unknown,slots:{position:number;type:string}[],positions:number[]){
 const rows:Draft[]=[];
 for(const order of [false,true]){
  const selected=positions.filter(p=>(slots.find(s=>s.position===p)!.type==='order')===order);if(!selected.length)continue;
  const output=await provider('generate',order?prompt:nonOrderPrompt(prompt),payload(selected),typedQuestionSchema(selected.length,order));
  requireValue(Array.isArray(output)&&output.length===selected.length,'INCOMPLETE_TYPED_GENERATION');
  for(const row of output){requireValue(row&&selected.includes(row.position)&&(row.type==='order')===order,'WRONG_TYPED_GENERATION');if(!order)requireValue(!('order' in row)&&!('starSlot' in row),'NON_ORDER_SCHEMA_FIELDS');rows.push(order?row:{...row,order:[],starSlot:0});}
 }
 return rows;
}
