import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  listMessagesFn,
  createMessageFn,
  deleteMessageFn,
  sendMessageFn,
} from "@/lib/messages.functions";

export const Route = createFileRoute("/app/")({
  component: MensagensPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sent: "Enviada",
  failed: "Falhou",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  draft: "secondary",
  scheduled: "default",
  sent: "default",
  failed: "destructive",
};

function fileToBase64(file: File): Promise<{ base64: string; mimetype: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1] ?? "", mimetype: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MensagensPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["messages"], queryFn: () => listMessagesFn() });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ base64: string; mimetype: string } | null>(null);
  const [when, setWhen] = useState<"send_now" | "draft" | "scheduled">("send_now");
  const [scheduledFor, setScheduledFor] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createMessageFn({
        data: {
          text,
          image,
          status: when,
          scheduledFor: when === "scheduled" ? scheduledFor : null,
        },
      }),
    onSuccess: () => {
      toast.success("Mensagem salva");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setOpen(false);
      setText("");
      setImage(null);
      setScheduledFor("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMessageFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => sendMessageFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Mensagem enviada");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stats = data?.stats ?? { draft: 0, scheduled: 0, sent: 0, failed: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Mensagens</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Nova mensagem</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova mensagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msg-text">Mensagem</Label>
                <Textarea
                  id="msg-text"
                  placeholder="Ex: 🔥 Passagem encontrada! GRU → MIA por 12.000 milhas + R$89..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-image">Imagem (opcional)</Label>
                <Input
                  id="msg-image"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    setImage(file ? await fileToBase64(file) : null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Quando enviar?</Label>
                <div className="flex gap-4 text-sm">
                  {(["send_now", "draft", "scheduled"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5">
                      <input type="radio" checked={when === opt} onChange={() => setWhen(opt)} />
                      {opt === "send_now" ? "Enviar agora" : opt === "draft" ? "Salvar como rascunho" : "Agendar"}
                    </label>
                  ))}
                </div>
              </div>
              {when === "scheduled" && (
                <div className="space-y-2">
                  <Label htmlFor="msg-when">Data e hora</Label>
                  <Input
                    id="msg-when"
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(["sent", "scheduled", "draft", "failed"] as const).map((key) => (
          <Card key={key} className="p-4">
            <p className="text-xs text-muted-foreground">
              {key === "sent" ? "Enviadas" : key === "scheduled" ? "Agendadas" : key === "draft" ? "Rascunhos" : "Falharam"}
            </p>
            <p className="mt-1 text-2xl font-bold">{stats[key]}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h3>Histórico</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Data</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : !data?.messages.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma mensagem ainda.
                </TableCell>
              </TableRow>
            ) : (
              data.messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">{m.text || "(sem texto)"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.scheduled_for || m.sent_at || m.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="row-actions text-right">
                    {m.status !== "sent" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => sendMutation.mutate(m.id)}>
                          Enviar agora
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(m.id)}>
                          Excluir
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
