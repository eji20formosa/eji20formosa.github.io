(() => {
  const $ = (id) => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const nav = $("mainNav"), menu = $("menuToggle");
  menu.addEventListener("click", () => {
    const opened = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(opened));
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

  const modal = $("loginModal");
  const openModal = () => { modal.classList.add("show"); modal.setAttribute("aria-hidden", "false"); $("email").focus(); };
  const closeModal = () => { modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true"); };
  $("loginOpen").addEventListener("click", openModal);
  $("loginClose").addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target.dataset.close) closeModal(); });

  const cfg = window.EJI20_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("PEGAR_") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("PEGAR_");
  if (!configured || !window.supabase) return;
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  // Si ya existe una sesión, el botón de acceso lleva directamente al panel.
  client.auth.getSession().then(({data:{session}})=>{
    if(session){ const access=$("loginOpen"); access.textContent="Ir al panel"; access.href="panel.html"; access.removeAttribute("data-modal-open"); access.addEventListener("click",e=>{e.preventDefault();location.href="panel.html";}); }
  });

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("loginMessage"); msg.textContent = "Ingresando…";
    const { error } = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) { msg.textContent = "No se pudo iniciar sesión. Revisá el correo y la contraseña."; return; }
    location.href = "panel.html";
  });

  const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function loadPublic() {
    const { data, error } = await client.from("events").select("id,title,description,event_date,created_at").eq("status","published").order("event_date",{ascending:false}).limit(6);
    if (error || !data?.length) return;
    $("publicEvents").innerHTML = data.map(ev => `<article class="news-card"><div class="news-card-top"><span>✿ ACTIVIDAD ESCOLAR</span><time>${new Date(ev.event_date+"T12:00:00").toLocaleDateString("es-AR")}</time></div><h3>${escapeHtml(ev.title)}</h3><p>${escapeHtml(ev.description)}</p></article>`).join("");
    const { data: photos } = await client.from("event_photos").select("id,event_id,public_url,created_at,events!inner(status)").eq("events.status","published").order("created_at",{ascending:false}).limit(9);
    if (photos?.length) $("publicGallery").innerHTML = photos.map(p => `<a class="gallery-photo" href="${escapeHtml(p.public_url)}" target="_blank" rel="noopener"><img loading="lazy" src="${escapeHtml(p.public_url)}" alt="Fotografía de una actividad escolar"></a>`).join("");
  }
  loadPublic();
})();