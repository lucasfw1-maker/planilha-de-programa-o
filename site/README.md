# ConcretLog — site comercial

Projeto independente do sistema operacional. A pasta `site/` tem seu próprio servidor de desenvolvimento e configuração de publicação. Não altera as rotas, o login, os relatórios nem o banco do sistema.

## Ver localmente

Requer Node.js 22 ou superior. O envio de mensagens usa Nodemailer no servidor; instale as dependências com `npm ci`.

```sh
cd site
npm ci
npm run dev
```

Acesse `http://localhost:4173`. Para gerar os arquivos estáticos, use `npm run build`; a saída fica em `site/dist/`.

## Contatos

Edite somente `public/site.config.js` para ativar os canais quando estiverem definidos:

- `whatsapp`: código do país + DDD + número, somente dígitos.
- `instagram`: URL HTTPS completa do perfil oficial.
- `email`: endereço comercial.

O e-mail comercial ativo é **comercial@concretlog.com.br**. O WhatsApp está removido da apresentação por enquanto. O Instagram continua como “Em breve”, sem link fictício. Os pedidos de demonstração e o botão de e-mail abrem um formulário no próprio site, com e-mail do visitante, telefone com DDD, assunto padrão “Solicitar demonstração” (editável) e mensagem. Ao configurar um canal, ele passa a funcionar automaticamente; WhatsApp e e-mail abrem uma mensagem de interesse, e o Instagram abre o perfil. O formulário só confirma sucesso após a aceitação pelo servidor de e-mail; sem configuração SMTP, informa indisponibilidade e mantém um link alternativo para o aplicativo de e-mail.

## Publicar na Vercel

Crie **outro projeto**, usando o mesmo repositório, com:

- Nome sugerido: `concretlog-site`.
- Root Directory: **site**.
- Framework: **Other**.
- Build Command: **npm run build**.
- Output Directory: **dist**.

A configuração `site/vercel.json` já define a saída e os cabeçalhos de segurança. Não mude o projeto Vercel do sistema existente para a pasta `site`.

## Domínio concretlog.com.br

Os metadados, a URL canônica, o sitemap e o robots.txt já estão preparados para `https://concretlog.com.br`.

**O domínio ainda precisa ser registrado no nome do proprietário no Registro.br:** https://registro.br/. A criação do site não efetua a compra, e a disponibilidade não foi confirmada. Depois do registro, adicione o domínio em **Settings → Domains** do novo projeto Vercel e aplique no Registro.br os registros DNS indicados pela própria Vercel. É possível adicionar também `www.concretlog.com.br` e redirecionar para o domínio principal. Não há configuração fixa de DNS neste projeto, pois os valores devem ser os informados para o projeto criado.

O domínio e o registro da marca são processos separados; a proteção da marca pode ser solicitada no INPI.

## Conteúdo e identidade

- Somente a identidade ConcretLog, sem logo Concresuper.
- Mesmo símbolo de betoneira usado no sistema, no arquivo SVG incorporado ao HTML.
- Mesmas imagens ConcretLog já aprovadas, sem imagens de relatórios de clientes.
- Dados de demonstração ilustrativos e nomes fictícios.
- Módulos disponíveis: programação/logística, clientes/contratos, indicadores/relatórios, manutenção/frota, chamados e laboratório.
- Laboratório divulgado como disponível: CPs e rompimentos, laudos vinculados aos chamados, ocorrências, umidade da areia e ensaios comparativos de traços, cimentos e aditivos, com dosagens, preços de referência e custos.
- Propostas sob consulta, sem preços, depoimentos ou resultados comerciais inventados.
- E-mail comercial publicado com formulário de contato no próprio site; WhatsApp removido temporariamente e Instagram ainda sem endereço definido.
- Montserrat servida localmente; licença das fontes em `public/assets/fonts/LICENSE.txt`.
- Sem cookies de publicidade ou análise. O formulário informa o uso dos dados para responder à solicitação; mensagens são encaminhadas somente à caixa comercial.

## Verificação

```sh
npm run check --prefix site
npm run build --prefix site
node site/scripts/check-browser.cjs
```

O último comando é executado a partir da raiz do repositório, usa o Playwright já instalado no projeto principal e `/usr/bin/chromium`, e verifica tamanhos de tela, navegação com teclado, menus, abas, modais, contatos, a prévia e os recursos disponíveis do laboratório e o ícone original. As capturas ficam em `.data/review/concretlog-site-*.png` (fora do site publicado).


## Módulos divulgados

O site apresenta Programação e logística, Clientes e contratos, Indicadores e relatórios, Manutenção e frota e Chamados Técnico/Comercial como recursos disponíveis. A prévia interativa usa somente dados fictícios e a marca ConcretLog, com abas de manutenção e chamados. Laboratório de concreto tem card, modal, aba ilustrativa e seção dedicada aos recursos de CPs, laudos, umidade e ensaios. Os exemplos usam somente dados fictícios, sem informações de clientes ou resultados reais. O contato comercial por e-mail está ativo; o WhatsApp foi removido temporariamente.


## Envio do formulário pela Locaweb

O destinatário do formulário é fixo: **comercial@concretlog.com.br**. O visitante informa e-mail, telefone com DDD, assunto e mensagem. O endereço autenticado é o remetente SMTP; o e-mail do visitante fica em **Reply-To**, para que o botão Responder funcione corretamente. O telefone e a mensagem seguem no corpo do e-mail em texto simples.

No projeto Vercel **do site** (Root Directory `site`), abra **Settings → Environment Variables** e configure, no ambiente Production:

| Variável privada | Valor |
|---|---|
| `CONTACT_SMTP_HOST` | Servidor SMTP informado pela Locaweb nas configurações da conta, sem `https://` |
| `CONTACT_SMTP_PORT` | `465` (TLS direto) ou `587` (STARTTLS obrigatório), conforme instruções da Locaweb |
| `CONTACT_SMTP_USER` | `comercial@concretlog.com.br` |
| `CONTACT_SMTP_PASSWORD` | Senha da caixa comercial, não a senha da Central do Cliente |

Depois de salvar, faça **Redeploy** do projeto do site. Nunca coloque esses valores em `public/site.config.js`, commits, capturas de tela ou conversas. O arquivo `site/.env.example` contém somente nomes e exemplos sem senha. Para testar localmente, copie para `site/.env`, preencha privadamente e rode `node --env-file=.env server.mjs` dentro de `site/`.

O endpoint `/api/contact` usa TLS com validação de certificado, destino fixo, validação dos campos, limite de tamanho, verificação de origem, campo antirrobô, token assinado e prevenção de envios repetidos na mesma instância. Limites de frequência e idempotência ficam em memória com expiração e são por instância serverless, não um limite global persistente. Não há banco de mensagens ou credenciais expostas ao navegador. O rascunho fica somente na memória da aba enquanto o visitante preenche; falhas preservam o texto. A política de privacidade descreve os dados enviados.

O serviço fica preparado após a publicação, mas **o envio real depende dessas variáveis privadas e de autenticação válida na Locaweb**. Não informa sucesso quando falta configuração, há falha SMTP ou o destinatário é rejeitado. A confirmação indica aceitação pelo servidor SMTP, não leitura ou garantia de entrega na caixa de entrada.

Validação: `npm test --prefix site`, `npm run check --prefix site`, `npm run build --prefix site` e `node site/scripts/check-browser.cjs`. Os testes usam transporte e respostas simulados; não enviam e-mails reais. Cobrem e-mail/telefone, assunto, remetente/Reply-To, destino fixo, validação, origem, limites, duplicidade, falhas SMTP, ausência de configuração, preservação do formulário e celular.
