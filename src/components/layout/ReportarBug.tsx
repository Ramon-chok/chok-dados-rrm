import React, { useState } from 'react';
import { Bug, CheckCircle2, Send } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { enviarRelatoBug, getErrorMessage } from '../../lib/api';
import { PainelLateral } from '../common/PainelLateral';

/**
 * Botão "Reportar bug" da faixa do topo (ícone de besouro) + formulário.
 *
 * O formulário abre no mesmo painel lateral das fichas. A tela atual, o
 * navegador e a resolução vão junto automaticamente — quem for reproduzir o
 * problema não precisa perguntar "em qual tela?" nem "em qual aparelho?".
 */
export const ReportarBug: React.FC<{ paginaAtual: string }> = ({ paginaAtual }) => {
  const { t } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [gravidade, setGravidade] = useState<'baixa' | 'media' | 'alta'>('media');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);

  const fechar = () => {
    setAberto(false);
    // Só limpa depois de enviado: fechar sem querer não pode apagar o texto.
    if (enviado !== null) {
      setTitulo('');
      setDescricao('');
      setGravidade('media');
      setEnviado(null);
    }
    setErro(null);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await enviarRelatoBug({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        gravidade,
        pagina: paginaAtual,
        navegador: navigator.userAgent,
        tela: `${window.innerWidth}x${window.innerHeight}`,
      });
      setEnviado(res.id);
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível enviar o relato. Tente novamente.'));
    } finally {
      setEnviando(false);
    }
  };

  const campo: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    color: t.text,
    font: 'inherit',
    fontSize: 13.5,
  };
  const rotulo: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: t.textSecondary,
    marginBottom: 6,
  };

  const opcoes: Array<{ id: 'baixa' | 'media' | 'alta'; texto: string; cor: string }> = [
    { id: 'baixa', texto: 'Baixa — incomoda, mas dá para trabalhar', cor: t.info },
    { id: 'media', texto: 'Média — atrapalha uma tarefa', cor: t.warning },
    { id: 'alta', texto: 'Alta — impede de trabalhar', cor: t.danger },
  ];

  return (
    <>
      <button
        type="button"
        className="faixa-botao"
        onClick={() => setAberto(true)}
        title="Reportar um bug"
        aria-label="Reportar um bug"
      >
        <Bug size={16} />
      </button>

      <PainelLateral
        aberto={aberto}
        onClose={fechar}
        rotulo="Reportar um bug"
        cabecalho={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bug size={18} color="#fff" />
            </span>
            <div>
              <h2 className="faixa-texto-forte" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                Reportar um bug
              </h2>
              <div className="faixa-texto-suave" style={{ fontSize: 11.5, marginTop: 2 }}>
                Tela atual: {paginaAtual}
              </div>
            </div>
          </div>
        }
      >
        {enviado !== null ? (
          <div style={{ textAlign: 'center', padding: '36px 8px' }}>
            <CheckCircle2 size={40} color={t.success} />
            <h3 style={{ margin: '14px 0 6px', fontSize: 17, color: t.text }}>Relato enviado</h3>
            <p style={{ margin: '0 auto', fontSize: 13.5, color: t.textSecondary, maxWidth: '40ch' }}>
              Registramos o relato <strong className="num">#{enviado}</strong>. Obrigado — a equipe de TI recebe a
              tela, o navegador e a resolução junto com a sua descrição.
            </p>
            <button
              type="button"
              onClick={fechar}
              style={{
                marginTop: 20,
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: t.primary,
                color: t.primaryForeground,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={rotulo} htmlFor="bug-titulo">
                O que deu errado?
              </label>
              <input
                id="bug-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={160}
                placeholder="Ex.: o gráfico de fabricantes não carrega"
                style={campo}
                required
              />
            </div>

            <div>
              <label style={rotulo} htmlFor="bug-descricao">
                Como aconteceu?
              </label>
              <textarea
                id="bug-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={4000}
                rows={7}
                placeholder="O que você fez, o que esperava ver e o que apareceu. Se houver um código de erro na tela, copie aqui."
                style={{ ...campo, resize: 'vertical', minHeight: 140 }}
                required
              />
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ ...rotulo, padding: 0 }}>Gravidade</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opcoes.map((o) => {
                  const marcado = gravidade === o.id;
                  return (
                    <label
                      key={o.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        border: `1px solid ${marcado ? o.cor : t.border}`,
                        background: marcado ? `${o.cor}14` : 'transparent',
                        fontSize: 13,
                        color: t.text,
                      }}
                    >
                      <input
                        type="radio"
                        name="bug-gravidade"
                        checked={marcado}
                        onChange={() => setGravidade(o.id)}
                        style={{ accentColor: o.cor }}
                      />
                      {o.texto}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {erro && <div style={{ fontSize: 12.5, color: t.danger }}>{erro}</div>}

            <button
              type="submit"
              disabled={enviando || titulo.trim().length < 4 || descricao.trim().length < 10}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 10,
                border: 'none',
                background: t.primary,
                color: t.primaryForeground,
                fontWeight: 600,
                fontSize: 14,
                cursor: enviando ? 'wait' : 'pointer',
                opacity: enviando || titulo.trim().length < 4 || descricao.trim().length < 10 ? 0.55 : 1,
              }}
            >
              <Send size={15} />
              {enviando ? 'Enviando…' : 'Enviar relato'}
            </button>
          </form>
        )}
      </PainelLateral>
    </>
  );
};
