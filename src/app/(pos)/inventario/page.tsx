"use client";

import { useState } from "react";
import { Package, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { mockCategories, mockProviders } from "@/lib/mock-data";
import { toast } from "sonner";

export default function InventarioPage() {
    const [name, setName] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [costPrice, setCostPrice] = useState("");
    const [category, setCategory] = useState("");
    const [providerId, setProviderId] = useState("");

    const salePriceNum = parseFloat(salePrice) || 0;
    const costPriceNum = parseFloat(costPrice) || 0;
    const margin =
        salePriceNum > 0 && costPriceNum > 0
            ? (((salePriceNum - costPriceNum) / costPriceNum) * 100).toFixed(0)
            : null;

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("El nombre de la prenda es obligatorio");
            return;
        }
        if (!salePrice || salePriceNum <= 0) {
            toast.error("Ingresá un precio de venta válido");
            return;
        }

        toast.success("Producto guardado", {
            description: `${name.trim()} — $${salePriceNum.toLocaleString("es-AR")}`,
        });

        // Reset form
        setName("");
        setSalePrice("");
        setCostPrice("");
        setCategory("");
        setProviderId("");
    };

    return (
        <div className="p-4 lg:p-8 max-w-2xl">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                    Nuevo Producto
                </h1>
                <p className="mt-1 text-muted-foreground">
                    Cargá una nueva prenda a tu inventario
                </p>
            </div>

            {/* Main Form Card */}
            <Card className="mb-6">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="size-5 text-primary" />
                        Datos de la Prenda
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="prod-name" className="text-base">
                            Nombre de la Prenda <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="prod-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-12 text-lg"
                            placeholder="Ej: Remera Lisa Algodón"
                            autoFocus
                        />
                    </div>

                    {/* Sale Price */}
                    <div className="space-y-2">
                        <Label htmlFor="prod-sale-price" className="text-base">
                            Precio de Venta <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="prod-sale-price"
                                type="number"
                                value={salePrice}
                                onChange={(e) => setSalePrice(e.target.value)}
                                className="h-12 pl-8 text-lg"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Cost Price */}
                    <div className="space-y-2">
                        <Label htmlFor="prod-cost-price" className="text-base">
                            Precio de Costo
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                                $
                            </span>
                            <Input
                                id="prod-cost-price"
                                type="number"
                                value={costPrice}
                                onChange={(e) => setCostPrice(e.target.value)}
                                className="h-12 pl-8 text-lg"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        {margin !== null && (
                            <p className="text-sm font-medium text-emerald-600">
                                Margen de ganancia: {margin}%
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label className="text-base">Categoría</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="h-11 text-base">
                                <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {mockCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-base">
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Provider */}
                    <div className="space-y-2">
                        <Label className="text-base">Proveedor</Label>
                        <Select value={providerId} onValueChange={setProviderId}>
                            <SelectTrigger className="h-11 text-base">
                                <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                            <SelectContent>
                                {mockProviders.map((prov) => (
                                    <SelectItem
                                        key={prov.id}
                                        value={prov.id}
                                        className="text-base"
                                    >
                                        {prov.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <Button
                size="lg"
                className="h-14 w-full bg-emerald-600 text-lg font-bold hover:bg-emerald-700 shadow-lg"
                onClick={handleSave}
                disabled={!name.trim() || !salePrice || salePriceNum <= 0}
            >
                <Save className="size-5" />
                Guardar Producto
            </Button>
        </div>
    );
}
