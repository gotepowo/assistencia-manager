import db from "@/api/databaseClient";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_FORM = {
  person_type: "cpf",
  full_name: "",
  cpf: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function ClientFormDialog({ open, onOpenChange, client, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (client) {
      setForm({
        person_type: client.person_type || (client.cnpj ? "cnpj" : "cpf"),
        full_name: client.full_name || "",
        cpf: client.cpf || "",
        cnpj: client.cnpj || "",
        phone: client.phone || "",
        email: client.email || "",
        address: client.address || "",
        notes: client.notes || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [client, open]);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCpf = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatCnpj = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.full_name.trim() || !form.phone.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const documentValue = form.person_type === "cpf" ? form.cpf : form.cnpj;
    if (documentValue && documentValue.replace(/\D/g, "").length !== (form.person_type === "cpf" ? 11 : 14)) {
      toast({ title: `${form.person_type === "cpf" ? "CPF" : "CNPJ"} incompleto`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        cpf: form.person_type === "cpf" ? form.cpf : "",
        cnpj: form.person_type === "cnpj" ? form.cnpj : "",
      };

      if (client?.id) {
        await db.entities.Client.update(client.id, data);
        toast({ title: "Cliente atualizado com sucesso!" });
      } else {
        await db.entities.Client.create(data);
        toast({ title: "Cliente cadastrado com sucesso!" });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao salvar cliente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client?.id ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs
            value={form.person_type}
            onValueChange={(person_type) => setForm((current) => ({ ...current, person_type }))}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cpf">Pessoa Física / CPF</TabsTrigger>
              <TabsTrigger value="cnpj">Pessoa Jurídica / CNPJ</TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            <Label>{form.person_type === "cpf" ? "Nome Completo" : "Razão Social / Nome"} *</Label>
            <Input
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              placeholder={form.person_type === "cpf" ? "Nome do cliente" : "Nome da empresa"}
            />
          </div>

          <div>
            <Label>{form.person_type === "cpf" ? "CPF" : "CNPJ"}</Label>
            {form.person_type === "cpf" ? (
              <Input
                value={form.cpf}
                onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            ) : (
              <Input
                value={form.cnpj}
                onChange={(event) => setForm({ ...form, cnpj: formatCnpj(event.target.value) })}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            )}
          </div>

          <div>
            <Label>Telefone / WhatsApp *</Label>
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Endereço completo" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notas adicionais..." rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : client?.id ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
