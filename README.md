# Concresuper · Central de programação

Primeira versão funcional para **Cascavel – PR**, desenvolvida a partir da rotina da planilha de programação. Interface em português, verde/cinza/branco e navegação lateral alinhada ao sistema de obras fornecido em ZIP.

## Executar

Requer **Node.js 24 ou superior**, com libSQL. As dependências são instaladas com `npm ci`. O build verifica a aplicação; o frontend é estático, sem compilação adicional. O armazenamento usa libSQL, com arquivo SQLite local para desenvolvimento e banco Turso/libSQL remoto na Vercel.

```sh
cd /workspace/planilha-de-programa-o
npm ci
npm run check
npm test
npm start
```

Por padrão, o serviço escuta a porta 3000 na interface local. `PORT` e `HOST` podem ser configurados na hospedagem. A aplicação entrega frontend e API na mesma origem.

No primeiro acesso, cadastre a conta **Programador**. Em desenvolvimento local, o cadastro inicial não precisa de código. Antes de expor a aplicação publicamente, configure `ADMIN_SETUP_TOKEN` com um valor aleatório longo e use-o no campo “Código de configuração da hospedagem”. Em `NODE_ENV=production`, o código é obrigatório. Esse valor deve ficar no gerenciador seguro da hospedagem, nunca no código ou no chat.

Cadastre as bombas reais e os usuários em **Configurações**. Não há contas, senhas, obras ou volumes reais pré-cadastrados. O banco da aplicação começa vazio. Screenshots de revisão usam dados fictícios e um banco temporário separado.

## O que está implementado

- Agenda diária, semanal e mensal, incluindo datas futuras. Manhã/tarde são agrupamentos visuais; cada atendimento tem horário e duração próprios.
- Cadastro de obras com cliente, endereço, vendedor, data, início, duração, tipo de entrega, volume, brita, Fck, peça, observações e viagens previstas.
- Entregas com bomba e convencionais, sem bomba.
- Consulta de bombas disponíveis por data, início e duração; considera manutenção e intervalo entre obras. Uma consulta não efetua reserva.
- Bloqueio de conflitos na API. A margem inicial entre serviços da mesma bomba é 30 minutos, configurável pelo Programador. A mesma bomba pode ficar ocupada pela manhã e tarde, desde que a duração termine no mesmo dia.
- Edição de data, horário, duração, recurso e status pelo controlador, gerente e Programador. Não há arrastar/soltar nesta versão.
- Volume programado original preservado e volume realmente entregue editável, com auditoria. Volume entregue vazio é “Não informado”, não zero.
- Solicitações de vendedores, vinculadas automaticamente à conta autenticada; aprovação, recusa e proposta de ajuste com resposta.
- Notificações em pop-up para pedidos novos e respostas, consultadas a cada 15 segundos enquanto a página estiver aberta. Pedidos pendentes persistem e voltam a aparecer no próximo login. Não há notificação push fora do navegador.
- Relatórios por data inicial/final, vendedor, tipo e status; atalhos de período. Resumos por vendedor e detalhamento por obra.
- Agenda de amanhã com concreto, peça, vendedor, observações e viagens. Exportação genérica CSV e impressão/PDF via navegador. **O arquivo não é uma integração já homologada com o sistema de carregamentos.**

## Perfis e login

O fluxo reproduz o padrão do sistema de obras enviado: usuário e senha, mostrar/ocultar senha, solicitação pública de cadastro, aprovação pelo Programador, senha temporária no cadastro administrativo e troca obrigatória antes de acessar qualquer módulo. O Programador pode redefinir senhas confirmando a própria senha; isso encerra sessões antigas. Há troca de senha pessoal.

| Perfil | Permissões |
| --- | --- |
| Vendedor | Disponibilidade sem nomes/dados de clientes de outros vendedores, solicitar reserva, acompanhar seus pedidos e consultar seu relatório |
| Controlador de logística | Agendamentos, solicitações, consulta/bloqueio por manutenção, volume entregue e relatórios da filial |
| Gerente | Mesmas permissões do controlador |
| Programador | Tudo, cadastros, aprovação/bloqueio de usuários, redefinição de senha, parâmetros e auditoria |

