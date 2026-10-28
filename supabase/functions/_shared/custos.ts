// Custos mensais de um imóvel de aluguel, lidos da descrição do anúncio.
// Os anúncios da Cocal trazem linhas como "Garantia locatícia: R$ 143,75",
// "Seguro incêndio: em torno de R$ 30,00" e "Condomínio: aproximadamente R$ 250,00".
// O total é sempre calculado aqui (não copiado do texto nem feito pela IA).
import { limparDescricao, numero } from "./imoveis_xml.ts";

export { limparDescricao };

export type Custos = {
  aluguel: number | null;
  garantia: number | null;
  condominio: number | null;
  seguro_incendio: number | null;
  seguro_incendio_obs: string; // ex.: "mediante orçamento", quando não há valor
  iptu_obs: string;
  total: number | null;
};

const valorDaLinha = (linha: string) => {
  const m = linha.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  return m ? numero(m[1]) : null;
};
const restoDaLinha = (linha: string) => linha.slice(linha.indexOf(":") + 1).trim();

export function custosDaDescricao(descricao: string, aluguel: number | null, condominioXml: number | null): Custos {
  const c: Custos = {
    aluguel, garantia: null, condominio: condominioXml, seguro_incendio: null,
    seguro_incendio_obs: "", iptu_obs: "", total: null,
  };
  for (const linha of limparDescricao(descricao).split("\n")) {
    if (!linha.includes(":")) continue;
    const rotulo = linha.slice(0, linha.indexOf(":")).toLowerCase();
    const valor = valorDaLinha(linha);
    if (/garantia/.test(rotulo) && valor) c.garantia = valor;
    else if (/seguro\s*(inc[eê]ndio|incendio)/.test(rotulo)) {
      c.seguro_incendio = valor;
      if (!valor || /or[cç]amento/i.test(linha)) c.seguro_incendio_obs = valor ? "valor aproximado, sujeito a orçamento" : restoDaLinha(linha);
    } else if (/^condom[ií]nio$/.test(rotulo.trim()) && valor) c.condominio = valor;
    else if (/iptu/.test(rotulo)) c.iptu_obs = valor ? `R$ ${restoDaLinha(linha).replace(/^R\$\s*/i, "")}` : restoDaLinha(linha);
    else if (/^aluguel/.test(rotulo) && valor && !c.aluguel) c.aluguel = valor;
  }
  if (c.aluguel) {
    c.total = Math.round(([c.aluguel, c.garantia, c.condominio, c.seguro_incendio]
      .reduce((s: number, v) => s + (v ?? 0), 0)) * 100) / 100;
  }
  return c;
}
