// Configuración de La Dulcería.
// Pega aquí los dos valores de Supabase > Project Settings > API.
// Si los dejas vacíos, las páginas funcionan en modo demo (los pedidos solo viajan entre pestañas del mismo navegador).
window.DULCERIA = {
  supabaseUrl: 'https://mcoojpyglyrjizfwjdwz.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jb29qcHlnbHlyaml6ZndqZHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDg3NDUsImV4cCI6MjEwODYyNDc0NX0.rygQPvUpnXjuRmdLuDi1qTd9tsBedih9n3xoCB8K8RA',  // clave "anon public": es pública
  mesas: 8           // si lo cambias, cambia también el 8 en supabase.sql
};
