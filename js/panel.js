(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.EJI20_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("PEGAR_") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("PEGAR_");
  if (!configured || !window.supabase) { document.body.innerHTML = '<main class="container section"><h1>Falta configurar Supabase</h1><p>Configurá URL y clave publicable en js/config.js.</p><a href="index.html">Volver</a></main>'; return; }
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let currentUser, profile;
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateFmt = d => new Date(d+"T12:00:00").toLocaleDateString("es-AR");
  const msg = (id,text) => { $(id).textContent=text; };

  async function init() {
    const { data:{session} } = await db.auth.getSession();
    if (!session) { location.href="index.html"; return; }
    currentUser=session.user; $("userEmail").textContent=currentUser.email;
    const { data, error } = await db.from("profiles").select("id,full_name,role").eq("id",currentUser.id).single();
    if(error || !data) { msg("roleBanner","No se encontró tu perfil. Contactá a la dirección."); return; }
    profile=data;
    if(!["director","teacher"].includes(profile.role)){msg("roleBanner","Tu cuenta todavía no tiene permisos habilitados. Contactá a la dirección."); $("eventForm").hidden=true;return;}
    $("roleBanner").textContent = profile.role==="director" ? "Sesión de dirección: tenés permisos de administración." : "Sesión docente: tus publicaciones serán revisadas por la dirección.";
    if(profile.role==="director") { $("pendingSection").hidden=false; $("usersSection").hidden=false; loadPending(); loadUsers(); }
    loadMine();
  }
  $("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.href="index.html";});
  $("refreshBtn").addEventListener("click",()=>{loadMine();if(profile?.role==="director"){loadPending();loadUsers();}});
  $("eventForm").addEventListener("submit",async e=>{
    e.preventDefault(); const button=$("publishBtn");button.disabled=true;msg("eventMessage","Subiendo publicación…");
    try {
      const title=$("eventTitle").value.trim(), description=$("eventDescription").value.trim(), event_date=$("eventDate").value;
      const files=[...$("eventImages").files]; if(files.length>5) throw new Error("Podés adjuntar hasta 5 imágenes.");
      for(const f of files){if(!["image/jpeg","image/png","image/webp"].includes(f.type))throw new Error("Usá imágenes JPG, PNG o WEBP.");if(f.size>5*1024*1024)throw new Error("Cada imagen debe pesar menos de 5 MB.");}
      const status=profile.role==="director"?"published":"pending";
      const {data:event,error}=await db.from("events").insert({title,description,event_date,created_by:currentUser.id,status}).select().single();if(error)throw error;
      for(const f of files){const ext=f.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";const path=`${currentUser.id}/${event.id}/${crypto.randomUUID()}.${ext}`;
        const {error:upErr}=await db.storage.from("event-photos").upload(path,f,{contentType:f.type,upsert:false});if(upErr)throw upErr;
        const {data:pub}=db.storage.from("event-photos").getPublicUrl(path);
        const {error:photoErr}=await db.from("event_photos").insert({event_id:event.id,storage_path:path,public_url:pub.publicUrl,uploaded_by:currentUser.id});if(photoErr)throw photoErr;}
      msg("eventMessage",status==="published"?"¡Publicación publicada!":"¡Enviada! La directora deberá aprobarla antes de que sea visible.");$("eventForm").reset();loadMine();if(profile.role==="director")loadPending();
    }catch(err){console.error(err);msg("eventMessage",err.message||"Ocurrió un error al guardar.");}finally{button.disabled=false;}
  });
  $("teacherForm").addEventListener("submit",async e=>{
    e.preventDefault();const button=$("createTeacherBtn");button.disabled=true;msg("teacherMessage","Creando cuenta docente…");
    try{
      const payload={full_name:$("teacherName").value.trim(),email:$("teacherEmail").value.trim().toLowerCase(),password:$("teacherPassword").value};
      if(payload.password.length<8)throw new Error("La contraseña debe tener al menos 8 caracteres.");
      const {data,error}=await db.functions.invoke("crear-docente",{body:payload});
      if(error)throw new Error(error.message||"No se pudo crear la cuenta.");
      if(data?.error)throw new Error(data.error);
      msg("teacherMessage","Cuenta creada correctamente. Compartí email y contraseña inicial de forma privada.");
      $("teacherForm").reset();loadUsers();
    }catch(err){console.error(err);msg("teacherMessage",err.message||"Error creando la cuenta.");}
    finally{button.disabled=false;}
  });
  async function loadMine(){
    const {data,error}=await db.from("events").select("id,title,event_date,status,created_at").eq("created_by",currentUser.id).order("created_at",{ascending:false});
    if(error){$("myEvents").textContent="No se pudieron cargar las publicaciones.";return;}
    $("myEvents").innerHTML=data.length?data.map(e=>`<article class="admin-item"><div><strong>${esc(e.title)}</strong><small>${dateFmt(e.event_date)}</small></div><span class="status status-${e.status}">${e.status==="published"?"Publicado":e.status==="pending"?"Pendiente":"Rechazado"}</span></article>`).join(""):'<p class="muted">Todavía no realizaste publicaciones.</p>';
  }
  async function loadPending(){
    const {data,error}=await db.from("events").select("id,title,description,event_date,created_at,created_by").eq("status","pending").order("created_at",{ascending:true});
    if(error){$("pendingEvents").textContent="No se pudieron cargar las publicaciones pendientes.";return;}
    $("pendingEvents").innerHTML=data.length?data.map(e=>`<article class="pending-item"><div><strong>${esc(e.title)}</strong><small>${dateFmt(e.event_date)} · ${esc(e.created_by)}</small><p>${esc(e.description)}</p></div><div class="pending-actions"><button class="button button-primary" data-approve="${e.id}">Aprobar</button><button class="button button-danger" data-reject="${e.id}">Rechazar</button></div></article>`).join(""):'<p class="muted">No hay publicaciones pendientes.</p>';
    $("pendingEvents").querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>moderate(b.dataset.approve,"published")));
    $("pendingEvents").querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>moderate(b.dataset.reject,"rejected")));
  }
  async function moderate(id,status){const {error}=await db.from("events").update({status}).eq("id",id);if(error){alert("No se pudo actualizar la publicación.");return;}loadPending();loadMine();}
  async function loadUsers(){
    const {data,error}=await db.from("profiles").select("id,full_name,role,created_at").order("created_at",{ascending:true});
    if(error){$("usersList").textContent="No se pudieron cargar los perfiles.";return;}
    $("usersList").innerHTML=data.length?data.map(u=>`<article class="admin-item"><div><strong>${esc(u.full_name||"Sin nombre")}</strong><small>${esc(u.role==="director"?"Cuenta de dirección":"Docente")}</small></div><span class="status">${esc(u.role)}</span></article>`).join(""):'<p class="muted">Todavía no hay cuentas.</p>';
  }
  init();
})();