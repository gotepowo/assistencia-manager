import db from "@/api/databaseClient";

import React, { useState, useEffect } from "react";

import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Save, Store, Loader2, Upload } from "lucide-react";

const formatCnpj = (value) => value.replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settingId, setSettingId] = useState(null);

  const [form, setForm] = useState({
    store_name: "",
    address: "",
    cnpj: "",
    phone: "",
    email: "",
    logo_url: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await db.entities.Setting.list("-created_date", 10);
      if (list.length > 0) {
        const s = list[0];
        setSettingId(s.id);
        setForm({
          store_name: s.store_name || "",
          address: s.address || "",
          cnpj: formatCnpj(s.cnpj || ""),
          phone: formatPhone(s.phone || ""),
          email: s.email || "",
          logo_url: s.logo_url || "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } =
      await db.integrations.Core.UploadFile({
        file,
        category: "settings",
      });
      setForm(prev => ({ ...prev, logo_url: file_url }));
      toast({ title: "Logo enviado!" });
    } catch {
      toast({ title: "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim()) {
      toast({ title: "Informe o nome da loja", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (settingId) {
        await db.entities.Setting.update(settingId, form);
      } else {
        const created = await db.entities.Setting.create(form);
        setSettingId(created.id);
      }
      window.dispatchEvent(new CustomEvent("settings-updated", { detail: form }));
      toast({ title: "Configurações salvas!" });
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Informações da loja exibidas nas ordens de serviço" />

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border p-6 space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold">Dados da Loja</h2>
          </div>

          <div>
            <Label>Nome da Loja *</Label>
            <Input value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })} placeholder="Ex: Gotelip Assistência" />
          </div>

          <div>
            <Label>Endereço</Label>
            <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade — CEP" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: formatCnpj(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" inputMode="tel" />
            </div>
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contato@...com" />
          </div>

          <div>
            <Label>Logo da Loja</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{uploading ? "Enviando..." : "Enviar logo"}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" disabled={uploading} />
              </label>
              {form.logo_url && (
                <div className="flex items-center gap-3">
                  <img src={form.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded-lg border" />
                  <button type="button" onClick={() => setForm({ ...form, logo_url: "" })} className="text-xs text-red-500 hover:underline">Remover</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}