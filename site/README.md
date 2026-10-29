# ConcretLog — site comercial

Projeto independente do sistema operacional. A pasta `site/` tem seu próprio servidor de desenvolvimento e configuração de publicação. Não altera as rotas, o login, os relatórios nem o banco do sistema.

## Ver localmente

Requer Node.js 22 ou superior. Não há dependências de execução.

```sh
cd site
npm run dev
```

Acesse `http://localhost:4173`. Para gerar os arquivos estáticos, use `npm run build`; a saída fica em `site/dist/`.

## Contatos

Edite somente `public/site.config.js` para ativar os canais quando estiverem definidos:

- `whatsapp`: código do país + DDD + número, somente dígitos.
- `instagram`: URL HTTPS completa do perfil oficial.
- `email`: endereço comercial.

O e-mail comercial ativo é **comercial@concretlog.com.br**. O WhatsApp está removido da apresentação por enquanto. O Instagram continua como “Em breve”, sem link fictício. Os pedidos de demonstração oferecem contato por e-mail. Ao configurar um canal, ele passa a funcionar automaticamente; WhatsApp e e-mail abrem uma mensagem de interesse, e o Instagram abre o perfil. Não há formulário que prometa enviar dados sem um serviço de recebimento.

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
- E-mail comercial publicado e clicável; WhatsApp removido temporariamente e Instagram ainda sem endereço definido.
- Montserrat servida localmente; licença das fontes em `public/assets/fonts/LICENSE.txt`.
- Sem cookies de publicidade, análise ou coleta por formulário nesta versão.

## Verificação

```sh
npm run check --prefix site
npm run build --prefix site
node site/scripts/check-browser.cjs
```

O último comando é executado a partir da raiz do repositório, usa o Playwright já instalado no projeto principal e `/usr/bin/chromium`, e verifica tamanhos de tela, navegação com teclado, menus, abas, modais, contatos, a prévia e os recursos disponíveis do laboratório e o ícone original. As capturas ficam em `.data/review/concretlog-site-*.png` (fora do site publicado).


## Módulos divulgados

O site apresenta Programação e logística, Clientes e contratos, Indicadores e relatórios, Manutenção e frota e Chamados Técnico/Comercial como recursos disponíveis. A prévia interativa usa somente dados fictícios e a marca ConcretLog, com abas de manutenção e chamados. Laboratório de concreto tem card, modal, aba ilustrativa e seção dedicada aos recursos de CPs, laudos, umidade e ensaios. Os exemplos usam somente dados fictícios, sem informações de clientes ou resultados reais. O contato comercial por e-mail está ativo; o WhatsApp foi removido temporariamente.
