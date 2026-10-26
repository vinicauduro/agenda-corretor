// Leitura do XML de imóveis gerado pelo site (ImobiBrasil, "portal personalizado").
// O formato exato do arquivo da Cocal ainda não foi visto, então a leitura é
// tolerante: procura a lista de imóveis e, em cada um, aceita vários nomes
// comuns para o mesmo campo (formato próprio da ImobiBrasil e o VRSync do ZAP/VivaReal).
import { XMLParser } from "npm:fast-xml-parser@5.11.2";

export type Imovel = {
  codigo: string;
  referencia: string;
  titulo: string;
  tipo: string;
  finalidade: "venda" | "locacao" | "ambos";
  cidade: string;
  bairro: string;
  valor_venda: number | null;
  valor_locacao: number | null;
  condominio: number | null;
  iptu: number | null;
  dormitorios: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_util: number | null;
  area_total: number | null;
  descricao: string;
  url: string;
  fotos: string[];
  tipo_busca: string;
  cidade_busca: string;
  bairro_busca: string;
};

// Texto sem acento e em minúsculas, para buscar "Içara" digitando "icara".
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type No = Record<string, unknown>;

// Junta as chaves de um nó (e dos sub-nós) num mapa nome-normalizado → valor,
// para achar "Cidade", "cidade" ou "Location/City" do mesmo jeito. Os campos do
// próprio nó vêm antes dos sub-nós, para um "id" de foto não esconder o do imóvel.
function achatar(no: No, saida: Map<string, unknown> = new Map(), prefixo = ""): Map<string, unknown> {
  const nome = (k: string) => normalizar(k.replace(/^@_/, "")).replace(/[^a-z0-9]/g, "");
  const subnos: [string, No][] = [];
  for (const [k, v] of Object.entries(no)) {
    const n = nome(k);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      subnos.push([n, v as No]);
      const t = (v as No)["#text"];
      if (t !== undefined && !saida.has(n)) saida.set(n, t);
    } else if (!saida.has(n)) {
      saida.set(n, v);
    }
    if (prefixo && !saida.has(prefixo + n)) saida.set(prefixo + n, v);
  }
  for (const [n, v] of subnos) achatar(v, saida, n);
  return saida;
}

