import db from "@/api/databaseClient";

import React, { useState, useEffect, useMemo } from "react";

import PageHeader from "@/components/shared/PageHeader";
import CurrencyDisplay from "@/components/shared/CurrencyDisplay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Users, Smartphone } from "lucide-react";
import moment from "moment/min/moment-with-locales";

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(moment().format("YYYY-MM"));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [o, t] = await Promise.all([
        db.entities.ServiceOrder.list("-created_date", 500),
        db.entities.Transaction.list("-date", 500),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setTransactions(Array.isArray(t) ? t : []);
      setLoading(false);
    };
    load();
  }, []);

  const [y, m] = selectedMonth.split("-").map(Number);

  const monthOrders = useMemo(() => {
    return orders.filter(o => {
      const d = o.entry_date || o.created_date;
      return d && moment(d).year() === y && moment(d).month() === m - 1;
    });
  }, [orders, y, m]);

  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date && moment(t.date).year() === y && moment(t.date).month() === m - 1);
  }, [transactions, y, m]);

  const stats = useMemo(() => {
    const totalReceived = monthOrders.reduce((s, o) => s + Number(o.amount_received || 0), 0);
    const totalSpent = monthOrders.reduce((s, o) => s + Number(o.amount_spent || 0), 0);
    const totalFees = monthOrders.reduce((s, o) => s + Number(o.fee_amount || 0), 0);
    const totalProfit = totalReceived - totalSpent - totalFees;
    const txEntries = monthTransactions.filter(t => t.type === "Entrada").reduce((s, t) => s + Number(t.amount || 0), 0);
    const txExits = monthTransactions.filter(t => t.type === "Saída").reduce((s, t) => s + Number(t.amount || 0), 0);
    return { totalReceived, totalSpent, totalFees, totalProfit, txEntries, txExits, orderCount: monthOrders.length };
  }, [monthOrders, monthTransactions]);

  const dailyChart = useMemo(() => {
    const daysInMonth = moment(selectedMonth, "YYYY-MM").daysInMonth();
    const days = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = { day: d, entradas: 0, saidas: 0, lucro: 0 };
    monthOrders.forEach(o => {
      const d = moment(o.entry_date || o.created_date).date();
      if (days[d]) {
        days[d].entradas += Number(o.amount_received || 0);
        days[d].saidas += Number(o.amount_spent || 0) + Number(o.fee_amount || 0);
        days[d].lucro += Number(o.amount_received || 0) - Number(o.amount_spent || 0) - Number(o.fee_amount || 0);
      }
    });
    return Object.values(days);
  }, [monthOrders, selectedMonth]);

  const clientRanking = useMemo(() => {
    const map = {};
    monthOrders.forEach(o => {
      if (!map[o.client_name]) map[o.client_name] = { name: o.client_name, revenue: 0, profit: 0, count: 0 };
      map[o.client_name].revenue += Number(o.amount_received || 0);
      map[o.client_name].profit += Number(o.profit || 0);
      map[o.client_name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [monthOrders]);

  const deviceRanking = useMemo(() => {
    const map = {};
    monthOrders.forEach(o => {
      const device = o.device_name || "Desconhecido";
      if (!map[device]) map[device] = { name: device, count: 0, revenue: 0 };
      map[device].count += 1;
      map[device].revenue += Number(o.amount_received || 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [monthOrders]);

  const sixMonthTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => moment().subtract(5 - index, "months")).map((month) => {
      const periodOrders = orders.filter((order) => {
        const date = order.entry_date || order.created_date;
        return date && moment(date).format("YYYY-MM") === month.format("YYYY-MM");
      });
      const revenue = periodOrders.reduce((sum, order) => sum + Number(order.amount_received || 0), 0);
      const costs = periodOrders.reduce((sum, order) => sum + Number(order.amount_spent || 0) + Number(order.fee_amount || 0), 0);
      return { month: month.format("MMM/YY"), faturamento: revenue, custos: costs, lucro: revenue - costs };
    });
  }, [orders]);

  const statusDistribution = useMemo(() => {
    const counts = {};
    monthOrders.forEach((order) => { counts[order.status || "Sem status"] = (counts[order.status || "Sem status"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [monthOrders]);

  const categorySummary = useMemo(() => {
    const values = {};
    monthTransactions.forEach((transaction) => {
      const key = transaction.category || "Outro";
      if (!values[key]) values[key] = { name: key, entradas: 0, saidas: 0 };
      if (transaction.type === "Entrada") values[key].entradas += Number(transaction.amount || 0);
      else values[key].saidas += Number(transaction.amount || 0);
    });
    return Object.values(values).sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));
  }, [monthTransactions]);

  const exportCSV = () => {
    const header = "OS,Cliente,Dispositivo,Problema,Status,Entrada,Conclusão,Recebido,Gasto,Taxa,Lucro\n";
    const rows = monthOrders.map(o =>
      `"${o.os_number || ""}","${o.client_name}","${o.device_name}","${o.problem_type}","${o.status}","${o.entry_date || ""}","${o.completion_date || ""}",${o.amount_received || 0},${o.amount_spent || 0},${o.fee_amount || 0},${o.profit || 0}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <PageHeader title="Relatórios" subtitle="Análise detalhada por período">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Entradas (OS)", value: stats.totalReceived, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Gastos (OS)", value: stats.totalSpent, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
          { label: "Taxas (OS)", value: stats.totalFees, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Lucro Líquido (OS)", value: stats.totalProfit, icon: TrendingUp, color: stats.totalProfit >= 0 ? "text-emerald-600" : "text-red-600", bg: stats.totalProfit >= 0 ? "bg-emerald-50" : "bg-red-50" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className={`text-xl font-bold ${card.color}`}><CurrencyDisplay value={card.value} /></p>
            </div>
          );
        })}
      </div>

      {/* Daily Chart */}
      <div className="bg-card rounded-xl border p-6 mb-8">
        <h3 className="text-sm font-semibold mb-4">Lucro Diário</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
            <Tooltip
              formatter={(value) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value), "Lucro"]}
              labelFormatter={l => `Dia ${l}`}
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
            />
            <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
              {dailyChart.map((entry, i) => (
                <Cell key={i} fill={entry.lucro >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Lucro e Gastos dos últimos 6 meses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sixMonthTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `R$${Math.round(value / 1000)}k`} />
              <Tooltip
                formatter={(value, name) => [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value),
                  name,
                ]}
              />
              <Legend />
              <Bar dataKey="lucro" name="Lucro" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="custos" name="Gastos" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Distribuição das OS por status</h3>
          {statusDistribution.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {statusDistribution.map((_, index) => <Cell key={index} fill={`hsl(${(index * 57) % 360} 65% 52%)`} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="py-24 text-center text-sm text-muted-foreground">Sem dados no período</p>}
        </div>
      </div>

      {!!categorySummary.length && (
        <div className="mb-8 rounded-xl border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Entradas e saídas por categoria</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categorySummary}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)} />
              <Legend />
              <Bar dataKey="entradas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Ranking */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Ranking de Clientes</h3>
          </div>
          {clientRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
          ) : (
            <div className="space-y-3">
              {clientRanking.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.count} atendimento{c.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold"><CurrencyDisplay value={c.revenue} /></p>
                    <p className="text-xs"><CurrencyDisplay value={c.profit} showSign /></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device Ranking */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Ranking de Dispositivos</h3>
          </div>
          {deviceRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
          ) : (
            <div className="space-y-3">
              {deviceRanking.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <p className="text-sm font-medium truncate">{d.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{d.count}x</p>
                    <p className="text-xs text-muted-foreground"><CurrencyDisplay value={d.revenue} /></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}