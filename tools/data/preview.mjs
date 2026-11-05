import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {args,need} from './core.mjs';

export function createPreviewServer({dbPath,mediaRoot}) {
  need(fs.existsSync(dbPath),'Database does not exist; run importer first');
  const db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const mediaBase=mediaRoot?fs.realpathSync(mediaRoot):null;
  const catalogue={vocab:['vocab','v.word','v.reading'],kanji:['kanji','v.character',"''"],grammar:['grammar','v.pattern','v.reading'],sentence:['sentences','v.text_ja',"''"]};
  function detail(id) {
    const item=db.prepare('SELECT * FROM content_items WHERE item_id=?').get(id);need(item,'Item not found');
    const translations=db.prepare('SELECT translation_id,field,text_vi,method,match_method,status,needs_refresh,source_id,release_id,context_json FROM vi_translations WHERE item_id=? ORDER BY field,status DESC,text_vi').all(id);
    const examples=db.prepare('SELECT s.* FROM item_sentences e JOIN sentences s ON s.item_id=e.sentence_id WHERE e.item_id=? ORDER BY e.position').all(id);
    const strokes=db.prepare("SELECT stroke_no,path_d FROM kanji_strokes WHERE kanji_id=? AND variant='' ORDER BY stroke_no").all(id);
    const segments=db.prepare('SELECT e.*,s.text_ja,s.text_en FROM clip_segments e JOIN sentences s ON s.item_id=e.sentence_id WHERE e.clip_id=? ORDER BY e.position').all(id);
    const assets=db.prepare('SELECT asset_id,asset_kind,storage_ref FROM media_assets WHERE item_id=?').all(id).map(a=>({asset_id:a.asset_id,asset_kind:a.asset_kind,youtube:a.storage_ref.startsWith('youtube:')?a.storage_ref.slice(8):null}));
    return {item,translations,examples,strokes,segments,assets};
  }
  const server=http.createServer(async(req,res)=>{
    const address=server.address(),host=`127.0.0.1:${address.port}`,origin=`http://${host}`;
    const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; media-src 'self'; object-src 'none'; base-uri 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
    if(req.headers.host!==host)return send(403,{error:'Use the printed loopback URL'});
    try {
      const url=new URL(req.url,origin);
      if(req.method==='POST'&&url.pathname==='/api/report-error') {
        if(req.headers.origin!==origin)return send(403,{error:'Origin rejected'});
        let body='';for await(const chunk of req){body+=chunk;need(Buffer.byteLength(body)<=4096,'Report too large');}
        const {translation_id,reason}=JSON.parse(body);need(typeof reason==='string'&&reason.trim()&&reason.length<=1000,'Reason required (max 1000 chars)');
        need(db.prepare('SELECT 1 FROM vi_translations WHERE translation_id=?').get(translation_id),'Unknown translation');
        db.prepare('INSERT INTO translation_reports VALUES (?,?,?,?,?)').run(randomUUID(),translation_id,reason.normalize('NFC').trim(),new Date().toISOString(),'open');return send(201,{saved:true});
      }
      if(req.method!=='GET')return send(405,{error:'Method not allowed'});
      if(url.pathname==='/')return send(200,fs.readFileSync(new URL('preview.html',import.meta.url),'utf8'),'text/html; charset=utf-8');
      if(url.pathname==='/preview.js')return send(200,fs.readFileSync(new URL('preview-client.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
      if(url.pathname==='/api/report')return send(200,JSON.parse(db.prepare("SELECT report_json FROM import_runs WHERE status='committed' ORDER BY finished_at DESC LIMIT 1").get()?.report_json || '{}'));
      if(url.pathname==='/api/detail')return send(200,detail(url.searchParams.get('id')));
      if(url.pathname==='/api/items') {
        const kind=url.searchParams.get('kind') || 'kanji',q=url.searchParams.get('q') || '',offset=Number(url.searchParams.get('offset') || 0);need(Number.isSafeInteger(offset)&&offset>=0&&q.length<=200,'Invalid query');
        if(kind==='clip')return send(200,db.prepare("SELECT c.item_id,COALESCE(json_extract(r.manifest_json,'$.title'),c.source_key) label,'' reading FROM content_items c JOIN source_releases r ON r.release_id=c.release_id WHERE c.kind='clip' AND c.is_active=1 AND COALESCE(json_extract(r.manifest_json,'$.title'),c.source_key) LIKE ? ORDER BY c.item_id LIMIT 50 OFFSET ?").all('%'+q+'%',offset));
        need(catalogue[kind],'Unknown kind');const [table,label,reading]=catalogue[kind];
        return send(200,db.prepare(`SELECT v.*,${label} label,${reading} display_reading FROM ${table} v JOIN content_items c ON c.item_id=v.item_id WHERE c.is_active=1 AND (${label} LIKE ? OR COALESCE(${reading},'') LIKE ? OR EXISTS(SELECT 1 FROM vi_translations t WHERE t.item_id=v.item_id AND t.text_vi LIKE ?)) ORDER BY v.item_id LIMIT 50 OFFSET ?`).all('%'+q+'%','%'+q+'%','%'+q+'%',offset));
      }
      if(url.pathname==='/api/lookup') {
        const term=url.searchParams.get('text') || '';need(term.length>0&&term.length<=200,'Lookup text required');
        const matches=db.prepare('SELECT DISTINCT v.* FROM vocab v LEFT JOIN vocab_forms f ON f.item_id=v.item_id WHERE v.word=? OR v.reading=? OR f.form=? LIMIT 20').all(term,term,term);
        return send(200,matches.map(v=>({...v,translations:detail(v.item_id).translations})));
      }
      if(url.pathname.startsWith('/media/')) {
        need(mediaBase,'Set --media-root to serve private files');
        const row=db.prepare('SELECT storage_ref FROM media_assets WHERE asset_id=? AND private_only=1').get(decodeURIComponent(url.pathname.slice(7)));
        need(row && !row.storage_ref.startsWith('youtube:'),'Unknown private media');
        const real=fs.realpathSync(row.storage_ref),relative=path.relative(mediaBase,real);
        need(relative && !relative.startsWith('..')&&!path.isAbsolute(relative),'Media outside configured root');
        const mime={'.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg'}[path.extname(real).toLowerCase()];need(mime,'Unsupported media extension');
        const size=fs.statSync(real).size;let start=0,end=size-1,status=200;
        if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);need(m,'Invalid Range');start=Number(m[1]);end=m[2]?Number(m[2]):end;need(start<=end&&end<size,'Range outside media');status=206;}
        res.writeHead(status,{'Content-Type':mime,'Accept-Ranges':'bytes','Content-Length':end-start+1,...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});fs.createReadStream(real,{start,end}).pipe(res);return;
      }
      return send(404,{error:'Not found'});
    } catch(error){return send(400,{error:error.message.startsWith('ENOENT')?'File unavailable':error.message});}
  });
  server.on('close',()=>db.close());return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{const a=args(['db','port','media-root']);need(a.db,'Usage: --db FILE [--port 8766] [--media-root PRIVATE_DIR]');const port=Number(a.port || 8766);need(Number.isInteger(port)&&port>0&&port<65536,'Invalid port');createPreviewServer({dbPath:a.db,mediaRoot:a['media-root']}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
