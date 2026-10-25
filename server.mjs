import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(ROOT, 'data/rokai.sqlite');
mkdirSync(dirname(DB_PATH), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rates(id INTEGER PRIMARY KEY, period TEXT NOT NULL, minutes INTEGER NOT NULL, quantity INTEGER NOT NULL, price INTEGER NOT NULL, active INTEGER DEFAULT 1, valid_from TEXT DEFAULT '', valid_until TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS equipment(id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, status TEXT DEFAULT 'available');
CREATE TABLE IF NOT EXISTS rentals(id INTEGER PRIMARY KEY, customer TEXT NOT NULL, document TEXT NOT NULL, phone TEXT DEFAULT '', rate_id INTEGER REFERENCES rates(id), minutes INTEGER NOT NULL, price INTEGER NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, final_price INTEGER, created_by INTEGER REFERENCES users(id), ended_by INTEGER REFERENCES users(id), notes TEXT DEFAULT '', request_id TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS rental_equipment(rental_id INTEGER REFERENCES rentals(id), equipment_id INTEGER REFERENCES equipment(id), PRIMARY KEY(rental_id,equipment_id));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS faqs(id INTEGER PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, position INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts(user_id INTEGER PRIMARY KEY REFERENCES users(id), content TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
const all = (sql,...args)=>db.prepare(sql).all(...args);
const get = (sql,...args)=>db.prepare(sql).get(...args);
const run = (sql,...args)=>db.prepare(sql).run(...args);
const now = ()=>new Date().toISOString();
const hashToken = s=>createHash('sha256').update(s).digest('hex');
function passwordHash(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
function checkPassword(p,h) { const [s,v]=h.split(':'); return timingSafeEqual(scryptSync(p,s,64),Buffer.from(v,'hex')); }
function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const v=fn(); db.exec('COMMIT'); return v; } catch(e) { db.exec('ROLLBACK'); throw e; } }
function audit(user,action,entity){run('INSERT INTO audit(user_id,action,entity,created_at) VALUES(?,?,?,?)',user,action,String(entity),now());}
if(!get('SELECT id FROM rates LIMIT 1')) transaction(()=>{
 for(const [period,single,pair] of [['special',[5000,9000,13000,18000],[9000,16000,24000,32000]],['weekend',[7000,12000,17000,22000],[12000,22000,31000,40000]]])
  [15,30,45,60].forEach((minutes,i)=>[single,pair].forEach((prices,j)=>run('INSERT INTO rates(period,minutes,quantity,price) VALUES(?,?,?,?)',period,minutes,j+1,prices[i])));
 for(let i=1;i<=4;i++) for(const kind of ['scooter','helmet']) run('INSERT INTO equipment(code,kind) VALUES(?,?)',`${kind==='scooter'?'ROKAI':'CASCO'}-${String(i).padStart(2,'0')}`,kind);
 [['¿Qué necesito para alquilar?','Acércate a la estación con tu documento de identidad. Nuestro equipo realiza el registro y te explica las condiciones antes de salir.'],['¿El casco está incluido?','Sí. Te entregamos la patineta y el casco, junto con una breve inducción de seguridad.'],['¿Puedo reservar desde la página?','Por ahora el alquiler es presencial. Consulta las tarifas y visítanos en el Malecón de Arboletes.'],['¿Pueden conducir menores de edad?','Consulta las condiciones y la edad permitida con el equipo en la estación antes de contratar el servicio.'],['¿Qué métodos de pago reciben?','Consulta los medios de pago disponibles con nuestro equipo en la estación.']].forEach(([q,a],i)=>run('INSERT INTO faqs(question,answer,position) VALUES(?,?,?)',q,a,i));
 for(const [k,v] of Object.entries({location:'Malecón de Arboletes, Antioquia',hours:'8:00 a. m. a 10:00 p. m.',whatsapp:'573106817317',terms:'Las condiciones definitivas del servicio están pendientes de aprobación por ROKAI. Antes de contratar, consulta con el personal las reglas de uso, edad permitida, devolución, daños y tiempo adicional.',privacy:'El documento definitivo de privacidad está pendiente de aprobación por ROKAI. Esta versión registra datos de clientes para gestionar alquileres y restringe su acceso al personal autorizado. El responsable, canal de atención y plazo de conservación deben ser definidos antes de usar datos reales.',cookies:'Utilizamos una cookie de sesión necesaria para proteger el acceso del personal. Guardamos tus preferencias de cookies en este navegador. Esta versión no incorpora analítica, publicidad ni rastreadores de terceros.'})) run('INSERT INTO settings(key,value) VALUES(?,?)',k,v);
});
// Add contact fields to existing installations without overwriting edited settings.
for (const [key,value] of Object.entries({instagram:'roaki_patinetas',email:'rokai.pat@gmail.com'})) run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',key,value);
if(process.argv.includes('--create-user')){
 const [email,name,role='admin']=process.argv.slice(3); const password=process.env.ROKAI_PASSWORD;
 if(!email||!name||!password||password.length<12||!['admin','operator','worker'].includes(role)){console.error('Uso: ROKAI_PASSWORD=<12+ caracteres> npm run create-user -- correo "Nombre" [admin|operator|worker]');process.exit(1);}
 run('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',name,email.toLowerCase(),passwordHash(password),role); console.log('Usuario creado.'); process.exit(0);
}
const dummyHash=passwordHash(randomBytes(32).toString('hex'));
function fail(status,message){throw Object.assign(new Error(message),{status});}
function str(value,label,max=200,required=true){ if(typeof value!=='string'||value.length>max||(required&&!value.trim())) fail(400,`${label}: revisa el valor ingresado.`); return value.trim(); }
function integer(value,min,max,label){ if(!Number.isSafeInteger(value)||value<min||value>max) fail(400,`${label}: valor no válido.`); return value; }
function date(value){if(value===''||value===undefined)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(400,'Fecha no válida.');return value;}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const activeRates=()=>all("SELECT * FROM rates WHERE active=1 AND (valid_from='' OR valid_from<=?) AND (valid_until='' OR valid_until>=?) ORDER BY period,minutes,quantity",today(),today());
const settings=()=>Object.fromEntries(all('SELECT * FROM settings').map(x=>[x.key,x.value]));
const equipment=()=>all("SELECT e.*, EXISTS(SELECT 1 FROM rental_equipment re JOIN rentals r ON r.id=re.rental_id WHERE re.equipment_id=e.id AND r.ended_at IS NULL) AS busy FROM equipment e ORDER BY code");
function rentals(){return all('SELECT r.*, u.name AS created_name, e.name AS ended_name FROM rentals r JOIN users u ON u.id=r.created_by LEFT JOIN users e ON e.id=r.ended_by ORDER BY r.id DESC').map(r=>({...r,equipment:all('SELECT e.code,e.kind FROM equipment e JOIN rental_equipment re ON re.equipment_id=e.id WHERE re.rental_id=?',r.id)}));}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml'};
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(!path.startsWith('/api/')){
  if(!['GET','HEAD'].includes(req.method))fail(405,'Método no permitido.');
  const filename=['/','/gestion','/login','/terminos','/privacidad','/cookies'].includes(path)?'index.html':decodeURIComponent(path).slice(1);
  const target=resolve(ROOT,'public',filename);if(!target.startsWith(resolve(ROOT,'public')+'/')||!existsSync(target))fail(404,'Página no encontrada.');
  const data=readFileSync(target);res.writeHead(200,{'Content-Type':MIME[extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);return;
 }
 const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rokai_session='))?.slice(14);
 const session=token?get('SELECT s.*,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1',hashToken(token),Date.now()):null;
 let body={};
 if(!['GET','HEAD'].includes(req.method)){
  const origin=req.headers.origin; const expected=process.env.APP_ORIGIN||`http://${req.headers.host}`;
  if(origin!==expected)fail(403,'Origen de solicitud no autorizado.');
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Se requiere JSON.');
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768)fail(413,'Solicitud demasiado grande.');}
  try{body=JSON.parse(raw||'{}');}catch{fail(400,'JSON no válido.');} if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Solicitud no válida.');
 }
 if(req.method==='GET'&&path==='/api/public')return json({rates:activeRates(),faqs:all('SELECT * FROM faqs WHERE active=1 ORDER BY position,id'),settings:settings()});
 if(req.method==='GET'&&path==='/api/session')return json({user:session?{id:session.user_id,name:session.name,email:session.email,role:session.role}:null,csrf:session?.csrf});
 if(req.method==='POST'&&path==='/api/login'){
  const email=str(body.email,'Correo',254).toLowerCase(), password=str(body.password,'Contraseña',256);
  const key=hashToken(`${req.socket.remoteAddress}:${email}`), ipKey=hashToken(req.socket.remoteAddress||'unknown');
  for(const k of [key,ipKey]){const a=get('SELECT * FROM login_attempts WHERE key=?',k);if(a&&a.reset_at>Date.now()&&a.count>=(k===key?8:40))fail(429,'Demasiados intentos. Intenta de nuevo en 15 minutos.');}
  const user=get('SELECT * FROM users WHERE email=?',email);
  const valid=checkPassword(password,user?.password||dummyHash);
  if(!user||!valid||!user.active){for(const k of [key,ipKey])run('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',k,Date.now()+900000,Date.now(),Date.now());fail(401,'Correo o contraseña incorrectos.');}
  run('DELETE FROM login_attempts WHERE key=?',key);if(session)run('DELETE FROM sessions WHERE token=?',session.token);
  const value=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?,?)',hashToken(value),user.id,csrf,Date.now()+8*3600000);audit(user.id,'inicio_sesion',user.id);
  res.setHeader('Set-Cookie',`rokai_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);
  return json({user:{id:user.id,name:user.name,email:user.email,role:user.role},csrf});
 }
 if(!session)fail(401,'Inicia sesión para acceder al portal de gestión.');
 if(!['GET','HEAD'].includes(req.method)&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Solicitud de seguridad no válida. Recarga la página.');
 if(path==='/api/logout'&&req.method==='POST'){run('DELETE FROM sessions WHERE token=?',session.token);run('DELETE FROM drafts WHERE user_id=?',session.user_id);res.setHeader('Set-Cookie','rokai_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json({ok:true});}
 if(path==='/api/dashboard'&&req.method==='GET')return json({rentals:rentals(),equipment:equipment(),rates:activeRates()});
 if(path==='/api/draft'){
  if(req.method==='GET'){const draft=get('SELECT * FROM drafts WHERE user_id=? AND updated_at>?',session.user_id,Date.now()-86400000);return json(draft?JSON.parse(draft.content):{});}
  if(req.method==='PUT'){const safe={};for(const k of ['customer','document','phone','notes'])safe[k]=str(body[k]||'',k,k==='notes'?2000:200,false);for(const k of ['rate_id','equipment_ids','request_id'])if(body[k]!==undefined)safe[k]=body[k];run('INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at',session.user_id,JSON.stringify(safe),Date.now());return json({ok:true});}
  if(req.method==='DELETE'){run('DELETE FROM drafts WHERE user_id=?',session.user_id);return json({ok:true});}
 }
 if(path==='/api/rentals'&&req.method==='POST'){
  const customer=str(body.customer,'Nombre',120),document=str(body.document,'Documento',40),phone=str(body.phone||'','Teléfono',30,false),notes=str(body.notes||'','Novedades',2000,false),requestId=str(body.request_id,'Identificador',100);
  const result=transaction(()=>{
   const existing=get('SELECT id,created_by FROM rentals WHERE request_id=?',requestId);if(existing){if(existing.created_by!==session.user_id)fail(409,'Identificador ya utilizado.');return {id:existing.id};}
   const rate=activeRates().find(r=>r.id===body.rate_id);if(!rate)fail(400,'Selecciona una tarifa vigente.');
   const ids=body.equipment_ids;if(!Array.isArray(ids)||ids.length!==rate.quantity*2||new Set(ids).size!==ids.length)fail(400,'Asigna una patineta y un casco por persona.');
   const selected=equipment().filter(e=>ids.includes(e.id));
   if(selected.length!==ids.length||selected.some(e=>e.busy||e.status!=='available')||selected.filter(e=>e.kind==='scooter').length!==rate.quantity||selected.filter(e=>e.kind==='helmet').length!==rate.quantity)fail(409,'Algún equipo ya no está disponible. Revisa la selección.');
   const id=Number(run('INSERT INTO rentals(customer,document,phone,rate_id,minutes,price,started_at,created_by,notes,request_id) VALUES(?,?,?,?,?,?,?,?,?,?)',customer,document,phone,rate.id,rate.minutes,rate.price,now(),session.user_id,notes,requestId).lastInsertRowid);
   for(const eid of ids)run('INSERT INTO rental_equipment VALUES(?,?)',id,eid);audit(session.user_id,'crear_alquiler',id);run('DELETE FROM drafts WHERE user_id=?',session.user_id);return {id};
  });return json(result,201);
 }
 const finish=path.match(/^\/api\/rentals\/(\d+)\/finish$/);
 if(finish&&req.method==='POST'){
  const notes=str(body.notes||'','Novedades',2000,false);transaction(()=>{const r=get('SELECT * FROM rentals WHERE id=?',Number(finish[1]));if(!r)fail(404,'Alquiler no encontrado.');if(r.ended_at)fail(409,'El alquiler ya fue finalizado.');run('UPDATE rentals SET ended_at=?,ended_by=?,final_price=price,notes=? WHERE id=?',now(),session.user_id,[r.notes,notes].filter(Boolean).join('\n'),r.id);audit(session.user_id,'finalizar_alquiler',r.id);});return json({ok:true});
 }
 if(path.startsWith('/api/admin/')){
  if(session.role!=='admin')fail(403,'Esta función requiere permisos de administrador.');
  if(path==='/api/admin/data'&&req.method==='GET')return json({rates:all('SELECT * FROM rates ORDER BY period,minutes,quantity'),users:all('SELECT id,name,email,role,active FROM users'),faqs:all('SELECT * FROM faqs ORDER BY position,id'),settings:settings(),audit:all('SELECT a.*,u.name FROM audit a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 300')});
  if(path==='/api/admin/users'&&req.method==='POST'){
   const name=str(body.name,'Nombre',120),email=str(body.email,'Correo',254).toLowerCase(),pass=str(body.password,'Contraseña',256);if(pass.length<12)fail(400,'La contraseña debe tener al menos 12 caracteres.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Correo no válido.');if(!['admin','worker','operator'].includes(body.role))fail(400,'Rol no válido.');if(get('SELECT id FROM users WHERE email=?',email))fail(409,'Este correo ya está registrado.');transaction(()=>{const id=run('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',name,email,passwordHash(pass),body.role).lastInsertRowid;audit(session.user_id,'crear_usuario',id);});return json({ok:true},201);
  }
  const userMatch=path.match(/^\/api\/admin\/users\/(\d+)$/);
  if(userMatch&&req.method==='PATCH'){const id=Number(userMatch[1]);if(id===session.user_id)fail(400,'No puedes desactivar tu propia cuenta.');if(!get('SELECT id FROM users WHERE id=?',id))fail(404,'Usuario no encontrado.');const active=integer(body.active,0,1,'Estado');transaction(()=>{run('UPDATE users SET active=? WHERE id=?',active,id);run('DELETE FROM sessions WHERE user_id=?',id);audit(session.user_id,active?'activar_usuario':'desactivar_usuario',id);});return json({ok:true});}
  if(path==='/api/admin/rates'&&req.method==='POST'){
   const period=body.period;if(!['special','weekend'].includes(period))fail(400,'Período no válido.');const minutes=integer(body.minutes,1,480,'Duración'),quantity=integer(body.quantity,1,2,'Cantidad'),price=integer(body.price,0,10000000,'Precio'),from=date(body.valid_from),until=date(body.valid_until);if(from&&until&&from>until)fail(400,'La fecha final debe ser posterior a la inicial.');
   transaction(()=>{const id=run('INSERT INTO rates(period,minutes,quantity,price,valid_from,valid_until) VALUES(?,?,?,?,?,?)',period,minutes,quantity,price,from,until).lastInsertRowid;audit(session.user_id,'crear_tarifa',id);});return json({ok:true},201);
  }
  const rateMatch=path.match(/^\/api\/admin\/rates\/(\d+)$/);
  if(rateMatch&&req.method==='PATCH'){const id=Number(rateMatch[1]);if(!get('SELECT id FROM rates WHERE id=?',id))fail(404,'Tarifa no encontrada.');const price=integer(body.price,0,10000000,'Precio'),active=integer(body.active,0,1,'Estado'),from=date(body.valid_from),until=date(body.valid_until);if(from&&until&&from>until)fail(400,'Rango de fechas no válido.');transaction(()=>{run('UPDATE rates SET price=?,active=?,valid_from=?,valid_until=? WHERE id=?',price,active,from,until,id);audit(session.user_id,'editar_tarifa',id);});return json({ok:true});}
  if(path==='/api/admin/equipment'&&req.method==='POST'){const code=str(body.code,'Código',30);if(!['scooter','helmet'].includes(body.kind))fail(400,'Tipo no válido.');if(get('SELECT id FROM equipment WHERE code=?',code))fail(409,'El código ya existe.');transaction(()=>{const id=run('INSERT INTO equipment(code,kind) VALUES(?,?)',code,body.kind).lastInsertRowid;audit(session.user_id,'crear_equipo',id);});return json({ok:true},201);}
  const equipMatch=path.match(/^\/api\/admin\/equipment\/(\d+)$/);
  if(equipMatch&&req.method==='PATCH'){const id=Number(equipMatch[1]);if(!['available','maintenance','inactive'].includes(body.status))fail(400,'Estado no válido.');transaction(()=>{const e=equipment().find(x=>x.id===id);if(!e)fail(404,'Equipo no encontrado.');if(e.busy)fail(409,'No puedes modificar un equipo en alquiler.');run('UPDATE equipment SET status=? WHERE id=?',body.status,id);audit(session.user_id,'editar_equipo',id);});return json({ok:true});}
  if(path==='/api/admin/faqs'&&req.method==='POST'){const q=str(body.question,'Pregunta',200),a=str(body.answer,'Respuesta',2000);transaction(()=>{const id=run('INSERT INTO faqs(question,answer,position) VALUES(?,?,?)',q,a,integer(body.position,0,999,'Orden')).lastInsertRowid;audit(session.user_id,'crear_pregunta',id);});return json({ok:true});}
  const faqMatch=path.match(/^\/api\/admin\/faqs\/(\d+)$/);
  if(faqMatch&&req.method==='PATCH'){const id=Number(faqMatch[1]);if(!get('SELECT id FROM faqs WHERE id=?',id))fail(404,'Pregunta no encontrada.');const q=str(body.question,'Pregunta',200),a=str(body.answer,'Respuesta',2000),p=integer(body.position,0,999,'Orden'),active=integer(body.active,0,1,'Estado');transaction(()=>{run('UPDATE faqs SET question=?,answer=?,position=?,active=? WHERE id=?',q,a,p,active,id);audit(session.user_id,'editar_pregunta',id);});return json({ok:true});}
  if(path==='/api/admin/settings'&&req.method==='PUT'){const validated=[];for(const k of ['location','hours','whatsapp','instagram','email','terms','privacy','cookies']){const v=str(body[k]??'',k,10000,false);if(k==='whatsapp'&&v&&!/^\d{10,15}$/.test(v))fail(400,'WhatsApp: usa el número internacional sin + ni espacios.');if(k==='instagram'&&v&&!/^[A-Za-z0-9._]{1,30}$/.test(v))fail(400,'Instagram: escribe el usuario sin @ ni enlace.');if(k==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail(400,'Correo electrónico no válido.');validated.push([k,v]);}transaction(()=>{for(const [k,v] of validated)run('UPDATE settings SET value=? WHERE key=?',v,k);audit(session.user_id,'editar_configuracion','publica');});return json({ok:true});}
 }
 fail(404,'Recurso no encontrado.');
 }catch(e){if(!e.status)console.error(e);json({error:e.status?e.message:'No pudimos completar la solicitud.'},e.status||500);}
});
if(process.argv[1]===fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`ROKAI disponible en http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`));
