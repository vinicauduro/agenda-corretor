import { assertEquals } from "jsr:@std/assert@1.0.13";
import { lerXmlImoveis, numero } from "./imoveis_xml.ts";

Deno.test("números em formatos brasileiros e americanos", () => {
  assertEquals(numero("350000"), 350000);
  assertEquals(numero("350.000,00"), 350000);
  assertEquals(numero("R$ 1.300,00"), 1300);
  assertEquals(numero("350000.00"), 350000);
  assertEquals(numero("1.134"), 1134);
  assertEquals(numero(""), null);
  assertEquals(numero("0"), null);
});

Deno.test("formato próprio da ImobiBrasil (tags em minúsculas)", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <imoveis>
    <imovel>
      <fotos><foto><id>9</id><url>https://img.exemplo.com/a.jpg</url></foto><foto><url>https://img.exemplo.com/b.png</url></foto></fotos>
      <id>3545514</id><ref>CA0012</ref>
      <url>https://www.cocalimoveis.com.br/imovel/3545514/casa-venda-cocal-do-sul-sc-jardim-elizabeth</url>
      <titulo>Casa no Jardim Elizabeth</titulo>
      <tipoimovel>Casa</tipoimovel><transacao>Venda</transacao>
      <valor>480.000,00</valor>
      <cidade>Cocal do Sul</cidade><bairro>Jardim Elizabeth</bairro>
      <dormitorios>3</dormitorios><suites>1</suites><banheiros>2</banheiros><vagas>2</vagas>
      <areautil>120</areautil><areatotal>360</areatotal>
      <descricao>Casa ampla.</descricao>
    </imovel>
    <imovel>
      <id>3691921</id><tipoimovel>Sala Comercial</tipoimovel><transacao>Locação</transacao>
      <valor>1300</valor><cidade>Cocal do Sul</cidade><bairro>Centro</bairro>
    </imovel>
  </imoveis>`;
  const [casa, sala] = lerXmlImoveis(xml);
  assertEquals(casa.codigo, "3545514");
  assertEquals(casa.referencia, "CA0012");
  assertEquals(casa.finalidade, "venda");
  assertEquals(casa.valor_venda, 480000);
  assertEquals(casa.valor_locacao, null);
  assertEquals(casa.dormitorios, 3);
  assertEquals(casa.vagas, 2);
  assertEquals(casa.bairro_busca, "jardim elizabeth");
  assertEquals(casa.fotos, ["https://img.exemplo.com/a.jpg", "https://img.exemplo.com/b.png"]);
  assertEquals(sala.finalidade, "locacao");
  assertEquals(sala.valor_locacao, 1300);
  assertEquals(sala.tipo_busca, "sala comercial");
});

Deno.test("formato VRSync (ZAP/VivaReal)", () => {
  const xml = `<ListingDataFeed><Listings><Listing>
    <ListingID>2915064</ListingID><Title>Apartamento Edifício Pôr do Sol</Title>
    <TransactionType>For Sale</TransactionType>
    <DetailViewUrl>https://www.cocalimoveis.com.br/imovel/2915064/x</DetailViewUrl>
    <Media><Item medium="image">https://img.exemplo.com/c.jpg</Item></Media>
    <Details><PropertyType>Residential / Apartment</PropertyType><ListPrice currency="BRL">1100000</ListPrice>
      <Bedrooms>3</Bedrooms><Suites>1</Suites><Garage type="Parking Space">2</Garage><LivingArea unit="square metres">140</LivingArea></Details>
    <Location><City>Urussanga</City><Neighborhood>Centro</Neighborhood></Location>
  </Listing></Listings></ListingDataFeed>`;
  const [ap] = lerXmlImoveis(xml);
  assertEquals(ap.codigo, "2915064");
  assertEquals(ap.finalidade, "venda");
  assertEquals(ap.valor_venda, 1100000);
  assertEquals(ap.cidade, "Urussanga");
  assertEquals(ap.dormitorios, 3);
  assertEquals(ap.vagas, 2);
  assertEquals(ap.area_util, 140);
  assertEquals(ap.fotos, ["https://img.exemplo.com/c.jpg"]);
  assertEquals(ap.url, "https://www.cocalimoveis.com.br/imovel/2915064/x");
});
