import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { Navigation } from "./components/Navigation";

export const metadata: Metadata = {
  title: "Hiperban - Plataforma Comercial",
  description: "Gestão de usuários, loja online e esteira de negócios da Hiperban.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AuthProvider>
          <Navigation />
          <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
