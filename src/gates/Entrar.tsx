import { useState } from 'react';
import { sb } from '../lib/supabase';

/**
 * Entrada no modo rede.
 *
 * Só aparece quando existe um projeto Supabase configurado. Sem isso o Croma
 * é local e não tem conta nenhuma — não faria sentido pedir login para guardar
 * fotos no próprio navegador.
 */
export function Entrar() {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const criando = aba === 'criar';
  const podeEnviar = email.trim().length > 3 && senha.length >= 6 && (!criando || nome.trim());

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar || ocupado) return;

    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const auth = sb().auth;

      if (criando) {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: { nome: nome.trim() },
            // Sem isto, o link de confirmação usa a "Site URL" do projeto, que
            // nasce apontando para localhost — quem se cadastrasse pelo site
            // publicado clicaria no e-mail e cairia no nada. Mandar a origem
            // atual faz o link voltar para onde a pessoa realmente está, seja
            // o domínio publicado ou a máquina de quem desenvolve.
            //
            // O Supabase só honra este valor se a origem estiver na lista de
            // Redirect URLs do projeto; fora dela, ele cai na Site URL.
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Com confirmação de e-mail ligada no projeto, não vem sessão na hora.
        if (!data.session) {
          setAviso(
            'Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre por aqui.',
          );
          setAba('entrar');
        }
      } else {
        const { error } = await auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) throw error;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui completar.';
      setErro(
        msg.includes('Invalid login')
          ? 'E-mail ou senha não conferem.'
          : msg.includes('already registered')
            ? 'Esse e-mail já tem conta. Tente entrar.'
            : msg,
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="app">
      <div className="entrada-tela">
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h1 className="abertura-marca" style={{ fontSize: 38 }}>
            Croma
          </h1>
          <p className="legenda">o look do dia, lido em cores</p>
        </div>

        <div className="abas" style={{ marginBottom: 18 }}>
          <button
            className={`aba${aba === 'entrar' ? ' ativa' : ''}`}
            onClick={() => {
              setAba('entrar');
              setErro(null);
            }}
          >
            Entrar
          </button>
          <button
            className={`aba${criando ? ' ativa' : ''}`}
            onClick={() => {
              setAba('criar');
              setErro(null);
            }}
          >
            Criar conta
          </button>
        </div>

        {aviso && <div className="aviso">{aviso}</div>}
        {erro && <div className="aviso erro">{erro}</div>}

        <form onSubmit={enviar}>
          {criando && (
            <label className="campo">
              <span className="campo-rotulo">Nome</span>
              <input
                className="entrada"
                value={nome}
                autoComplete="name"
                maxLength={40}
                placeholder="Como você quer aparecer"
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
          )}

          <label className="campo">
            <span className="campo-rotulo">E-mail</span>
            <input
              className="entrada"
              type="email"
              value={email}
              autoComplete="email"
              inputMode="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">Senha</span>
            <input
              className="entrada"
              type="password"
              value={senha}
              autoComplete={criando ? 'new-password' : 'current-password'}
              onChange={(e) => setSenha(e.target.value)}
            />
            {criando && (
              <span className="mini" style={{ display: 'block', marginTop: 5 }}>
                Mínimo de 6 caracteres.
              </span>
            )}
          </label>

          <button
            className="btn btn-primario btn-bloco"
            type="submit"
            disabled={!podeEnviar || ocupado}
            style={{ marginTop: 6 }}
          >
            {ocupado ? 'Um instante…' : criando ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="mini" style={{ marginTop: 20, lineHeight: 1.5 }}>
          Suas fotos ficam no storage do projeto Supabase configurado neste app, e as
          regras de acesso vêm do <code>schema.sql</code>: qualquer pessoa vê os looks
          publicados, só você mexe nos seus.
        </p>
      </div>
    </div>
  );
}
