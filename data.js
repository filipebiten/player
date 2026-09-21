// Listas do rodízio. EDITE AQUI para adicionar/remover canais e cursos.
// NÃO altere name, handle, channelId nem query dos itens existentes:
// o progresso salvo (canal concluído) é indexado por handle/channelId/query.
// Em PLATFORMS, lastLesson é só o valor inicial de "onde parei";
// depois de editado no app, vale o que foi salvo (localStorage/Gist).
const WEEKS = [
  { label: "Semana 1", channels: [
    { name: "JesusCopy", handle: "thejesuscopy", type: "channel" },
    { name: "Elevation Português", handle: "elevationportugues", type: "channel" },
    { name: "Hernandes Dias Lopes", handle: "hernandesdiaslopesoficial", type: "channel" },
    { name: "Andrea Vargas", query: "andrea vargas", type: "search" },
    { name: "IP Semear", handle: "ipsemear", type: "channel" },
    { name: "Thiago Nigro", handle: "ThiagoNigro", type: "channel" },
  ]},
  { label: "Semana 2", channels: [
    { name: "Pro Nobis Editora", handle: "ProNobisEditora", type: "channel" },
    { name: "Escola do Discípulo", channelId: "UCXDIsJpQCOi88jpt_AUGWbg", type: "channel" },
    { name: "Heber Campos Jr", handle: "HeberCamposJrOficial", type: "channel" },
    { name: "Talitha Pereira", handle: "TalithaPereira", type: "channel" },
    { name: "ICTV Online", handle: "ictv.online", type: "channel" },
    { name: "Escola Didaskalia", handle: "EscolaDidaskalia", type: "channel" },
    { name: "Casa da Rocha", handle: "casadarocha", type: "channel" },
  ]},
  { label: "Semana 3", channels: [
    { name: "Canal Eleve", handle: "CanalEleve", type: "channel" },
    { name: "Igreja Esperança", handle: "IgrejaEsperanca", type: "channel" },
    { name: "Família JesusCopy", handle: "familiajesuscopy", type: "channel" },
    { name: "L'Abri Brasil", handle: "labribrasil", type: "channel" },
    { name: "A Central Online", handle: "acentralonlineoficial", type: "channel" },
    { name: "PIB Guarapari", handle: "pibguarapari", type: "channel" },
    { name: "Pr. Elizeu Rodrigues", handle: "pastorelizeurodrigues", type: "channel" },
    { name: "Você Mais Rico", handle: "vocemaisrico", type: "channel" },
  ]},
  { label: "Semana 4", channels: [
    { name: "Escola Charles Spurgeon", handle: "EscolaCharlesSpurgeon", type: "channel" },
    { name: "Igreja Vértice", handle: "igrejavertice", type: "channel" },
    { name: "Igreja DT", handle: "igrejadt", type: "channel" },
    { name: "Minha Igreja na Cidade", handle: "MinhaIgrejanaCidade", type: "channel" },
    { name: "Ministério Fiel", handle: "ministeriofiel", type: "channel" },
    { name: "Bastter", handle: "Bastter", type: "channel" },
  ]},
];

const PLATFORMS = [
  { name: "Loop — Invisible College", url: "https://loop.hubinvisiblecollege.com.br/", color: "#8B5CF6",
    courses: [{ name: "O Cuidado Integral do Ser Humano", lastLesson: "" }] },
  { name: "Hotmart", url: "https://hotmart.com/pt-br/club/ultra-black-friday-1", color: "#EF4444",
    courses: [{ name: "Investidor 33 Dias", lastLesson: "Módulo 6" }] },
  { name: "Coursify — Logos", url: "https://logos-portugues.coursify.me/student/courses/curso-completo-do-logos/sections/196358/contents/552596", color: "#3B82F6",
    courses: [{ name: "Curso Completo do Logos", lastLesson: "Aula Layouts" }] },
];
