require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// uploads (limite e nomes)
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 10);
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// view simples
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// envio do formulário (com anexos)
app.post('/submit', upload.array('anexos', 5), async (req, res) => {
  try {
    const form = req.body;

    // monta HTML organizado por seções
    const sec = (titulo, conteudo) => `
      <h2 style="margin:16px 0 8px 0;">${titulo}</h2>
      <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border:1px solid #eee;">
        ${conteudo}
      </table>
    `;

    const row = (label, value) => `
      <tr>
        <td style="width:35%;background:#fafafa;border-bottom:1px solid #eee;"><strong>${label}</strong></td>
        <td style="border-bottom:1px solid #eee;">${value || '-'}</td>
      </tr>
    `;

    // formatações básicas
    const fmt = {
      cep: v => v?.replace(/\D/g,'').replace(/^(\d{5})(\d{3}).*/, '$1-$2'),
      cnpj: v => v?.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5'),
      tel:  v => {
        const d = v?.replace(/\D/g,'') || '';
        if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
        return v || '-';
      }
    };

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">
        <h1 style="margin:0 0 12px 0;">Nova ficha cadastral (Pessoa Jurídica)</h1>
        <p style="margin:0 0 8px 0;">Recebida em ${new Date().toLocaleString()}</p>

        ${sec('Executivo / Empresa', 
          row('Nome do Executivo', form.nomeExecutivo) +
          row('Razão Social', form.razaoSocial) +
          row('CNPJ', fmt.cnpj(form.cnpj)) +
          row('Inscrição Estadual', form.inscricaoEstadual) +
          row('E-mail', form.emailPrincipal) +
          row('Telefone', fmt.tel(form.telefonePrincipal))
        )}

        ${sec('Endereço Principal',
          row('CEP', fmt.cep(form.cepPrincipal)) +
          row('Logradouro', form.logradouroPrincipal) +
          row('Número', form.numeroPrincipal) +
          row('Complemento', form.complementoPrincipal) +
          row('Bairro', form.bairroPrincipal) +
          row('Cidade/UF', `${form.cidadePrincipal || ''}/${form.ufPrincipal || ''}`)
        )}

        ${form.entregaIgual === 'nao' ? sec('Endereço de Entrega',
          row('CEP', fmt.cep(form.cepEntrega)) +
          row('Logradouro', form.logradouroEntrega) +
          row('Número', form.numeroEntrega) +
          row('Complemento', form.complementoEntrega) +
          row('Bairro', form.bairroEntrega) +
          row('Cidade/UF', `${form.cidadeEntrega || ''}/${form.ufEntrega || ''}`)
        ) : ''}

        ${form.cobrancaIgual === 'nao' ? sec('Endereço de Cobrança',
          row('CEP', fmt.cep(form.cepCobranca)) +
          row('Logradouro', form.logradouroCobranca) +
          row('Número', form.numeroCobranca) +
          row('Complemento', form.complementoCobranca) +
          row('Bairro', form.bairroCobranca) +
          row('Cidade/UF', `${form.cidadeCobranca || ''}/${form.ufCobranca || ''}`)
        ) : ''}

        ${sec('Financeiro',
          row('Contato Financeiro (Nome)', form.nomeFinanceiro) +
          row('E-mail Financeiro', form.emailFinanceiro) +
          row('Telefone Financeiro', fmt.tel(form.telefoneFinanceiro))
        )}

        ${sec('Dados Bancários',
          row('Banco', form.nomeBanco) +
          row('Agência', form.agencia) +
          row('Conta', form.conta) +
          row('Tipo de Conta', form.tipoConta) +
          row('PIX (opcional)', form.chavePix)
        )}

        <p style="margin-top:16px;">Protocolo: <strong>${Date.now()}</strong></p>
      </div>
    `;

    // anexos
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      path: f.path
    }));

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE) === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO,
      subject: `Ficha Cadastral PJ - ${form.razaoSocial || 'Nova submissão'}`,
      html,
      attachments
    });

    // limpa arquivos temporários
    attachments.forEach(a => fs.unlink(a.path, () => {}));

    res.status(200).json({ ok: true, message: 'Enviado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Falha ao enviar' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor no ar: http://localhost:${PORT}`);
});