function pegar(campos: Map<string, unknown>, ...nomes: string[]): unknown {
  for (const n of nomes) {
    const v = campos.get(n);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function texto(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return texto((v as No)["#text"]);
  return String(v).trim();
}

// Aceita "350000", "350.000,00", "R$ 1.300,00" e "350000.00".
export function numero(v: unknown): number | null {
  let s = texto(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inteiro(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.round(n);
}

// Lista de fotos: aceita <fotos><foto>url</foto></fotos>, <Media><Item>url</Item></Media>,
// atributos url/link/src e textos soltos que sejam endereços de imagem.
function fotos(no: No): string[] {
  const urls: string[] = [];
  const visitar = (v: unknown, dentroDeFotos: boolean) => {
    if (Array.isArray(v)) return v.forEach((x) => visitar(x, dentroDeFotos));
    if (v !== null && typeof v === "object") {
      for (const [k, x] of Object.entries(v as No)) {
        const nome = normalizar(k.replace(/^@_/, ""));
        visitar(x, dentroDeFotos || /foto|imag|media|item|picture|photo|url|link|src/.test(nome));
      }
      return;
    }
    const s = texto(v);
    if (dentroDeFotos && /^https?:\/\//i.test(s) && /\.(jpe?g|png|webp)(\?|$)/i.test(s)) urls.push(s);
  };
  for (const [k, v] of Object.entries(no)) {
    if (/foto|imagens|media|fotos|pictures|photos/.test(normalizar(k))) visitar(v, true);
  }
  return [...new Set(urls)];
}

function finalidadeDe(campos: Map<string, unknown>, venda: number | null, locacao: number | null): Imovel["finalidade"] {
  const t = normalizar(texto(pegar(campos, "transacao", "finalidade", "transactiontype", "negocio", "tiponegocio", "operacao")));
  const temVenda = /venda|sale|vend/.test(t);
  const temLocacao = /loca|aluguel|rent|alug/.test(t);
  if (temVenda && temLocacao) return "ambos";
  if (temLocacao) return "locacao";
  if (temVenda) return "venda";
  if (venda && locacao) return "ambos";
  return locacao && !venda ? "locacao" : "venda";
}

function converter(no: No): Imovel | null {
  const c = achatar(no);
  const codigo = texto(pegar(c, "id", "codigo", "codigoimovel", "listingid", "idimovel", "cod", "ref", "referencia"));
  if (!codigo) return null;

  const transacao = normalizar(texto(pegar(c, "transacao", "finalidade", "transactiontype")));
  const valorGenerico = numero(pegar(c, "valor", "preco", "price"));
  let venda = numero(pegar(c, "valorvenda", "precovenda", "listprice", "detailslistprice"));
  let locacao = numero(pegar(c, "valorlocacao", "valoraluguel", "precolocacao", "rentalprice", "detailsrentalprice"));
  if (valorGenerico && !venda && !locacao) {
    if (/loca|aluguel|rent/.test(transacao)) locacao = valorGenerico;
    else venda = valorGenerico;
  }

  const tipo = texto(pegar(c, "tipoimovel", "tipo", "propertytype", "detailspropertytype", "subtipoimovel"));
  const cidade = texto(pegar(c, "cidade", "city", "locationcity", "municipio"));
  const bairro = texto(pegar(c, "bairro", "neighborhood", "locationneighborhood"));
  return {
    codigo,
    referencia: texto(pegar(c, "ref", "referencia", "codigoreferencia")),
    titulo: texto(pegar(c, "titulo", "title", "titulosite")),
    tipo,
    finalidade: finalidadeDe(c, venda, locacao),
    cidade,
    bairro,
    valor_venda: venda,
    valor_locacao: locacao,
    condominio: numero(pegar(c, "valorcondominio", "condominio", "propertyadministrationfee", "detailspropertyadministrationfee")),
    iptu: numero(pegar(c, "valoriptu", "iptu", "yearlytax", "detailsyearlytax")),
    dormitorios: inteiro(pegar(c, "dormitorios", "quartos", "dormitorio", "bedrooms", "detailsbedrooms", "qtddormitorios")),
    suites: inteiro(pegar(c, "suites", "suite", "suites", "detailssuites", "qtdsuites")),
    banheiros: inteiro(pegar(c, "banheiros", "banheiro", "bathrooms", "detailsbathrooms", "qtdbanheiros")),
    vagas: inteiro(pegar(c, "vagas", "garagem", "garagens", "vagasgaragem", "garage", "detailsgarage", "qtdvagas")),
    area_util: numero(pegar(c, "areautil", "areaprivativa", "areaconstruida", "livingarea", "detailslivingarea")),
    area_total: numero(pegar(c, "areatotal", "areaterreno", "lotarea", "detailslotarea")),
    descricao: texto(pegar(c, "descricao", "description", "detailsdescription", "observacao")).slice(0, 1500),
    url: texto(pegar(c, "url", "link", "detailviewurl", "urlimovel", "linkimovel")),
    fotos: fotos(no),
    tipo_busca: normalizar(tipo),
    cidade_busca: normalizar(cidade),
    bairro_busca: normalizar(bairro),
  };
}

// Procura a maior lista de nós parecidos com imóveis em qualquer nível do XML.
function acharLista(v: unknown): No[] {
  let melhor: No[] = [];
  const visitar = (x: unknown) => {
    if (Array.isArray(x)) {
      const nos = x.filter((i) => i !== null && typeof i === "object") as No[];
      if (nos.length > melhor.length) melhor = nos;
      x.forEach(visitar);
    } else if (x !== null && typeof x === "object") {
      for (const [k, filho] of Object.entries(x as No)) {
        // lista de um imóvel só vira objeto, não array
        if (/^(imovel|listing|imoveis|property)$/i.test(normalizar(k)) && !Array.isArray(filho) && filho && typeof filho === "object" && melhor.length === 0) {
          melhor = [filho as No];
        }
        visitar(filho);
      }
    }
  };
  visitar(v);
  return melhor;
}

export function lerXmlImoveis(xml: string): Imovel[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (nome) => /^(imovel|listing|property|foto|item|imagem)$/i.test(nome),
  });
  const doc = parser.parse(xml);
  const vistos = new Set<string>();
  const imoveis: Imovel[] = [];
  for (const no of acharLista(doc)) {
    const im = converter(no);
    if (im && !vistos.has(im.codigo)) {
      vistos.add(im.codigo);
      imoveis.push(im);
    }
  }
  return imoveis;
}
