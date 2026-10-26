-- =====================================================================
--  Base de respostas do assistente do WhatsApp — versão aprovada pela Cocal
--  Cole este arquivo inteiro no SQL Editor do Supabase (projeto do CRM) e
--  clique em Run. Ele SUBSTITUI toda a base pelo texto abaixo.
--  Para ajustes pequenos, prefira editar direto em Table Editor › base_respostas.
-- =====================================================================
delete from public.base_respostas;

insert into public.base_respostas (ordem, tema, aprovado, conteudo) values

(1, 'Sobre a Cocal', true, $$
A Cocal Imóveis LTDA (CRECI 1629) atua desde 1993 com compra, venda, locação e troca de imóveis.
Atendemos Cocal do Sul, Urussanga, Criciúma, Balneário Esplanada, Copa 70, Janaína e região.
Também temos incorporadora, com lançamentos frequentes na região (não cite nenhum lançamento específico; se o cliente se interessar, passe para um corretor).
$$),

(2, 'Endereço e contato', true, $$
Matriz: Av. Polidoro Santiago, 419, Centro, Cocal do Sul/SC.
Filial: R. Antônio Lima, 1388, Esplanada, Jaguaruna/SC, CEP 88715-000. Mapa: https://maps.app.goo.gl/XZJCFvjzQWUzAeYg7
Telefone fixo: (48) 3447-6251. WhatsApp: (48) 99848-0591 (este mesmo número).
E-mail: atendimento@cocalimoveis.com.br. Todos os imóveis: www.cocalimoveis.com.br
$$),

(3, 'Horário de atendimento', true, $$
Segunda a sexta, das 8h às 12h e das 13h30 às 17h50. Sábado, das 8h30 às 11h30.
Fora desse horário o assistente virtual atende, registra o pedido e a equipe retorna no próximo horário de atendimento.
$$),

(4, 'Locação: como funciona', true, $$
Requisito: para alugar é necessário ter o nome limpo. A Cocal não trabalha com fiador no momento e não pede caução.
1) Análise da garantia locatícia, feita pelo CPF. Também é preciso informar quantos adultos e crianças vão morar e se há pets (quais e de que porte).
2) Aprovada a análise, é paga a entrada da garantia: taxa de adesão de R$ 300,00 + a 1ª parcela da garantia (o valor informado no anúncio do imóvel). As outras 11 parcelas vêm junto com o boleto do aluguel, todo mês. As formas de pagamento da entrada (cartão, Pix ou boleto; no cartão pode parcelar) são enviadas por e-mail.
Importante: esse pagamento não é reembolsável, por isso o cliente deve tirar todas as dúvidas sobre o imóvel antes de pagar.
3) Depois do pagamento, a Cocal pede os documentos. Com tudo recebido, o prazo é de até 5 dias úteis para a entrega das chaves. Nesse período o contrato é enviado para leitura e é feita a vistoria de entrada.
$$),

(5, 'Locação: documentos', true, $$
Documentos do locatário: CNH ou RG; CPF; comprovante de endereço atualizado (conta de água, luz ou similar); certidão de nascimento ou de casamento, conforme o estado civil; comprovante de renda; e-mail pessoal (para o contrato e comunicados); telefone para contato.
Se o locatário for casado, também são necessários os documentos do cônjuge.
$$),

(6, 'Locação: contrato, prazo e multa', true, $$
O contrato é de 30 meses (padrão da lei), com fidelidade mínima de 12 meses.
Saída antes de 12 meses: multa rescisória, normalmente equivalente a 3 aluguéis mensais, proporcional aos meses que faltam para completar o primeiro ano. O valor exato é informado pela equipe.
Depois de 12 meses: basta avisar com 30 dias de antecedência. O aviso prévio é pago normalmente: se avisar no dia 10, o aluguel é pago até o próximo dia 10, ou até a conclusão dos reparos necessários.
A assinatura é digital, por e-mail. Se preferir, pode assinar presencialmente na Cocal, ou imprimir, assinar, reconhecer firma e trazer para liberar as chaves.
$$),

(7, 'Locação: vistoria e pintura', true, $$
A vistoria de entrada é feita com fotos e registrada em um termo. Ao receber as chaves, o inquilino tem 3 dias para fazer a própria vistoria e avisar se encontrar algo diferente; a Cocal comunica o proprietário e, se precisar, o ajuste é resolvido.
O imóvel deve ser devolvido como foi recebido. O que já tinha defeito na entrada não é responsabilidade do inquilino.
A pintura é sempre feita no fim do contrato. Quando o imóvel não está pintado na entrada, o valor da pintura no final é dividido entre proprietário e inquilino.
$$),

(8, 'Locação: água, energia e aluguel', true, $$
Água desligada: a Cocal resolve e já pede a ligação no nome do inquilino.
Energia desligada: o inquilino pede a religação na Cooper (eles pedem o contrato assinado e costumam ligar no dia seguinte). Energia já ligada: o inquilino tem 24 horas para pedir a troca de titularidade e enviar o protocolo para a Cocal.
O aluguel vence todo dia 10. Como não pedimos caução, o primeiro aluguel só é cobrado no mês seguinte. O boleto chega por e-mail, uma vez por mês.
$$),

(9, 'Compra: pagamento e financiamento', true, $$
As formas de pagamento variam conforme o imóvel: cada proprietário aceita condições específicas, e tudo é negociado com o corretor.
A Cocal ajuda com financiamento: temos equipe especializada e parceiros para dar esse suporte.
Valores, propostas, condições e comissões são sempre tratados com um corretor.
$$),

(10, 'Quero vender ou alugar meu imóvel', true, $$
Para anunciar um imóvel com a Cocal, um corretor faz a avaliação e explica as condições. O assistente anota o tipo do imóvel, o bairro/cidade e se é para venda ou locação, e passa para um corretor.
$$),

(11, 'Já sou cliente (inquilino ou proprietário)', true, $$
Assuntos de quem já é cliente (boleto, manutenção, contrato, problemas no imóvel) são resolvidos pela Nani, nossa secretária, aqui mesmo neste WhatsApp.
O assistente pede para o cliente contar o que aconteceu (e, se for o caso, o endereço do imóvel) e passa a conversa para a Nani. O assistente não resolve nem promete solução.
$$);
