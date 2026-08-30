import {
  Controller,
  Get,
  Post,
  HttpCode,
  Body,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import axios from 'axios';
import type { Response } from 'express';
import { AppService } from './app.service';

type InstagramWebhookBody = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        id?: string;
        comment_id?: string;
        text?: string;
      };
    }[];
  }[];
};

type InstagramMessage = {
  text: string;
};

type InstagramCommentReply = {
  commentId: string;
  message: InstagramMessage;
};

const isAxiosError = (error: unknown): error is import('axios').AxiosError =>
  axios.isAxiosError(error);

const getInstagramErrorData = (error: unknown) => {
  if (isAxiosError(error)) {
    return error.response?.data ?? error.message;
  }

  return error;
};

const INSTAGRAM_API_URL = 'https://graph.instagram.com/v26.0/me/messages';
const APPLE_COMMENT_KEYWORD = 'maca';
const SAUERKRAUT_COMMENT_KEYWORD = 'chucrute';

const APPLE_RECIPE_MESSAGE = `Oi, mãe!

Vi que você comentou MAÇÃ no Reels, então aqui está a receita da maçã cozida que faço por aqui.

Ingredientes:
- 1 maçã cortada, sem casca
- Água filtrada, até cobrir
- Manteiga ou óleo de coco, a gosto, para servir

Modo de preparo:
1. Corte a maçã sem casca em pedaços.
2. Coloque em uma panela com água filtrada até cobrir.
3. Deixe ferver até a maçã ficar macia, no ponto de amassar.
4. Sirva morna, com uma boa quantidade de gordura, como manteiga ou óleo de coco.

Salve para fazer com calma! 🍎

E, se você quer aprender mais receitas como essa e entender o caminho que ensino para controlar a dermatite do seu filho, entre no meu grupo do WhatsApp.

Entre aqui: https://biancachambo.com.br/listadeespera/ ❤️`;

const SAUERKRAUT_RECIPE_MESSAGE = `Oi! 💛 Vi que você comentou CHUCRUTE no meu vídeo.
E aqui está a receita!

Ingredientes
• 1 repolho
• 1 colher de sopa de sal
• Água filtrada
• Vidro esterilizado

Modo de Preparo
1. Lave o repolho, retire as folhas externas e reserve 2 folhas inteiras.
2. Corte em tiras finas ou rale.
3. Misture com o sal e descanse por 10 a 15 min.
4. Massageie até soltar bastante líquido.
5. Coloque o repolho amassado no vidro.
6. Cubra com uma folha inteira e complete com o próprio líquido.
7. Se faltar líquido, adicione salmoura: 1 litro de água filtrada + 1 colher de chá de sal.
8. Deixe no escuro por no mínimo 7 dias. Depois de aberto, guarde na geladeira.

Você pode variar adicionando alho ou gengibre!

Importante: o repolho precisa ficar sempre submerso para não mofar.

Quero te convidar para a Semana Colocando a Dermatite pra Dormir, um evento gratuito onde vou mostrar o caminho que fez diferença aqui em casa.

👉 Inscrição gratuita no link da minha bio. Te espero lá! ❤️`;

