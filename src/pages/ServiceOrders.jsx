import db from "@/api/databaseClient";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CurrencyDisplay from "@/components/shared/CurrencyDisplay";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import OrderFormDialog from "@/components/orders/OrderFormDialog";
import NotifyClientDialog from "@/components/orders/NotifyClientDialog";
import OSDocumentDialog from "@/components/orders/OSDocumentDialog";
import ReceiptDialog from "@/components/orders/ReceiptDialog";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import AttachInvoiceDialog from "@/components/invoices/AttachInvoiceDialog";
import { exportToCSV } from "@/utils/exportCSV";
import ImportCSVButton from "@/components/shared/ImportCSVButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Bell, Wrench, CheckCircle, FileText, Paperclip, Receipt, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const statuses = ["Todos", "Em análise", "Aguardando peça", "Em conserto", "Pronto", "Entregue", "Cancelado"];

export default function ServiceOrders() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyOrder, setNotifyOrder] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [osDocOpen, setOsDocOpen] = useState(false);
  const [osDocOrder, setOsDocOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoicePrefillOrder, setInvoicePrefillOrder] = useState(null);
  const [attachInvoiceOpen, setAttachInvoiceOpen] = useState(false);
  const [attachInvoiceOrder, setAttachInvoiceOrder] = useState(null);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) setStatusFilter(statusParam);
    loadData();
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        db.entities.ServiceOrder.list("-created_date", 500),
        db.entities.Client.list("-created_date", 500),
      ]);
      setOrders(o);
      setClients(c);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchStatus = statusFilter === "Todos" || o.status === statusFilter;
      const matchSearch = !search ||
        (o.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.device_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.os_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.problem_type || "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [orders, statusFilter, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await db.entities.ServiceOrder.delete(deleteTarget.id);
    toast({ title: "Ordem de serviço excluída" });
    setDeleteOpen(false);
    setDeleteTarget(null);
    loadData();
  };

  const handleMarkReady = async (order) => {
    setUpdatingId(order.id);
    try {
      await db.entities.ServiceOrder.update(order.id, { status: "Pronto", completion_date: moment().format("YYYY-MM-DD") });
      toast({ title: "Marcado como pronto!" });
      await loadData();
    } catch {
      toast({ title: "Erro ao atualizar OS", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkDelivered = async (order) => {
    setUpdatingId(order.id);
    try {
      await db.entities.ServiceOrder.update(order.id, { status: "Entregue", delivered_date: moment().format("YYYY-MM-DD") });
      toast({ title: "Marcado como entregue!" });
      await loadData();
    } catch {
      toast({ title: "Erro ao atualizar OS", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast({ title: "Nenhuma OS para exportar", variant: "destructive" });
      return;
    }
    exportToCSV(filtered, [
      { key: "os_number", label: "OS" },
      { key: "client_name", label: "Cliente" },
      { key: "client_phone", label: "Telefone" },
      { key: "device_name", label: "Dispositivo" },
      { key: "problem_type", label: "Problema" },
      { key: "status", label: "Status" },
      { key: "entry_date", label: "Entrada", format: v => v ? moment(v).format("DD/MM/YYYY") : "" },
      { key: "delivered_date", label: "Entrega", format: v => v ? moment(v).format("DD/MM/YYYY") : "" },
      { key: "amount_received", label: "Recebido" },
      { key: "amount_spent", label: "Gasto" },
      { key: "fee_amount", label: "Taxa" },
      { key: "profit", label: "Lucro" },
    ], `ordens-servico-${moment().format("DD-MM-YYYY")}`);
    toast({ title: "OS exportadas em CSV!" });
  };

  const importColumns = [
    { label: "OS", key: "os_number" },
    { label: "Cliente", key: "client_name", required: true },
    { label: "Telefone", key: "client_phone" },
    { label: "Dispositivo", key: "device_name", required: true },
    { label: "Problema", key: "problem_type", required: true },
    { label: "Status", key: "status" },
    { label: "Entrada", key: "entry_date", required: true },
    { label: "Entrega", key: "delivered_date" },
    { label: "Recebido", key: "amount_received", parse: v => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0 },
    { label: "Gasto", key: "amount_spent", parse: v => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0 },
    { label: "Taxa", key: "fee_amount", parse: v => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0 },
  ];

  const handleImport = async (records) => {
    const enriched = records.map(r => {
      const matched = clients.find(c =>
        r.client_phone && c.phone &&
        c.phone.replace(/\D/g, "") === r.client_phone.replace(/\D/g, "")
      );
      const profit = (r.amount_received || 0) - (r.amount_spent || 0) - (r.fee_amount || 0);
      return {
        status: "Em análise",
        ...r,
        client_id: matched?.id || "",
        profit,
      };
    });
    await db.entities.ServiceOrder.bulkCreate(enriched);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Atendimentos" subtitle={`${orders.length} ordens de serviço`}>
        <ImportCSVButton columns={importColumns} onImport={handleImport} />
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
        <Button onClick={() => { setEditOrder(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova OS
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, dispositivo, OS ou problema..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhum atendimento encontrado" description="Crie uma nova ordem de serviço para começar.">
          <Button onClick={() => { setEditOrder(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova OS
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">OS</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Dispositivo</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Entrada</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Recebido</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Lucro</th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Assinatura</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{order.os_number || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">{order.client_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.device_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.entry_date ? moment(order.entry_date).format("DD/MM/YY") : "—"}</td>
                    <td className="px-4 py-3 text-sm text-right"><CurrencyDisplay value={order.amount_received} /></td>
                    <td className="px-4 py-3 text-sm text-right font-medium"><CurrencyDisplay value={order.profit} showSign /></td>
                    <td className="px-4 py-3 text-center">
                      {order.os_signed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Assinada
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setOsDocOrder(order); setOsDocOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors disabled:opacity-40" title="Documento da OS">
                          <FileText className="w-4 h-4" />
                        </button>
                        {order.status === "Entregue" && (
                          <button onClick={() => { setReceiptOrder(order); setReceiptOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-40" title="Recibo de pagamento">
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setAttachInvoiceOrder(order); setAttachInvoiceOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-40" title="Anexar nota fiscal">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        {order.status === "Pronto" && (
                          <>
                            <button onClick={() => { setNotifyOrder(order); setNotifyOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-40" title="Avisar cliente">
                              <Bell className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleMarkDelivered(order)} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors disabled:opacity-40" title="Marcar como entregue">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {["Em análise", "Aguardando peça", "Em conserto"].includes(order.status) && (
                          <button onClick={() => handleMarkReady(order)} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-40" title="Marcar como pronto">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setEditOrder(order); setFormOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-40" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setDeleteTarget(order); setDeleteOpen(true); }} disabled={updatingId === order.id} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-40" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={editOrder} clients={clients} onSaved={loadData} />
      <NotifyClientDialog open={notifyOpen} onOpenChange={setNotifyOpen} order={notifyOrder} onNotified={loadData} />
      <OSDocumentDialog open={osDocOpen} onOpenChange={setOsDocOpen} order={osDocOrder} onSaved={loadData} onDelete={loadData} />
      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} order={receiptOrder} />
      <InvoiceFormDialog open={invoiceOpen} onOpenChange={(v) => { setInvoiceOpen(v); if (!v) setInvoicePrefillOrder(null); }} invoice={null} orders={orders} prefillOrder={invoicePrefillOrder} onSaved={loadData} />
      <AttachInvoiceDialog
        open={attachInvoiceOpen}
        onOpenChange={(value) => {
          setAttachInvoiceOpen(value);
          if (!value) setAttachInvoiceOrder(null);
        }}
        order={attachInvoiceOrder}
        onAttached={loadData}
        onCreateNew={(order) => {
          setInvoicePrefillOrder(order);
          setInvoiceOpen(true);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Ordem de Serviço"
        description={`Tem certeza que deseja excluir a OS ${deleteTarget?.os_number || ""} de ${deleteTarget?.client_name || ""}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmText="Excluir"
        destructive
      />
    </div>
  );
}