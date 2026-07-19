import db from "@/api/databaseClient";
import { deleteWithUndo } from "@/lib/undoDelete";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import CurrencyDisplay from "@/components/shared/CurrencyDisplay";
import TransactionFormDialog from "@/components/transactions/TransactionFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, DollarSign, Pencil, Trash2, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { exportToCSV } from "@/utils/exportCSV";
import ImportCSVButton from "@/components/shared/ImportCSVButton";
import moment from "moment/min/moment-with-locales";

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export default function Finances() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [selectedMonth, setSelectedMonth] = useState(moment().format("YYYY-MM"));
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const query = searchParams.get("search");
    if (query) setSearch(query);
    loadData();
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    const t = await db.entities.Transaction.list("-date", 500);
    setTransactions(t);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const [y, m] = selectedMonth.split("-");
    return transactions.filter(t => {
      const matchMonth = t.date && moment(t.date).year() === parseInt(y) && moment(t.date).month() === parseInt(m) - 1;
      const matchType = typeFilter === "Todos" || t.type === typeFilter;
      const matchCategory = categoryFilter === "Todos" || t.category === categoryFilter;
      const matchSearch = !search || (t.description || "").toLowerCase().includes(search.toLowerCase()) || (t.client_name || "").toLowerCase().includes(search.toLowerCase());
      return matchMonth && matchType && matchCategory && matchSearch;
    });
  }, [transactions, selectedMonth, typeFilter, categoryFilter, search]);

  const summary = useMemo(() => {
    const entries = filtered.filter(t => t.type === "Entrada").reduce((s, t) => s + (t.amount || 0), 0);
    const exits = filtered.filter(t => t.type === "Saída").reduce((s, t) => s + (t.amount || 0), 0);
    return { entries, exits, balance: entries - exits };
  }, [filtered]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo({ entity: db.entities.Transaction, record: deleteTarget, toast, onChanged: loadData, label: "Transação excluída" });
    setDeleteOpen(false);
    setDeleteTarget(null);
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast({ title: "Nenhuma transação para exportar", variant: "destructive" });
      return;
    }
    exportToCSV(filtered, [
      { key: "date", label: "Data", format: v => v ? moment(v).format("DD/MM/YYYY") : "" },
      { key: "type", label: "Tipo" },
      { key: "category", label: "Categoria" },
      { key: "description", label: "Descrição" },
      { key: "client_name", label: "Cliente" },
      { key: "amount", label: "Valor" },
    ], `financas-${moment().format("DD-MM-YYYY")}`);
    toast({ title: "Transações exportadas em CSV!" });
  };

  const importColumns = [
    { label: "Data", key: "date", required: true },
    { label: "Tipo", key: "type", required: true },
    { label: "Categoria", key: "category", required: true },
    { label: "Descrição", key: "description" },
    { label: "Cliente", key: "client_name" },
    { label: "Valor", key: "amount", required: true, parse: v => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0 },
  ];

  const handleImport = async (records) => {
    await db.entities.Transaction.bulkCreate(records);
    await loadData();
  };

  const monthOptions = useMemo(() => {
  const opts = [];

  for (let i = 0; i < 12; i++) {
    const m = moment().locale("pt-br").subtract(i, "months");

    opts.push({
      value: m.format("YYYY-MM"),
      label: capitalize(m.format("MMMM [de] YYYY")),
    });
  }

  return opts;
}, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <PageHeader title="Finanças" subtitle="Controle de entradas e saídas">
        <ImportCSVButton columns={importColumns} onImport={handleImport} />
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
        <Button onClick={() => { setEditTransaction(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Transação
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground font-medium">Entradas</span>
          </div>
          <p className="text-xl font-bold text-emerald-600"><CurrencyDisplay value={summary.entries} /></p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-muted-foreground font-medium">Saídas</span>
          </div>
          <p className="text-xl font-bold text-red-600"><CurrencyDisplay value={summary.exits} /></p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-muted-foreground font-medium">Saldo</span>
          </div>
          <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            <CurrencyDisplay value={summary.balance} />
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os tipos</SelectItem>
            <SelectItem value="Entrada">Entrada</SelectItem>
            <SelectItem value="Saída">Saída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todas categorias</SelectItem>
            <SelectItem value="Serviço">Serviço</SelectItem>
            <SelectItem value="Peça">Peça</SelectItem>
            <SelectItem value="Taxa">Taxa</SelectItem>
            <SelectItem value="Outro">Outro</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title="Nenhuma transação encontrada" description="Registre transações para acompanhar seu fluxo de caixa.">
          <Button onClick={() => { setEditTransaction(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Transação
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Data</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Categoria</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Descrição</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Cliente</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Valor</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-sm">{moment(t.date).format("DD/MM/YY")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.type === "Entrada" ? "text-emerald-600" : "text-red-600"}`}>
                      {t.type === "Entrada" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.category}</td>
                  <td className="px-4 py-3 text-sm">{t.description || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.client_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    <span className={t.type === "Entrada" ? "text-emerald-600" : "text-red-600"}>
                      {t.type === "Saída" ? "-" : ""}<CurrencyDisplay value={t.amount} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditTransaction(t); setFormOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setDeleteTarget(t); setDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TransactionFormDialog open={formOpen} onOpenChange={setFormOpen} transaction={editTransaction} onSaved={loadData} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Excluir Transação" description="Tem certeza que deseja excluir esta transação?" onConfirm={handleDelete} confirmText="Excluir" destructive />
    </div>
  );
}