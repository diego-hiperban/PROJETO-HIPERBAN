export type ConsignadoCltBank = {
  id: string;
  name: string;
  description: string;
  link: string;
  logo?: string;
  tags?: string[];
};

export const consignadoCltBanks: ConsignadoCltBank[] = [
  {
    id: 'banco-ph',
    name: 'Banco PH',
    description: 'Modalidade consignada para profissionais CLT com avaliação ágil e taxas competitivas.',
    link: 'https://hiperban.com.br/fichas/banco-ph',
    tags: ['Taxas reduzidas', 'Atendimento digital'],
  },
  {
    id: 'banco-pan',
    name: 'Banco PAN',
    description: 'Crédito consignado com desconto em folha e opções de portabilidade.',
    link: 'https://hiperban.com.br/fichas/banco-pan',
    tags: ['Portabilidade', 'Folha CLT'],
  },
  {
    id: 'c6-bank',
    name: 'C6 Bank',
    description: 'Oferta consignada com assinatura 100% online e acompanhamento pelo app.',
    link: 'https://hiperban.com.br/fichas/c6-bank',
    tags: ['Processo digital', 'Assinatura online'],
  },
  {
    id: 'facta',
    name: 'Facta Financeira',
    description: 'Linhas consignadas especializadas para servidores privados e convênios corporativos.',
    link: 'https://hiperban.com.br/fichas/facta',
    tags: ['Convênios', 'Especialista consignado'],
  },
  {
    id: 'ole-consignado',
    name: 'Olé Consignado',
    description: 'Crédito consignado com assinatura eletrônica e aprovação simplificada.',
    link: 'https://hiperban.com.br/fichas/ole-consignado',
    tags: ['Assinatura eletrônica', 'Atendimento rápido'],
  },
  {
    id: 'bmg',
    name: 'Banco BMG',
    description: 'Produtos consignados com opção de cartão benefício e flexibilidade de pagamento.',
    link: 'https://hiperban.com.br/fichas/banco-bmg',
    tags: ['Cartão benefício', 'Flexibilidade'],
  },
  {
    id: 'daycoval',
    name: 'Banco Daycoval',
    description: 'Operação consignada focada em empresas privadas com análise personalizada.',
    link: 'https://hiperban.com.br/fichas/banco-daycoval',
    tags: ['Atendimento consultivo', 'Análise personalizada'],
  },
];
