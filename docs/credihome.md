# Credihome Partner API — Guia (Produção)

**Base:** `https://api-partner.credihome.com.br/v1/production`

## Endpoints usados
- `POST /login` → retorna `{"token":"<JWT>"}`
- `POST /simulador` → simulação (confirmado pela Credihome)
- `POST /proposta` → efetivação (campos variam por conta; manter mapeável)
- `GET /proposta/{id}` → status (opcional)

## Autenticação
Enviar o token no header:

```
Authorization: Bearer <JWT>
Content-Type: application/json
Accept: application/json

# opcional por conta:

channel: <SEU_CODIGO_DE_PARCEIRO>  # ex.: 11629

````

## Payloads recomendados

### Simulação (mínimo)
```json
{
  "valorFinanciamento": 320000,
  "prazoPagamento": 360,
  "sistema": "API"
}
````

### Simulação (básico – recomendado)

```json
{
  "valorImovel": 400000,
  "valorEntrada": 80000,
  "valorFinanciamento": 320000,
  "prazoPagamento": 360,
  "sistema": "API"
}
```

### Observações

* Em caso de **400 sem corpo**, registrar o header `x-amzn-RequestId` e abrir chamado com a Credihome.
* Em **401/403**, renovar JWT (fazer `POST /login`) e repetir a chamada uma vez.

## Variáveis de ambiente

* `CREDIHOME_BASE_URL`
* `CREDIHOME_LOGIN`
* `CREDIHOME_PASSWORD`
* `CREDIHOME_CHANNEL` (opcional)

Veja `.env.example` e `src/services/credihome.ts`.

````
