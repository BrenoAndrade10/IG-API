export type EmailJobConfig = {
  name: string;
  enabled: boolean;
  cron: string;
  timezone: string;
  sender: {
    name: string;
    email: string;
  };
  to: string[];
  cc?: string[];
  subject: string;
  htmlContent: string;
};

export const emailJobs: EmailJobConfig[] = [
  {
    name: 'lista-espera-boas-vindas',
    enabled: false,
    cron: '*/1 * * * *',
    timezone: 'America/Sao_Paulo',
    sender: {
      name: 'Gisella Raquel',
      email: 'soporte@dragisellaraquel.com',
    },
    to: ['augustobreno2207@gmail.com'],
    subject: 'Receita nova para você',
    htmlContent: `
      <p>Oi!</p>
      <p>Esse é um disparo de email configurável.</p>
      <p>Quando estiver pronto para enviar de verdade, troque os destinatários, ajuste o cron e habilite o job em <strong>email-jobs.config.ts</strong>.</p>
    `,
  },
];
