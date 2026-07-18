import db from "@/api/databaseClient";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const statuses = ["Em análise", "Aguardando peça", "Em conserto", "Pronto", "Entregue", "Cancelado"];

export default function OrderFormDialog({ open, onOpenChange, order, clients, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("idle");
  const hydratedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const latestFormRef = useRef(null);

  const [form, setForm] = useState({
    client_id: "", client_name: "", client_phone: "",
    device_name: "", problem_type: "", service_description: "",
    entry_date: moment().format("YYYY-MM-DD"), completion_date: "",
    status: "Em análise",
    amount_received: 0, amount_spent: 0, fee_amount: 0,
    internal_notes: "",
  });

  useEffect(() => {
    hydratedRef.current = false;
    setAutosaveStatus("idle");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    if (order) {
      setForm({
        client_id: order.client_id || "",
        client_name: order.client_name || "",
        client_phone: order.client_phone || "",
        device_name: order.device_name || "",
        problem_type: order.problem_type || "",
        service_description: order.service_description || "",
        entry_date: order.entry_date || moment().format("YYYY-MM-DD"),
        completion_date: order.completion_date || "",
        status: order.status || "Em análise",
        amount_received: order.amount_received || 0,
        amount_spent: order.amount_spent || 0,
        fee_amount: order.fee_amount || 0,
        internal_notes: order.internal_notes || "",
      });
      setSearch(order.client_name || "");
    } else {
      setForm({
        client_id: "", client_name: "", client_phone: "",
        device_name: "", problem_type: "", service_description: "",
        entry_date: moment().format("YYYY-MM-DD"), completion_date: "",
        status: "Em análise",
        amount_received: 0, amount_spent: 0, fee_amount: 0,
        internal_notes: "",
      });
      setSearch("");
    }

    requestAnimationFrame(() => {
      hydratedRef.current = true;
    });
  }, [order, open]);

  const profit = (parseFloat(form.amount_received) || 0) - (parseFloat(form.amount_spent) || 0) - (parseFloat(form.fee_amount) || 0);

  const buildOrderData = (sourceForm) => {
    const data = {
      ...sourceForm,
      amount_received: parseFloat(sourceForm.amount_received) || 0,
      amount_spent: parseFloat(sourceForm.amount_spent) || 0,
      fee_amount: parseFloat(sourceForm.fee_amount) || 0,
    };
    data.profit = data.amount_received - data.amount_spent - data.fee_amount;

    if (data.status === "Entregue" && !data.delivered_date) {
      data.delivered_date = moment().format("YYYY-MM-DD");
    }

    return data;
  };

  latestFormRef.current = form;

  useEffect(() => {
    if (!open || !order?.id || !hydratedRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus("pending");

    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      try {
        await db.entities.ServiceOrder.update(order.id, buildOrderData(latestFormRef.current));
        setAutosaveStatus("saved");
      } catch {
        setAutosaveStatus("error");
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [form, open, order?.id]);

  const flushAutosave = async () => {
    if (!order?.id || !hydratedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus("saving");
    try {
      await db.entities.ServiceOrder.update(order.id, buildOrderData(latestFormRef.current));
      setAutosaveStatus("saved");
      onSaved();
    } catch {
      setAutosaveStatus("error");
      throw new Error("Autosave failed");
    }
  };

  const handleOpenChange = async (nextOpen) => {
    if (!nextOpen && order?.id) {
      try {
        await flushAutosave();
      } catch {
        toast({ title: "Não foi possível salvar as últimas alterações", variant: "destructive" });
        return;
      }
    }
    onOpenChange(nextOpen);
  };

  const filteredClients = useMemo(() => {
    if (!search) return clients || [];
    return (clients || []).filter(c =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    );
  }, [clients, search]);

  const selectClient = (c) => {
    setForm(prev => ({ ...prev, client_id: c.id, client_name: c.full_name, client_phone: c.phone }));
    setSearch(c.full_name);
    setShowDropdown(false);
  };

  const generateOSNumber = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `OS-${year}-${rand}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.device_name.trim() || !form.problem_type.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = buildOrderData(form);

      if (order?.id) {
        await db.entities.ServiceOrder.update(order.id, data);
        toast({ title: "Ordem de serviço atualizada!" });
      } else {
        data.os_number = generateOSNumber();
        await db.entities.ServiceOrder.create(data);
        toast({ title: "Ordem de serviço criada!" });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao salvar OS", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-6">
            <DialogTitle>{order?.id ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}</DialogTitle>
            {order?.id && (
              <span className={`text-xs ${autosaveStatus === "error" ? "text-red-600" : "text-muted-foreground"}`}>
                {autosaveStatus === "pending" && "Alterações pendentes…"}
                {autosaveStatus === "saving" && "Salvando…"}
                {autosaveStatus === "saved" && "Salvo automaticamente"}
                {autosaveStatus === "error" && "Erro ao salvar"}
              </span>
            )}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client Selection */}
          <div className="relative">
            <Label>Cliente *</Label>
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); setForm(prev => ({ ...prev, client_id: "", client_name: "", client_phone: "" })); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar cliente por nome ou telefone..."
            />
            {form.client_id && (
              <p className="text-xs text-emerald-600 mt-1">✓ {form.client_name} — {form.client_phone}</p>
            )}
            {showDropdown && !form.client_id && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                ) : (
                  filteredClients.slice(0, 8).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => selectClient(c)}
                    >
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground ml-2">{c.phone}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dispositivo *</Label>
              <Input value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} placeholder="Ex: iPhone 13, Galaxy S22..." />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Tipo de Problema *</Label>
            <Input value={form.problem_type} onChange={e => setForm({ ...form, problem_type: e.target.value })} placeholder="Ex: Tela quebrada, não liga, bateria..." />
          </div>

          <div>
            <Label>Descrição do Serviço</Label>
            <Textarea value={form.service_description} onChange={e => setForm({ ...form, service_description: e.target.value })} placeholder="Detalhe o que foi feito..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Entrada</Label>
              <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div>
              <Label>Data de Conclusão</Label>
              <Input type="date" value={form.completion_date} onChange={e => setForm({ ...form, completion_date: e.target.value })} />
            </div>
          </div>

          {/* Financial */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Valores</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor Recebido (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.amount_received} onChange={e => setForm({ ...form, amount_received: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor Gasto (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.amount_spent} onChange={e => setForm({ ...form, amount_spent: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Taxa / Comissão (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.fee_amount} onChange={e => setForm({ ...form, fee_amount: e.target.value })} />
              </div>
            </div>
            <div className={`text-right text-sm font-bold ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Lucro: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(profit)}
            </div>
          </div>

          <div>
            <Label>Observações Internas</Label>
            <Textarea value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} placeholder="Notas internas..." rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>{order?.id ? "Fechar" : "Cancelar"}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : order?.id ? "Atualizar" : "Criar OS"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}