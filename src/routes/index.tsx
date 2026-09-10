import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessagesSquare, Radio, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexo — videochamada P2P e chat para equipes" },
      {
        name: "description",
        content:
          "Salas de equipe com vídeo HD ponto a ponto, controle de volume por participante, aperte-para-falar e chat com arquivos.",
      },
      { property: "og:title", content: "Nexo — videochamada P2P e chat para equipes" },
      {
        property: "og:description",
        content:
          "Vídeo HD ponto a ponto, aperte-para-falar e chat com imagens, PDFs e planilhas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Video,
    title: "Vídeo P2P em HD",
    text: "As câmeras conectam direto entre os notebooks, sem servidor no meio da conversa.",
  },
  {
    icon: MessagesSquare,
    title: "Chat e arquivos",
    text: "Mensagens em tempo real com imagens, PDFs e planilhas anexadas.",
  },
  {
    icon: ShieldCheck,
    title: "Controle total do áudio",
    text: "Volume individual de cada pessoa, mudo, silenciar tudo e aperte-para-falar.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Se o usuário já estiver logado (Google ou Email), redireciona direto para as salas
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void navigate({ to: "/rooms", replace: true });
      }
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 font-sans">
      <div className="flex items-center gap-2 text-primary">
        <Radio className="size-5" />
        <span className="font-display text-lg font-semibold text-foreground">Nexo</span>
      </div>

      <h1 className="mt-10 max-w-3xl text-5xl font-semibold leading-tight text-gradient sm:text-6xl">
        A sala do seu time, com vídeo direto entre as pessoas.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        Conversas por texto, chamadas de vídeo ponto a ponto em alta definição e
        compartilhamento de arquivos — tudo em um espaço escuro, rápido e sem
        distrações.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="shadow-glow">
          <Link to="/rooms">Entrar nas salas</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/auth">Criar conta / Entrar</Link>
        </Button>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="panel p-5">
            <f.icon className="size-5 text-primary" />
            <h2 className="mt-3 text-base font-semibold text-foreground">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
