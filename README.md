# Plataforma Comercial Demonstrativa

Este repositório contém uma aplicação Next.js que simula um portal comercial com autenticação e permissões de acesso. O fluxo inclui login, vitrine de produtos, compartilhamento de links rastreáveis e uma esteira de negócios para acompanhar pedidos por estágio.

## Como visualizar o que já foi desenvolvido

1. Instale as dependências uma vez:
   ```bash
   npm install
   ```
2. Inicie o ambiente de desenvolvimento local:
   ```bash
   npm run dev
   ```
3. Acesse [http://localhost:3000](http://localhost:3000) no navegador. A aplicação abrirá na tela de login e você poderá navegar por todas as páginas usando os usuários de exemplo descritos abaixo.

### Variáveis de ambiente

Algumas funcionalidades (como a cobrança pelo Asaas e a integração Credihome) dependem de credenciais externas. Para configurar rapidamente:

1. Copie o arquivo `.env.example` para `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Edite o novo arquivo e substitua os valores de exemplo pelas suas chaves reais. Em especial, defina `ASAAS_API_KEY` com a chave disponibilizada no painel do Asaas para evitar o erro “Configure a variável de ambiente ASAAS_API_KEY antes de gerar cobranças”.
3. Reinicie o servidor de desenvolvimento após salvar as alterações para garantir que o Next.js recarregue as novas variáveis.

Se estiver publicando na Vercel (ou em outro provedor), informe os mesmos valores na área de “Environment Variables” do projeto.

### Usuários de demonstração

| Papel | Email | Senha | Observações |
|-------|-------|-------|-------------|
| Administrador | `admin@sistema.com` | `admin123` | Visualiza todos os usuários e pedidos. |
| Master | `maria@empresa.com` | `master123` | Acompanha a própria equipe (incluindo subordinados). |
| Usuário | `carlos@empresa.com` | `user123` | Visualiza apenas os seus pedidos. |
| Usuário em teste | `teste@hiperban.com` | `teste123` | Conta temporária com período de degustação de 14 dias. |

Há outros usuários no arquivo [`lib/data.ts`](lib/data.ts) que podem ser usados para testar diferentes cenários de hierarquia.

### Estrutura principal

- **/login** – acesso ao sistema e seleção de usuário.
- **/dashboard** – visão geral com indicadores resumidos.
- **/store** – vitrine para criação de pedidos a partir de um link compartilhável, geração de links individuais por produto e cadastro automático do Crédito Imobiliário (Credihome).
- **/pipeline** – esteira de negócios onde é possível atualizar o status dos pedidos.
- **/users** – administração da base de usuários (visível para masters e administradores).
- **/billing** – central financeira para gerenciar planos, gerar cobranças via Asaas e contratar usuários adicionais.
- **/profiles** – central de perfis e permissões reutilizáveis (somente administradores).
- **/products** – catálogo da loja para cadastrar e editar ofertas (somente administradores).
- **/loja/[id]** – página pública gerada a partir do link individual de cada usuário, onde o cliente informa nome e CPF para cair diretamente na esteira.

## Publicar online com a Vercel

A forma mais simples de disponibilizar esta aplicação na web é pela [Vercel](https://vercel.com/), que tem integração nativa com projetos Next.js.

1. Crie um repositório no GitHub (ou outro provedor Git) e faça push deste código.
2. Acesse o painel da Vercel e clique em **“Add New Project”**.
3. Escolha **“Import Git Repository”** e selecione o repositório que contém este projeto.
4. Defina as variáveis de ambiente necessárias (veja a seção de integração Credihome abaixo) e confirme as configurações padrão.
5. Clique em **Deploy**. Em poucos instantes a Vercel criará uma URL pública com a aplicação em produção.

> Dica: após o primeiro deploy, qualquer push na branch principal do repositório disparará um novo build automaticamente. Você também pode usar **Deploy Previews** criando pull requests.

## Próximos passos sugeridos

- Substituir os dados fixos de usuários e pedidos por integrações reais (API/DB).
- Configurar autenticação segura (ex.: JWT, OAuth, NextAuth).
- Personalizar o domínio da loja e o link de compartilhamento (`storeBaseUrl` em `lib/data.ts`).
- Conectar um encurtador ou ferramenta de afiliados para os links individuais de produtos.
- Adicionar testes automatizados e monitoramento em produção.
- Sempre que uma feature exigir novas tabelas ou colunas, atualize o `prisma/schema.prisma` **e** versione a migration em `prisma/migrations/` para que os dados sejam preservados nos deploys.

## Integração Credihome

O card **Crédito Imobiliário** da loja envia automaticamente os cadastros para a API da Credihome e, agora, permite consultar o andamento das propostas diretamente na plataforma. Configure as seguintes variáveis de ambiente antes de publicar o projeto (ex.: em `.env.local` ou nos settings da Vercel):

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `CREDIHOME_BASE_URL` | Não | URL base da API. Padrão: `https://api-partner.credihome.com.br/v1/production`. |
| `CREDIHOME_LOGIN` | Sim | Login utilizado no endpoint `POST /login` para gerar o token JWT. |
| `CREDIHOME_PASSWORD` | Sim | Senha correspondente ao login acima. |
| `CREDIHOME_CHANNEL` | Não | Código de parceiro/canal enviado no header `channel`. Útil para rastrear origens. |

> Caso a API exija campos adicionais, ajuste os formulários em `/app/store/page.tsx` e `/app/loja/[userId]/page.tsx`. A integração atual cobre nome, CPF, contato e dados básicos do imóvel e permite acompanhar o pipeline por protocolo, CPF ou e-mail.

> As credenciais cadastradas em **Segurança → Credenciais Credihome** são anexadas automaticamente aos requests da simulação e da consulta de propostas, evitando falhas de autenticação durante os testes locais.

> A aba **Segurança** concentra o cadastro da URL base, login, senha e código de parceiro para facilitar os testes locais. Se for necessário personalizar caminhos, escopos ou parâmetros adicionais, defina-os diretamente nas variáveis de ambiente citadas na documentação da Credihome.

## Gestão de planos e integração Asaas

A partir da aba **Financeiro (/billing)** cada usuário (ou gestor) acompanha o plano contratado, dias restantes de teste, histórico de pagamentos e pode gerar novos checkouts pelo Asaas. Masters também visualizam o consumo de licenças da equipe e conseguem adquirir usuários adicionais com cobrança automática.

Configure as variáveis abaixo para ativar a integração:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ASAAS_API_KEY` | Sim | Chave de API do Asaas (produção ou sandbox). É enviada nos headers `access_token` e `Authorization`. |
| `ASAAS_API_URL` | Não | URL base da API. Padrão: `https://api.asaas.com/v3`. |

> A aplicação cria/atualiza o cliente no Asaas a partir dos dados cadastrados no usuário (nome, e-mail, CPF e telefone). Caso a API retorne 403 nesta demonstração, valide as credenciais direto no painel do Asaas antes de levar o fluxo a produção.

### Dicas de uso

- Defina o plano e a quantidade de licenças padrão ao cadastrar usuários em **/users**. O formulário agora permite ajustar valores negociados, dias de teste e tolerância de usuários adicionais.
- Utilize o plano “Avaliação 14 dias” para criar contas de teste com bloqueio automático após o período configurado.
- Sempre que o pagamento estiver pendente ou expirado, o sistema restringe as demais abas e direciona o usuário para **/billing** até a regularização.
- O checkout reaproveita automaticamente o cliente existente no Asaas (com base no ID salvo ou e-mail) e exibe os identificadores de cobrança no painel de usuários para facilitar conciliações.
- Masters podem contratar usuários extras até o limite configurado; o sistema alerta quando é necessário solicitar expansão antes de gerar uma nova cobrança.

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Executa a aplicação em modo desenvolvimento (http://localhost:3000). |
| `npm run build` | Gera o build otimizado para produção. |
| `npm start` | Sobe o servidor Next.js em modo produção após o build. |
| `npm run lint` | Executa a verificação de lint padrão do Next.js. |

---

Para dúvidas ou melhorias, fique à vontade para abrir issues ou pull requests neste repositório.
