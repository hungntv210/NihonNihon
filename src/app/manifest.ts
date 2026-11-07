import type { MetadataRoute } from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'Nihon Nihon',short_name:'Nihon',lang:'vi',start_url:'/',display:'standalone',background_color:'#f7f6f1',theme_color:'#f7f6f1',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]};}
