import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Resend } from 'resend';
import { readFile, utils } from 'xlsx';

type CliOptions = {
  template?: string;
  list?: string;
  sheet?: string;
  emailColumn?: string;
  campaign?: string;
  history?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  from?: string;
  dryRun?: boolean;
  batchSize?: number;
  batchDelayMs?: number;
};

type SendStatus = 'sent' | 'failed';

type EmailHistory = {
  version: 1;
  emails: Record<
    string,
    {
      campaigns: Record<
        string,
        {
          status: SendStatus;
          template: string;
          subject: string;
          sentAt?: string;
          failedAt?: string;
          error?: string;
        }
      >;
    }
  >;
};

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`O parâmetro ${arg} precisa de um valor.`);
    }

    index += 1;

    switch (arg) {
      case '--template':
        options.template = nextValue;
        break;
      case '--list':
        options.list = nextValue;
        break;
      case '--sheet':
        options.sheet = nextValue;
        break;
      case '--email-column':
        options.emailColumn = nextValue;
        break;
      case '--campaign':
        options.campaign = nextValue;
        break;
      case '--history':
        options.history = nextValue;
        break;
      case '--to':
        options.to = parseList(nextValue);
        break;
      case '--cc':
        options.cc = parseList(nextValue);
        break;
      case '--subject':
        options.subject = nextValue;
        break;
      case '--from':
        options.from = nextValue;
        break;
      case '--batch-size':
        options.batchSize = Number(nextValue);
        break;
      case '--batch-delay-ms':
        options.batchDelayMs = Number(nextValue);
        break;
      default:
        throw new Error(`Parâmetro não reconhecido: ${arg}`);
    }
  }

  return options;
};

const loadEnvFile = () => {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, 'utf8');

  envFile.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');

    process.env[key] ??= value;
  });
};

const printUsage = () => {
  console.log(`Uso:
yarn email:send-template --template email-templates/test-email.html --to pessoa@email.com --subject "Email de teste" --from "Nome <email@dominio.com>"

yarn email:send-template --template email-templates/01-whatsapp-grupo-oficial.html --list email-lists/01-nao-entraram-grupo-whatsapp.xlsx --sheet "Não entraram" --email-column email --campaign grupo-whatsapp --subject "Ingresa al grupo oficial de WhatsApp" --from "Gisella Raquel <soporte@dragisellaraquel.com>"

Opções:
  --template  Caminho do arquivo HTML do template
  --list      Opcional: caminho da planilha .xlsx com a lista
  --sheet     Opcional: nome da aba da planilha
  --email-column  Opcional: nome da coluna de email. Padrão: email
  --campaign  Identificador do envio para controlar duplicidade
  --history   Opcional: caminho do JSON de histórico. Padrão: email-send-history.json
  --to        Um ou mais emails separados por vírgula, se não usar --list
  --subject   Assunto do email
  --from      Remetente no formato "Nome <email@dominio.com>"
  --batch-size  Opcional: quantidade de envios simultâneos. Padrão: 100
  --batch-delay-ms  Opcional: intervalo entre batches em ms. Padrão: 4000
  --cc        Opcional: emails em cópia separados por vírgula
  --dry-run   Simula o envio, sem chamar a API`);
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const uniqueEmails = (emails: string[]) =>
  Array.from(
    new Set(
      emails
        .map(normalizeEmail)
        .filter((email) => email && isValidEmail(email)),
    ),
  );

const readEmailsFromXlsx = (options: CliOptions) => {
  if (!options.list) {
    return [];
  }

  const listPath = resolve(process.cwd(), options.list);

  if (!existsSync(listPath)) {
    throw new Error(`Lista não encontrada: ${listPath}`);
  }

  const workbook = readFile(listPath, { cellDates: false });
  const sheetName = options.sheet ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(
      `Aba "${sheetName}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`,
    );
  }

  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  const emailColumn = options.emailColumn ?? 'email';

  return rows
    .map((row) => row[emailColumn])
    .filter((value): value is string | number => Boolean(value))
    .map((value) => String(value));
};

const loadHistory = (historyPath: string): EmailHistory => {
  if (!existsSync(historyPath)) {
    return {
      version: 1,
      emails: {},
    };
  }

  return JSON.parse(readFileSync(historyPath, 'utf8')) as EmailHistory;
};

const saveHistory = (historyPath: string, history: EmailHistory) => {
  mkdirSync(dirname(historyPath), { recursive: true });

  const tempPath = `${historyPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(history, null, 2)}\n`);
  renameSync(tempPath, historyPath);
};

