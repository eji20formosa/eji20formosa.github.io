# EJI N.º 20 – Nuestra Señora de Fátima

Sitio institucional estático para GitHub Pages, con autenticación, publicaciones y galería administradas mediante Supabase.

## Qué incluye

- Sitio público adaptable a celulares.
- Información institucional y escudo compartido.
- Inicio de sesión privado (sin registro público).
- Roles individuales: `teacher` y `director`.
- Las publicaciones de maestras quedan `pending`.
- La directora puede aprobar o rechazar publicaciones.
- Publicaciones aprobadas y fotografías visibles públicamente.
- Archivos de hasta 5 MB por imagen, JPG/PNG/WEBP.

## Antes de publicar: datos que faltan

1. Crear el Gmail institucional.
2. Confirmar la dirección exacta de la escuela.
3. Confirmar cómo se distribuyen las 12 secciones entre turnos y salas.
4. Definir el correo de la directora y los correos de cada docente.
5. Obtener las autorizaciones institucionales/familiares necesarias para publicar fotografías de niñas y niños.

## A. Crear el proyecto Supabase

1. Entrá en https://supabase.com/ y creá una cuenta/proyecto gratuito.
2. Elegí una contraseña fuerte para la base de datos y guardala de forma segura.
3. En el proyecto, abrí **SQL Editor**.
4. Creá una consulta nueva, copiá todo el contenido de `supabase/schema.sql` y ejecutalo.
5. En **Project Settings → API** (o Connect), copiá la **Project URL** y la clave pública **anon / publishable**.
6. Abrí `js/config.js` y reemplazá los dos valores de ejemplo:

```js
window.EJI20_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE"
};
```

La clave pública puede estar en el frontend porque las políticas RLS de la base de datos controlan el acceso. **Nunca uses la clave `service_role` ni la clave secreta en el sitio.**

## B. Crear las cuentas privadas

1. En Supabase, entrá en **Authentication → Users → Add user**.
2. Creá manualmente el usuario de la directora y cada maestra, con el correo institucional/individual correspondiente.
3. Desactivá cualquier opción de registro público si estuviera habilitada. El sitio no ofrece registro abierto.
4. Una vez creados los usuarios, abrí **SQL Editor** y ejecutá, reemplazando el correo:

```sql
update public.profiles p
set role = 'director'
from auth.users u
where p.id = u.id
  and u.email = 'CORREO_DE_LA_DIRECTORA';
```

Las demás cuentas quedan con rol `teacher` automáticamente. Compartí las credenciales de forma privada y pedí que cada persona establezca una contraseña propia. No envíes contraseñas por grupos.

## C. Publicar gratis en GitHub Pages

1. Creá/iniciá sesión en https://github.com/.
2. Creá un repositorio público llamado `eji20-formosa`.
3. Subí el contenido de esta carpeta (no la carpeta ZIP) a la raíz del repositorio.
4. En el repositorio, abrí **Settings → Pages**.
5. En **Build and deployment**, elegí **Deploy from a branch**.
6. Seleccioná `main` y `/ (root)`, luego **Save**.
7. Esperá unos minutos. La dirección será similar a:
   `https://TU-USUARIO.github.io/eji20-formosa/`

## D. Prueba antes de anunciar la web

- Abrí el sitio en una ventana privada y verificá que la parte pública cargue.
- Probá iniciar sesión con una cuenta de maestra.
- Creá una publicación y verificá que quede pendiente.
- Iniciá sesión como directora y aprobala.
- Confirmá que el evento y sus fotos aparezcan públicamente.
- Probá que una maestra no pueda aprobar publicaciones ni cambiar su rol.

## Mantenimiento y privacidad

- El plan gratuito de Supabase tiene límites y condiciones de inactividad; revisá el panel de uso y las condiciones vigentes.
- El bucket de imágenes es público: una URL de imagen puede compartirse. No subas fotos privadas ni imágenes de menores sin autorización expresa y validación de la institución.
- La web no incluye datos personales de niñas/os ni listados de alumnos.
- Hacé copias de seguridad periódicas de las fotos y de los datos institucionales.
- No publiques teléfonos personales, domicilios privados ni credenciales.

## Estructura

- `index.html`: sitio público.
- `panel.html`: panel privado.
- `css/styles.css`: estilos.
- `js/config.js`: configuración pública de Supabase.
- `js/site.js`: login y carga de eventos públicos.
- `js/panel.js`: publicaciones, carga de fotos y moderación.
- `supabase/schema.sql`: tablas, roles y políticas de seguridad.
- `assets/escudo-eji20.jfif`: escudo de la institución.

## Nota sobre el alcance de esta primera versión

El proyecto queda preparado para conectar a Supabase, pero no puede iniciar sesión ni almacenar publicaciones hasta que se cree el proyecto Supabase, se ejecute el SQL y se peguen sus credenciales públicas en `js/config.js`. El alojamiento GitHub Pages también requiere que el repositorio se cree desde una cuenta GitHub.
