"use client";

import { useState } from "react";
import {
    Plus,
    Truck,
    Phone,
    StickyNote,
    Pencil,
    Trash2,
    Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { mockProviders, type Provider } from "@/lib/mock-data";
import { toast } from "sonner";

export default function ProveedoresPage() {
    const [providers, setProviders] = useState<Provider[]>(mockProviders);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const [formName, setFormName] = useState("");
    const [formPhone, setFormPhone] = useState("");
    const [formNotes, setFormNotes] = useState("");

    const resetForm = () => {
        setFormName("");
        setFormPhone("");
        setFormNotes("");
        setEditingProvider(null);
    };

    const handleOpenNew = () => {
        resetForm();
        setDialogOpen(true);
    };

    const handleOpenEdit = (provider: Provider) => {
        setEditingProvider(provider);
        setFormName(provider.name);
        setFormPhone(provider.phone);
        setFormNotes(provider.notes);
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!formName.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }

        if (editingProvider) {
            setProviders((prev) =>
                prev.map((p) =>
                    p.id === editingProvider.id
                        ? { ...p, name: formName.trim(), phone: formPhone.trim(), notes: formNotes.trim() }
                        : p
                )
            );
            toast.success("Proveedor actualizado", {
                description: formName.trim(),
            });
        } else {
            const newProvider: Provider = {
                id: `prov-${Date.now()}`,
                name: formName.trim(),
                phone: formPhone.trim(),
                notes: formNotes.trim(),
            };
            setProviders((prev) => [newProvider, ...prev]);
            toast.success("Proveedor creado", {
                description: formName.trim(),
            });
        }

        setDialogOpen(false);
        resetForm();
    };

    const handleDelete = (provider: Provider) => {
        setProviders((prev) => prev.filter((p) => p.id !== provider.id));
        toast.success("Proveedor eliminado", {
            description: provider.name,
        });
    };

    const filteredProviders = providers.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Proveedores
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Gestioná tus proveedores y contactos
                    </p>
                </div>
                <Button
                    size="lg"
                    className="gap-2 h-12 text-base font-semibold"
                    onClick={handleOpenNew}
                >
                    <Plus className="size-5" />
                    Nuevo Proveedor
                </Button>
            </div>

            {/* Search */}
            {providers.length > 0 && (
                <div className="relative mb-6 max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar proveedor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-10"
                    />
                </div>
            )}

            {/* Providers Grid */}
            {filteredProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
                    <Truck className="mb-4 size-16 text-muted-foreground/30" />
                    <p className="text-xl font-medium text-muted-foreground">
                        {searchQuery
                            ? "No se encontraron proveedores"
                            : "Sin proveedores aún"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground/70">
                        {searchQuery
                            ? "Probá con otro nombre"
                            : "Agregá tu primer proveedor para empezar"}
                    </p>
                    {!searchQuery && (
                        <Button
                            size="lg"
                            className="mt-6 gap-2"
                            onClick={handleOpenNew}
                        >
                            <Plus className="size-5" />
                            Nuevo Proveedor
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredProviders.map((provider) => (
                        <Card
                            key={provider.id}
                            className="group transition-all duration-200 hover:shadow-md"
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Truck className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold">
                                                {provider.name}
                                            </h3>
                                            {provider.phone && (
                                                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Phone className="size-3" />
                                                    {provider.phone}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleOpenEdit(provider)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleDelete(provider)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {provider.notes && (
                                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                                        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {provider.notes}
                                        </p>
                                    </div>
                                )}

                                {!provider.phone && !provider.notes && (
                                    <Badge
                                        variant="outline"
                                        className="mt-3 text-xs text-muted-foreground"
                                    >
                                        Sin datos de contacto
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* New/Edit Provider Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            {editingProvider ? "Editar Proveedor" : "Nuevo Proveedor"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingProvider
                                ? "Modificá los datos de este proveedor."
                                : "Agregá un nuevo proveedor a tu lista."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="prov-name" className="text-base">
                                Nombre <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="prov-name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="h-12 text-lg"
                                placeholder="Ej: Textiles del Sur"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="prov-phone" className="text-base">
                                WhatsApp / Teléfono
                            </Label>
                            <Input
                                id="prov-phone"
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                                className="h-11"
                                placeholder="Ej: 1155443322"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="prov-notes" className="text-base">
                                Notas
                            </Label>
                            <Textarea
                                id="prov-notes"
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                className="min-h-[100px] text-sm"
                                placeholder="Días de visita, políticas de cambio, condiciones de pago..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="lg"
                            className="flex-1"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="lg"
                            className="flex-1 bg-emerald-600 font-bold hover:bg-emerald-700"
                            onClick={handleSave}
                            disabled={!formName.trim()}
                        >
                            {editingProvider ? "Guardar Cambios" : "Crear Proveedor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
