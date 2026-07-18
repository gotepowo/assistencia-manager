import db from "@/api/databaseClient";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

export default function AttachInvoiceDialog({ open, onOpenChange, order, onAttached, onCreateNew }) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    const loadInvoices = async () => {
      setLoading(true);
      try {
        const allInvoices = await db.entities.Invoice.list("-date", 500);
        setInvoices(allInvoices);
      } catch {
        toast({ title: "Erro ao carregar notas fiscais", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    setSearch("");
    loadInvoices();
  }, [open, toast]);

  const availableInvoices = useMemo(() => {
    if (!order) return [];

    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const isUnlinked = !invoice.service_order_id;
      const belongsToClient =
        (order.client_id && invoice.client_id === order.client_id) ||
        (!invoice.client_id &&
          invoice.client_name &&
          order.client_name &&
          invoice.client_name.trim().toLowerCase() === order.client_name.trim().toLowerCase());

      const matchesSearch = !query || [
        invoice.invoice_number,
        invoice.issuer_name,
        invoice.recipient_name,
        invoice.description,
      ].some((value) => String(value || "").toLowerCase().includes(query));

      return isUnlinked && belongsToClient && matchesSearch;
    });
  }, [invoices, order, search]);

  const handleAttach = async (invoice) => {
    if (!order?.id) return;

    setAttachingId(invoice.id);
    try {
      await db.entities.Invoice.update(invoice.id, {
        service_order_id: order.id,
        service_order_number: order.os_number || "",
        client_id: order.client_id || invoice.client_id || "",
        client_name: order.client_name || invoice.client_name || "",
      });

      toast({ title: "Nota fiscal vinculada à OS!" });
      onAttached?.();
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao vincular nota fiscal", variant: "destructive" });
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vincular nota fiscal à {order?.os_number || "OS"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nota fiscal..."
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              onOpenChange(false);
              onCreateNew?.(order);
            }}
          >
            <Plus className="w-4 h-4" /> Criar nova nota
          </Button>
        </div>

        <div className="overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando notas...
            </div>
          ) : availableInvoices.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">Nenhuma nota disponível</p>
              <p className="text-sm text-muted-foreground mt-1">
                Só aparecem notas deste cliente que ainda não estejam vinculadas a outra OS.
              </p>
            </div>
          ) : (
            availableInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-4 border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {invoice.invoice_number || "Nota sem número"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {invoice.date ? moment(invoice.date).format("DD/MM/YYYY") : "Sem data"}
                    {invoice.description ? ` • ${invoice.description}` : ""}
                  </p>
                  <p className="text-sm font-medium mt-1">{formatCurrency(invoice.amount)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={attachingId === invoice.id}
                  onClick={() => handleAttach(invoice)}
                >
                  {attachingId === invoice.id ? "Vinculando..." : "Vincular"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