Somente a primeira conta recebe o perfil Programador; a API impede atribuí-lo às demais. Sua identificação usa a mesma **coroa de contorno** do sistema de obras, acompanhando a cor e o tamanho do nome. O símbolo da marca também é usado como favicon.

**As contas são independentes das contas do sistema de obras.** Nenhum usuário, senha, sessão, Redis ou planilha daquele sistema foi importado ou alterado. Login único entre os dois exige uma integração futura com o provedor de identidade, sem copiar senhas.

Senhas usam scrypt com sal aleatório; sessões usam cookies HttpOnly/SameSite, tokens aleatórios e armazenamento do hash do token. Permissões são verificadas no servidor. Auditoria não guarda senhas.

## Dados e hospedagem

**A aplicação está preparada para um novo projeto na Vercel, separado do sistema de obras.** Siga [o guia de publicação](docs/PUBLICACAO.md). A Vercel serve `public/` e executa a API Node em `api/index.mjs`; o banco remoto é Turso/libSQL, com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` exclusivos deste projeto. Sem essas variáveis na Vercel, a API retorna um erro de configuração e não usa armazenamento efêmero.

Em desenvolvimento, sem URL remota, o SQLite persiste em `.data/cascavel.sqlite` (fora do Git). `DB_PATH` permite outro caminho. Faça backups consistentes, incluindo o estado WAL quando aplicável; não copie somente o arquivo principal durante gravações.

Para a primeira conta em produção, configure `ADMIN_SETUP_TOKEN` aleatório com pelo menos 32 caracteres e use-o na tela HTTPS. O token deve ser exclusivo da concreteira. Depois do cadastro, remova-o da hospedagem. Cookies são Secure automaticamente na Vercel; `APP_ORIGIN` permite restringir a origem HTTPS exata. Previews devem usar um banco separado da produção.

O projeto inclui `.env.example` sem valores secretos. O Node não o carrega automaticamente: use as variáveis da hospedagem ou `node --env-file=.env server.mjs` no desenvolvimento. Não use nem altere as credenciais, planilhas ou o Redis do sistema de obras.

Login compartilhado, MFA, recuperação por e-mail e observabilidade de produção ainda não estão implementados. A validação em uma instância real da Vercel e no banco remoto depende dos acessos da hospedagem; nenhum deploy remoto deve ser considerado concluído apenas pelo build local.

A filial está fixa em Cascavel nesta primeira versão. Inclusão de outras filiais e escopo de bombas compartilhadas exigirá ampliar o modelo de dados e os filtros de permissão antes de liberar acesso a outras unidades.

## Contagens e relatórios

“Viagens previstas” é a quantidade informada no agendamento, não uma escala de veículos individuais. O cálculo automático por capacidade do caminhão e a programação individual de cada carga ainda não estão incluídos.

Os relatórios usam a **data programada da obra**, inclusive para o volume entregue associado àquela obra; não são relatórios fiscais por data real de cada carga. Cancelados ficam excluídos por padrão, mas podem ser filtrados separadamente. Quando existe obra sem volume entregue, a diferença total daquele vendedor é exibida como aguardando informações.

Solicitações pendentes não contam no volume confirmado. A aprovação revalida o conflito em uma transação antes de reservar a bomba. Entregas convencionais não bloqueiam bombas; ainda não há controle de capacidade da central ou conflitos por caminhão.

## Marca e referências

O ZIP `Sistema--main.zip` foi consultado apenas como referência. Reutilizou-se o componente de mostrar senha e a coroa de contorno, adaptando os perfis para a concreteira. O símbolo em `public/favicon.svg` é uma reconstrução vetorial provisória baseada nas imagens enviadas, não o arquivo oficial da marca; substitua pelo original para correspondência exata. O nome é exibido em texto, sem depender de fontes externas.

As consultas aos sites de referência foram bloqueadas com HTTP 403 pelo proxy do ambiente. O código do ZIP e as imagens permitiram prosseguir. Não foram publicadas alterações nos sites existentes.

## Verificação

`npm test` executa testes reais de API com servidor HTTP e banco temporário, incluindo autenticação, perfis, conflitos, pedidos, entrega, relatórios, aprovação/bloqueio e redefinição de senha. `npm run check` verifica a sintaxe do servidor e frontend.

Também foi realizada verificação com Chromium/Playwright em ambiente temporário: cadastro inicial, login, navegação dia/semana/mês, registro do entregue, filtros e CSV, tela de celular, favicon, coroa exclusiva do Programador, troca obrigatória de senha e envio de solicitação pelo vendedor. Nenhuma conta real foi criada.

Para repetir a verificação visual, execute `npm run test:browser`. Requer Chromium instalado no sistema (detecta `/usr/bin/chromium`) ou um navegador instalado por `npx playwright install chromium`. `BROWSER_EXECUTABLE` permite indicar o caminho. O teste cria e remove seu próprio banco, sem usar os dados reais. As imagens geradas em `.data/review/` contêm apenas exemplos fictícios.

Após a adaptação para Vercel, os testes também cobrem a entrada serverless, ausência de fallback para disco efêmero, exigência de TLS, cadastro inicial protegido, limitação de tentativas persistente entre reinícios e reservas concorrentes. O limite de tentativas agora fica no banco, para valer entre instâncias. A conexão com um banco remoto real permanece pendente até configuração das credenciais.

## Cancelamentos, remarcações e clientes

Clique em uma obra na agenda para acessar **Remarcar agendamento**, **Cancelar agendamento** e **Histórico**. Cancelamentos e mudanças de data, horário, duração ou recurso exigem motivo. O cancelamento libera o horário e preserva a bomba anteriormente utilizada. A remarcação confere conflitos novamente antes de gravar; alterações concorrentes feitas a partir de uma tela desatualizada são recusadas. Uma obra cancelada pode ser reativada pelo botão Remarcar, com motivo e nova conferência de disponibilidade.

Em **Relatórios → Cancelamentos e remarcações**, filtre por período, cliente (sem diferenciar acentos), vendedor e ocorrência. A referência de data pode ser a data da alteração, a data anterior da obra ou a nova data. Há indicadores, gráficos por período, ranking de clientes, volumes por vendedor, detalhes de motivo/responsável e programação anterior/nova. CSV e impressão/PDF do navegador respeitam os filtros.

As contagens são de **ocorrências**, não de vendas novas. Uma obra remarcada duas vezes produz dois registros. O volume movimentado soma o volume por ocorrência; o número de obras distintas aparece separado. O relatório mostra também a situação atual da obra, pois um cancelamento antigo pode ter sido seguido por uma reativação.

A atualização cria tabelas e índices de forma aditiva. Uma migração idempotente recupera os cancelamentos e remarcações que já estavam na auditoria. Motivos antigos ausentes são identificados como não registrados. Cancelamentos sem auditoria não recebem uma data inventada; podem ser incluídos no relatório pela opção de registros sem data. Datas recuperadas da auditoria são convertidas de UTC para America/Sao_Paulo.

A aba **Clientes** guarda automaticamente a última configuração usada por cliente e vendedor, ao salvar uma agenda ou solicitação. No novo formulário, escolha **Preencher com cliente cadastrado** para recuperar obra, volume, brita, Fck, peça, observações, duração, tipo e viagens. **Data, horário e bomba não são reutilizados.** Revise sempre as especificações: o último pedido não garante que o próximo tenha o mesmo concreto ou aditivo. A mudança nos padrões do cliente não altera as agendas históricas.

Vendedores consultam somente seus clientes, suas ocorrências e seus históricos. Gerente, controlador e Programador consultam os dados da filial. Cadastros já presentes em agendas e solicitações são recuperados pela migração inicial sem excluir ou alterar os registros originais. Por enquanto, o cadastro é por nome normalizado e vendedor; CPF/CNPJ, contatos e múltiplos padrões por obra não foram adicionados.