const INSTAGRAM_COMMENT_REPLY_RULES = [
  {
    keyword: APPLE_COMMENT_KEYWORD,
    message: APPLE_RECIPE_MESSAGE,
  },
  {
    keyword: SAUERKRAUT_COMMENT_KEYWORD,
    message: SAUERKRAUT_RECIPE_MESSAGE,
  },
];

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('privacy')
  @Header('Content-Type', 'text/html')
  privacy() {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Política de Privacidade</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0 auto;
              max-width: 760px;
              padding: 32px 20px;
              color: #1f2937;
            }

            h1,
            h2 {
              color: #111827;
            }

            h1 {
              margin-bottom: 8px;
            }

            p {
              margin: 0 0 16px;
            }
          </style>
        </head>
        <body>
          <h1>Política de Privacidade</h1>
          <p><strong>Última atualização:</strong> 19 de agosto de 2026.</p>

          <p>
            Esta aplicação utiliza recursos da API do Instagram para gerenciar
            interações de contas autorizadas pelo próprio usuário ou pelo
            responsável pela conta.
          </p>

          <h2>Dados acessados</h2>
          <p>
            A aplicação pode acessar apenas as informações necessárias para
            identificar, receber e processar eventos disponibilizados pela API do
            Instagram, como identificadores de conta, comentários, mensagens ou
            outros dados enviados por webhooks autorizados.
          </p>

          <h2>Finalidade</h2>
          <p>
            Os dados são utilizados exclusivamente para executar as
            funcionalidades autorizadas, como automação, monitoramento e resposta
            a interações relacionadas à conta conectada.
          </p>

          <h2>Compartilhamento</h2>
          <p>
            Os dados não são vendidos, alugados ou compartilhados com terceiros
            para fins comerciais. O acesso é limitado ao funcionamento da
            aplicação e ao cumprimento de obrigações legais, quando aplicável.
          </p>

          <h2>Armazenamento e segurança</h2>
          <p>
            A aplicação adota medidas razoáveis para proteger as informações
            processadas e mantém dados somente pelo tempo necessário para a
            prestação do serviço ou cumprimento de requisitos legais.
          </p>

          <h2>Exclusão de dados</h2>
          <p>
            O usuário pode solicitar a exclusão dos dados associados à aplicação
            a qualquer momento. Após a solicitação, os dados serão removidos
            dentro de prazo razoável, exceto quando a retenção for necessária por
            obrigação legal.
          </p>

          <h2>Contato</h2>
          <p>
            Para dúvidas sobre privacidade ou solicitações de exclusão de dados,
            entre em contato com o responsável pela aplicação.
          </p>
        </body>
      </html>
    `;
  }

  @Get('webhooks/instagram')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() response: Response,
  ) {
    const VERIFY_TOKEN =
      'igwh_7f3c91a8e42d6b50c17f94e83a2d65b1f9c407ae583d21c6';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return response.status(200).send(challenge);
    }

    return response.sendStatus(403).send();
  }

  @Post('webhooks/instagram')
  @HttpCode(200)
  async receiveInstagramWebhook(@Body() body: InstagramWebhookBody) {
    console.log('🔥 INSTAGRAM EVENT:', JSON.stringify(body, null, 2));

    const commentReplies = this.getInstagramCommentReplies(body);

    await Promise.all(
      commentReplies.map((reply) => this.sendInstagramPrivateReply(reply)),
    );

    return 'EVENT_RECEIVED';
  }

  private getInstagramCommentReplies(
    body: InstagramWebhookBody,
  ): InstagramCommentReply[] {
    return (
      body.entry
        ?.flatMap((entry) => entry.changes ?? [])
        .filter((change) => change.field === 'comments')
        .map((change) => {
          const commentId = change.value?.id ?? change.value?.comment_id;
          const replyRule = this.getReplyRule(change.value?.text);

          if (!commentId || !replyRule) {
            return null;
          }

          return {
            commentId,
            message: {
              text: replyRule.message,
            },
          };
        })
        .filter((reply): reply is InstagramCommentReply => Boolean(reply)) ?? []
    );
  }

  private getReplyRule(commentText?: string) {
    if (!commentText) {
      return undefined;
    }

    const normalizedComment = commentText
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    const words = normalizedComment.split(/\W+/);

    return INSTAGRAM_COMMENT_REPLY_RULES.find((rule) =>
      words.includes(rule.keyword),
    );
  }

  private async sendInstagramPrivateReply(reply: InstagramCommentReply) {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!accessToken) {
      console.warn('INSTAGRAM_ACCESS_TOKEN não configurado.');
      return;
    }

    try {
      const response = await this.sendInstagramMessage(
        reply.commentId,
        accessToken,
        reply.message,
      );

      console.log(
        '✅ INSTAGRAM PRIVATE REPLY SENT:',
        JSON.stringify(response.data, null, 2),
      );
    } catch (error) {
      console.error(
        '❌ INSTAGRAM PRIVATE REPLY FAILED:',
        JSON.stringify(getInstagramErrorData(error), null, 2),
      );
    }
  }

  private sendInstagramMessage(
    commentId: string,
    accessToken: string,
    message: InstagramMessage,
  ) {
    return axios.post(
      INSTAGRAM_API_URL,
      {
        recipient: {
          comment_id: commentId,
        },
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
