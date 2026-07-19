import db from "@/api/databaseClient";

import React, { useState, useEffect, useMemo } from "react";

import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CurrencyDisplay from "@/components/shared/CurrencyDisplay";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Wrench, AlertTriangle, Clock, ShieldCheck, ShieldAlert, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment/min/moment-with-locales";

const WARRANTY_DAYS = 90;

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(moment().format("YYYY-MM"));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o, t] = await Promise.all([
        db.entities.ServiceOrder.list("-created_date", 500),
        db.entities.Transaction.list("-date", 500),
      ]);
      setOrders(o);
      setTransactions(t);
    } finally {
      setLoading(false);
    }
  };

  const monthOrders = useMemo(() => {
    const [y, m] = selectedMonth.split("-");
    return orders.filter(o => {
      const d = o.entry_date || o.created_date;
      return d && moment(d).year() === parseInt(y) && moment(d).month() === parseInt(m) - 1;
    });
  }, [orders, selectedMonth]);

  const monthTransactions = useMemo(() => {
    const [y, m] = selectedMonth.split("-");
    return transactions.filter(t => {
      return t.date && moment(t.date).year() === parseInt(y) && moment(t.date).month() === parseInt(m) - 1;
    });
  }, [transactions, selectedMonth]);

  const deliveredOrders = useMemo(() => monthOrders.filter(o => o.status === "Entregue"), [monthOrders]);

  const stats = useMemo(() => {
    const orderReceived = deliveredOrders.reduce((sum, o) => sum + (o.amount_received || 0), 0);
    const orderSpent = deliveredOrders.reduce((sum, o) => sum + (o.amount_spent || 0), 0);
    const totalFees = deliveredOrders.reduce((sum, o) => sum + (o.fee_amount || 0), 0);
    const txnReceived = monthTransactions.filter(t => t.type === "Entrada").reduce((sum, t) => sum + (t.amount || 0), 0);
    const txnSpent = monthTransactions.filter(t => t.type === "Saída").reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalReceived = orderReceived + txnReceived;
    const totalSpent = orderSpent + txnSpent;
    const totalProfit = totalReceived - totalSpent - totalFees;
    const pending = orders.filter(o => o.status === "Pronto" && o.status !== "Entregue").length;
    const inProgress = orders.filter(o => ["Em análise", "Aguardando peça", "Em conserto"].includes(o.status)).length;
    return { totalReceived, totalSpent, totalFees, totalProfit, count: monthOrders.length, pending, inProgress };
  }, [deliveredOrders, monthTransactions, orders]);

  const chartData = useMemo(() => {
    const daysInMonth = moment(selectedMonth, "YYYY-MM").daysInMonth();
    const days = {};

    for (let d = 1; d <= daysInMonth; d++) {
      days[d] = { day: d, gastos: 0, lucro: 0 };
    }

    deliveredOrders.forEach((order) => {
      const day = moment(order.entry_date || order.created_date).date();
      if (!days[day]) return;

      const received = Number(order.amount_received || 0);
      const spent = Number(order.amount_spent || 0);
      const fees = Number(order.fee_amount || 0);
      const expenses = spent + fees;

      days[day].gastos += expenses;
      days[day].lucro += received - expenses;
    });

    monthTransactions.forEach((transaction) => {
      const day = moment(transaction.date).date();
      if (!days[day]) return;

      const amount = Number(transaction.amount || 0);
      if (transaction.type === "Entrada") {
        days[day].lucro += amount;
      } else if (transaction.type === "Saída") {
        days[day].gastos += amount;
        days[day].lucro -= amount;
      }
    });

    return Object.values(days);
  }, [deliveredOrders, monthTransactions, selectedMonth]);

  const recentOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)).slice(0, 5);
  }, [orders]);

  const readyOrders = useMemo(() => orders.filter(o => o.status === "Pronto"), [orders]);

  const warrantyOrders = useMemo(() => {
    const today = moment();
    return orders
      .filter(o => o.status === "Entregue" && o.delivered_date)
      .map(o => {
        const delivered = moment(o.delivered_date);
        const expiry = delivered.clone().add(WARRANTY_DAYS, "days");
        const daysLeft = expiry.diff(today, "days");
        return { ...o, deliveredDate: delivered, expiryDate: expiry, daysLeft };
      })
      .filter(o => o.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [orders]);

  const expiringWarranty = warrantyOrders.filter(o => o.daysLeft <= 15);
  const activeWarranty = warrantyOrders.filter(o => o.daysLeft > 15).slice(0, 5);

  const quickFilters = [
    { label: "Pronto p/ Entregar", status: "Pronto", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", count: orders.filter(o => o.status === "Pronto").length },
    { label: "Em Conserto", status: "Em conserto", icon: Wrench, color: "text-blue-600", bg: "bg-blue-50", count: orders.filter(o => o.status === "Em conserto").length },
    { label: "Aguardando Peça", status: "Aguardando peça", icon: Clock, color: "text-orange-600", bg: "bg-orange-50", count: orders.filter(o => o.status === "Aguardando peça").length },
    { label: "Em Análise", status: "Em análise", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50", count: orders.filter(o => o.status === "Em análise").length },
  ];

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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: "Entradas", value: stats.totalReceived, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Gastos", value: stats.totalSpent, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
    { label: "Taxas", value: stats.totalFees, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Lucro Líquido", value: stats.totalProfit, icon: TrendingUp, color: stats.totalProfit >= 0 ? "text-emerald-600" : "text-red-600", bg: stats.totalProfit >= 0 ? "bg-emerald-50" : "bg-red-50" },
    { label: "Atendimentos", value: stats.count, icon: Wrench, color: "text-blue-600", bg: "bg-blue-50", isCurrency: false },
    { label: "Pendentes", value: stats.inProgress, icon: Clock, color: "text-orange-600", bg: "bg-orange-50", isCurrency: false },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da sua assistência técnica">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {quickFilters.map(qf => {
          const Icon = qf.icon;
          return (
            <Link
              key={qf.label}
              to={`/atendimentos?status=${encodeURIComponent(qf.status)}`}
              className="flex items-center gap-2.5 bg-card border rounded-xl px-4 py-2.5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg ${qf.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${qf.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{qf.label}</p>
                <p className="text-sm font-bold">{qf.count}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${card.color}`}>
                {card.isCurrency === false ? card.value : (
                  <CurrencyDisplay value={card.value} />
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="xl:col-span-2 bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Lucro e Gastos por Dia</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                formatter={(value, name) => [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value),
                  name,
                ]}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              <Bar dataKey="lucro" name="Lucro" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts & Recent */}
        <div className="space-y-6">
          {/* Ready devices */}
          {readyOrders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">Aguardando Retirada</h3>
              </div>
              <div className="space-y-2">
                {readyOrders.slice(0, 5).map(o => (
                  <Link to="/atendimentos" key={o.id} className="flex items-center justify-between text-xs hover:bg-amber-100/50 rounded-lg px-2 py-1.5 transition-colors">
                    <span className="text-amber-800 font-medium">{o.client_name} — {o.device_name}</span>
                    {o.client_notified && <span className="text-amber-600 text-[10px]">Avisado</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Warranty Expiring */}
          {expiringWarranty.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-red-800">Garantia Vencendo</h3>
              </div>
              <div className="space-y-2">
                {expiringWarranty.slice(0, 4).map(o => (
                  <Link to="/atendimentos" key={o.id} className="flex items-center justify-between text-xs hover:bg-red-100/50 rounded-lg px-2 py-1.5 transition-colors">
                    <span className="text-red-800 font-medium truncate">{o.client_name} — {o.device_name}</span>
                    <span className="text-red-600 text-[10px] font-bold shrink-0 ml-2">{o.daysLeft === 0 ? "Hoje" : `${o.daysLeft}d`}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Active Warranty */}
          {activeWarranty.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-800">Garantia Ativa</h3>
              </div>
              <div className="space-y-2">
                {activeWarranty.map(o => (
                  <Link to="/atendimentos" key={o.id} className="flex items-center justify-between text-xs hover:bg-emerald-100/50 rounded-lg px-2 py-1.5 transition-colors">
                    <span className="text-emerald-800 font-medium truncate">{o.client_name} — {o.device_name}</span>
                    <span className="text-emerald-600 text-[10px] shrink-0 ml-2">{o.daysLeft}d restantes</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-card rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Últimos Atendimentos</h3>
            <div className="space-y-2.5">
              {recentOrders.map(o => (
                <Link to="/atendimentos" key={o.id} className="flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.device_name}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
              {recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento ainda</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}