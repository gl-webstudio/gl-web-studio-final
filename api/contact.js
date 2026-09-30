// Função serverless da Vercel:
// recebe os dados do formulário e envia o pedido por e-mail através da Resend.
//
// Variáveis de ambiente necessárias na Vercel:
// RESEND_API_KEY -> chave da conta Resend
// CONTACT_TO     -> e-mail que receberá os pedidos
// FROM_EMAIL     -> e-mail remetente autorizado na Resend

const CAMPOS = {
  nome: ["Nome", 100],
  email: ["E-mail", 150],
  telefone: ["Telefone", 40],
  negocio: ["Nome do negócio", 120],
  tipo_negocio: ["Tipo de negócio", 120],
  servico: ["Serviço pretendido", 60],
  tipo_website: ["Tipo de website", 60],
  mensagem: ["Mensagem", 2000]
};

const MAX_PEDIDO = 10000;

const limpar = (valor, limite) => {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, limite);
};

const escaparHtml = (valor) => {
  return String(valor)
    .replace(/[&<>"]/g, (caractere) => {
      const entidades = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      };

      return entidades[caractere];
    });
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  // Permitir apenas pedidos POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      erro: "Método não permitido."
    });
  }

  try {
    let dados = req.body;

    // Alguns ambientes podem entregar o body como texto
    if (typeof dados === "string") {
      if (dados.length > MAX_PEDIDO) {
        return res.status(413).json({
          ok: false,
          erro: "Pedido demasiado grande."
        });
      }

      try {
        dados = JSON.parse(dados || "{}");
      } catch {
        return res.status(400).json({
          ok: false,
          erro: "Dados inválidos."
        });
      }
    }

    if (!dados || typeof dados !== "object") {
      return res.status(400).json({
        ok: false,
        erro: "Dados inválidos."
      });
    }

    // Limpar e limitar os campos recebidos
    const pedido = {};

    for (const [campo, configuracao] of Object.entries(CAMPOS)) {
      pedido[campo] = limpar(dados[campo], configuracao[1]);
    }

    // Campos obrigatórios
    if (!pedido.nome) {
      return res.status(400).json({
        ok: false,
        erro: "O nome é obrigatório."
      });
    }

    if (!pedido.email) {
      return res.status(400).json({
        ok: false,
        erro: "O e-mail é obrigatório."
      });
    }

    // Validação simples do e-mail
    const emailValido =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pedido.email);

    if (!emailValido) {
      return res.status(400).json({
        ok: false,
        erro: "Introduza um e-mail válido."
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const destinatario = process.env.CONTACT_TO;
    const remetente =
      process.env.FROM_EMAIL || "GL Web Studio <onboarding@resend.dev>";

    if (!apiKey) {
      console.error("RESEND_API_KEY não configurada.");
      return res.status(500).json({
        ok: false,
        erro: "Serviço de e-mail não configurado."
      });
    }

    if (!destinatario) {
      console.error("CONTACT_TO não configurada.");
      return res.status(500).json({
        ok: false,
        erro: "Destinatário do formulário não configurado."
      });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2 style="margin-bottom: 20px;">Novo pedido — GL Web Studio</h2>

        <p><strong>Nome:</strong><br>
        ${escaparHtml(pedido.nome)}</p>

        <p><strong>E-mail:</strong><br>
        ${escaparHtml(pedido.email)}</p>

        <p><strong>Telefone:</strong><br>
        ${escaparHtml(pedido.telefone || "Não informado")}</p>

        <p><strong>Nome do negócio:</strong><br>
        ${escaparHtml(pedido.negocio || "Não informado")}</p>

        <p><strong>Tipo de negócio:</strong><br>
        ${escaparHtml(pedido.tipo_negocio || "Não informado")}</p>

        <p><strong>Serviço pretendido:</strong><br>
        ${escaparHtml(pedido.servico || "Não informado")}</p>

        <p><strong>Tipo de website:</strong><br>
        ${escaparHtml(pedido.tipo_website || "Não informado")}</p>

        <p><strong>Mensagem:</strong></p>

        <div style="
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          white-space: pre-wrap;
        ">
          ${escaparHtml(pedido.mensagem || "Sem mensagem.")}
        </div>

        <hr style="margin: 25px 0; border: 0; border-top: 1px solid #ddd;">

        <p style="font-size: 12px; color: #777;">
          Pedido enviado através do formulário do website GL Web Studio.
        </p>
      </div>
    `;

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: remetente,
        to: [destinatario],
        reply_to: pedido.email,
        subject: `Novo pedido de ${pedido.nome} — GL Web Studio`,
        html
      })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro da Resend:", resultado);

      return res.status(502).json({
        ok: false,
        erro: "Não foi possível enviar o pedido."
      });
    }

    return res.status(200).json({
      ok: true,
      mensagem: "Pedido enviado com sucesso."
    });

  } catch (erro) {
    console.error("Erro no formulário:", erro);

    return res.status(500).json({
      ok: false,
      erro: "Ocorreu um erro ao processar o pedido."
    });
  }
};