const hasReceivedCampaign = (
  history: EmailHistory,
  email: string,
  campaign: string,
) => history.emails[email]?.campaigns[campaign]?.status === 'sent';

const recordEmailStatus = (
  history: EmailHistory,
  input: {
    email: string;
    campaign: string;
    status: SendStatus;
    template: string;
    subject: string;
    error?: string;
  },
) => {
  history.emails[input.email] ??= { campaigns: {} };

  const now = new Date().toISOString();

  history.emails[input.email].campaigns[input.campaign] = {
    status: input.status,
    template: input.template,
    subject: input.subject,
    sentAt: input.status === 'sent' ? now : undefined,
    failedAt: input.status === 'failed' ? now : undefined,
    error: input.error,
  };
};

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const sendEmail = async (input: {
  resend: Resend;
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
}) =>
  input.resend.emails.send({
    from: input.from,
    to: [input.to],
    cc: input.cc,
    subject: input.subject,
    html: input.html,
  });

const sleep = (ms: number) =>
  new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });

const renderTemplate = (templateContent: string) => {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');

  if (templateContent.includes('{{APP_BASE_URL}}') && !appBaseUrl) {
    throw new Error(
      'APP_BASE_URL não configurada no .env. Ela é necessária para renderizar imagens nos templates.',
    );
  }

  return templateContent.replaceAll('{{APP_BASE_URL}}', appBaseUrl ?? '');
};

const main = async () => {
  loadEnvFile();

  const options = parseArgs(process.argv.slice(2));

  const campaign = options.campaign ?? options.template;
  const emails = uniqueEmails([
    ...(options.to ?? []),
    ...readEmailsFromXlsx(options),
  ]);

  if (
    !options.template ||
    !emails.length ||
    !options.subject ||
    !options.from ||
    !campaign
  ) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const template = options.template;
  const subject = options.subject;
  const from = options.from;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada no .env.');
  }

  const templatePath = resolve(process.cwd(), template);

  if (!existsSync(templatePath)) {
    throw new Error(`Template não encontrado: ${templatePath}`);
  }

  const resend = new Resend(apiKey);
  const html = renderTemplate(readFileSync(templatePath, 'utf8'));
  const historyPath = resolve(
    process.cwd(),
    options.history ?? 'email-send-history.json',
  );
  const history = loadHistory(historyPath);
  const pendingEmails = emails.filter(
    (email) => !hasReceivedCampaign(history, email, campaign),
  );
  const skippedCount = emails.length - pendingEmails.length;
  const batchSize = options.batchSize ?? 100;
  const batchDelayMs = options.batchDelayMs ?? 4000;

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('--batch-size precisa ser um número inteiro maior que zero.');
  }

  if (!Number.isInteger(batchDelayMs) || batchDelayMs < 0) {
    throw new Error('--batch-delay-ms precisa ser um número inteiro maior ou igual a zero.');
  }

  console.log(`Campanha: ${campaign}`);
  console.log(`Emails válidos na lista: ${emails.length}`);
  console.log(`Já enviados anteriormente: ${skippedCount}`);
  console.log(`Pendentes para envio: ${pendingEmails.length}`);
  console.log(`Tamanho do batch: ${batchSize}`);
  console.log(`Delay entre batches: ${batchDelayMs}ms`);

  if (options.dryRun) {
    console.log('Dry-run ativo: nenhum email foi enviado.');
    return;
  }

  const batches = chunk(pendingEmails, batchSize);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    console.log(`Enviando batch ${index + 1}/${batches.length}: ${batch.length} emails`);

    const results = await Promise.allSettled(
      batch.map((email) =>
        sendEmail({
          resend,
          from,
          to: email,
          cc: options.cc,
          subject,
          html,
        }).then((response) => ({
          email,
          response,
        })),
      ),
    );

    results.forEach((result, resultIndex) => {
      const email = batch[resultIndex];

      if (result.status === 'fulfilled') {
        recordEmailStatus(history, {
          email,
          campaign,
          status: 'sent',
          template,
          subject,
        });

        console.log(
          `Enviado para ${email}: ${JSON.stringify(result.value.response)}`,
        );
        return;
      }

      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);

      recordEmailStatus(history, {
        email,
        campaign,
        status: 'failed',
        template,
        subject,
        error: message,
      });

      console.error(`Falha ao enviar para ${email}: ${message}`);
    });

    saveHistory(historyPath, history);

    if (index < batches.length - 1 && batchDelayMs > 0) {
      console.log(`Aguardando ${batchDelayMs}ms antes do próximo batch...`);
      await sleep(batchDelayMs);
    }
  }

  console.log(`Histórico salvo em: ${historyPath}`);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
