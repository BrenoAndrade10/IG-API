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

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

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
    const VERIFY_TOKEN = 'igwh_7f3c91a8e42d6b50c17f94e83a2d65b1f9c407ae583d21c6';

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

    const commentIds = this.getInstagramCommentIds(body);

    await Promise.all(
      commentIds.map((commentId) => this.sendInstagramPrivateReply(commentId)),
    );

    return 'EVENT_RECEIVED';
  }

  private getInstagramCommentIds(body: InstagramWebhookBody) {
    return (
      body.entry
        ?.flatMap((entry) => entry.changes ?? [])
        .filter((change) => change.field === 'comments')
        .map((change) => change.value?.id ?? change.value?.comment_id)
        .filter((commentId): commentId is string => Boolean(commentId)) ?? []
    );
  }

  private async sendInstagramPrivateReply(commentId: string) {
    const accessToken = 'IGAAWbzGbJ8ZBZABZAFlQQXdmRGE0bUZAxd1FDNlROWEhaVFBJNENnTmEtM3A5MkRCOVctLW5JdXpPX1haUGdqN3czamtPR3NpR3lvUDNfd2dadTcxVnBFUDdNOUcyVnhWUHJVdUZADeFVYb3NETUxTa2lRc1BvekJMLXRiMXBVSk5uQQZDZD';

    const message = 'Olá! 👋 Vi seu comentário. Aqui está o que você pediu!';

    if (!accessToken) {
      console.warn('INSTAGRAM_ACCESS_TOKEN não configurado.');
      return;
    }

    return

    try {
      const response = await axios.post(
        'https://graph.instagram.com/v26.0/me/messages',
        {
          recipient: {
            comment_id: commentId,
          },
          message: {
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log(
        '✅ INSTAGRAM PRIVATE REPLY SENT:',
        JSON.stringify(response.data, null, 2),
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          '❌ INSTAGRAM PRIVATE REPLY FAILED:',
          JSON.stringify(
            error.response?.data ?? error.message,
            null,
            2,
          ),
        );

        return;
      }

      console.error(
        '❌ INSTAGRAM PRIVATE REPLY FAILED:',
        error,
      );
    }
  }
}
