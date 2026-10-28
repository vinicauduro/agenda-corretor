import { assertEquals } from "jsr:@std/assert@1.0.13";
import { custosDaDescricao, limparDescricao } from "./custos.ts";

// Trechos reais de anúncios de locação da Cocal (com o <br> escapado, como vem do XML).
const apto2q = "Apartamento para locação Vale dos Ypês &lt;br&gt; Condomínio oferece: &lt;br&gt; Piscina &lt;br&gt; &lt;br&gt; Valores: &lt;br&gt; Aluguel: R$ 1.150,00 &lt;br&gt; Garantia locatícia: R$ 143,75 &lt;br&gt; Seguro incêndio: em torno de R$ 30,00 (necessário orçamento) &lt;br&gt; Condomínio: aproximadamente R$ 250,00 &lt;br&gt; IPTU: se houver cobrança, parcelado em 12x no boleto do aluguel &lt;br&gt; &lt;br&gt; Gasto médio mensal aproximado: R$ 1.543,75";
const sala = "Sala comercial n35 &lt;br&gt; Aluguel mensal: R$1.300,00 &lt;br&gt; Garantia locatícia: R$162,50/mês &lt;br&gt; Seguro incêndio: mediante orçamento &lt;br&gt; &lt;br&gt; Entre em contato e agende uma visita!";
const casa = "Casa para locação Bairro Vila Nova &lt;br&gt; Aluguel: R$ 1.350,00 &lt;br&gt; Garantia locatícia: R$ 168,75/mês &lt;br&gt; Seguro incêndio: aproximadamente R$ 30,00/mês &lt;br&gt; &lt;br&gt; Gasto médio mensal: R$ 1.548,75 &lt;br&gt; Escritório: (48) 99848-0591";

Deno.test("descrição vira texto com quebras de linha", () => {
  assertEquals(limparDescricao("Linha 1 &lt;br&gt; Linha 2 <br/> Linha 3"), "Linha 1\nLinha 2\nLinha 3");
});

Deno.test("apartamento: soma aluguel, garantia, condomínio e seguro (o anúncio esqueceu o seguro)", () => {
  const c = custosDaDescricao(apto2q, 1150, null);
  assertEquals([c.aluguel, c.garantia, c.condominio, c.seguro_incendio], [1150, 143.75, 250, 30]);
  assertEquals(c.seguro_incendio_obs, "valor aproximado, sujeito a orçamento");
  assertEquals(c.iptu_obs, "se houver cobrança, parcelado em 12x no boleto do aluguel");
  assertEquals(c.total, 1573.75);
});

Deno.test("sala: seguro sob orçamento fica fora da soma, com o aviso", () => {
  const c = custosDaDescricao(sala, 1300, null);
  assertEquals([c.garantia, c.seguro_incendio, c.seguro_incendio_obs], [162.5, null, "mediante orçamento"]);
  assertEquals(c.total, 1462.5);
});

Deno.test("casa sem condomínio", () => {
  const c = custosDaDescricao(casa, 1350, null);
  assertEquals([c.garantia, c.condominio, c.seguro_incendio, c.total], [168.75, null, 30, 1548.75]);
});

Deno.test("sem taxas na descrição: total é só o aluguel", () => {
  const c = custosDaDescricao("Casa ampla, 3 quartos.", 900, null);
  assertEquals([c.garantia, c.total], [null, 900]);
});
