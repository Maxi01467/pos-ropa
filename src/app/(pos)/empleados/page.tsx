"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionRole } from "@/lib/core/permissions";
import {
    createEmployee,
    deleteEmployee,
    getEmployees,
    setEmployeeStatus,
    updateEmployee,
} from "@/app/actions/employees/employee-actions";
import { useSessionSnapshot } from "@/lib/session/session-client";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import {
    Users,
    UserPlus,
    Pencil,
    Trash2,
    UserCheck,
    UserX,
    Loader2,
    ShieldAlert,
    KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type Employee = {
    id: string;
    name: string;
    pin: string;
    role: SessionRole;
    active: boolean;
    createdAt: string;
};

type EmployeeFormState = {
    name: string;
    pin: string;
    role: SessionRole;
};

const EMPTY_FORM: EmployeeFormState = {
    name: "",
    pin: "",
    role: "STAFF",
};

function formatDate(date: string) {
    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(date));
}

function sortEmployees(items: Employee[]) {
    return [...items].sort((left, right) => {
        if (left.active !== right.active) {
            return Number(right.active) - Number(left.active);
        }

        return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    });
}

export default function EmpleadosPage() {
    const { role } = useSessionSnapshot();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [form, setForm] = useState<EmployeeFormState>(EMPTY_FORM);
    const [employeePendingDelete, setEmployeePendingDelete] = useState<Employee | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

    const loadEmployees = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getEmployees();
            setEmployees(data);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo cargar el personal";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadEmployees();
    }, [loadEmployees]);

    useDataRefresh(CACHE_TAGS.employees, loadEmployees);

    const openCreateDialog = () => {
        setEditingEmployee(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEditDialog = (employee: Employee) => {
        setEditingEmployee(employee);
        setForm({
            name: employee.name,
            pin: employee.pin,
            role: employee.role,
        });
        setDialogOpen(true);
    };

    const handleSaveEmployee = async () => {
        if (!form.name.trim() || !form.pin.trim()) {
            return toast.error("Completá nombre y contraseña");
        }

        setIsSaving(true);
        try {
            if (editingEmployee) {
                const updatedEmployee = await updateEmployee(editingEmployee.id, form);
                setEmployees((current) =>
                    sortEmployees(
                        current.map((employee) =>
                            employee.id === updatedEmployee.id ? updatedEmployee : employee
                        )
                    )
                );
                toast.success("Empleado actualizado");
            } else {
                const createdEmployee = await createEmployee(form);
                setEmployees((current) => sortEmployees([...current, createdEmployee]));
                toast.success("Empleado creado");
            }

            setDialogOpen(false);
            setEditingEmployee(null);
            setForm(EMPTY_FORM);
            notifyDataUpdated([
                CACHE_TAGS.employees,
                CACHE_TAGS.posSellers,
                CACHE_TAGS.attendance,
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo guardar el empleado";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (employee: Employee) => {
        setStatusUpdatingId(employee.id);
        try {
            const updatedEmployee = await setEmployeeStatus(employee.id, !employee.active);
            setEmployees((current) =>
                sortEmployees(
                    current.map((currentEmployee) =>
                        currentEmployee.id === updatedEmployee.id ? updatedEmployee : currentEmployee
                    )
                )
            );
            toast.success(employee.active ? "Empleado desactivado" : "Empleado reactivado");
            notifyDataUpdated([
                CACHE_TAGS.employees,
                CACHE_TAGS.posSellers,
                CACHE_TAGS.attendance,
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo actualizar el estado";
            toast.error(message);
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const handleDeleteEmployee = async () => {
        if (!employeePendingDelete) return;

        setIsDeleting(true);
        try {
            await deleteEmployee(employeePendingDelete.id);
            setEmployees((current) =>
                current.filter((employee) => employee.id !== employeePendingDelete.id)
            );
            toast.success("Empleado eliminado");
            setEmployeePendingDelete(null);
            notifyDataUpdated([
                CACHE_TAGS.employees,
                CACHE_TAGS.posSellers,
                CACHE_TAGS.attendance,
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo eliminar el empleado";
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const activeEmployees = employees.filter((employee) => employee.active).length;
    const inactiveEmployees = employees.length - activeEmployees;

    if (role === "STAFF") {
        return (
            <div className="p-4 sm:p-5 lg:p-6">
                <Card className="mx-auto mt-12 max-w-xl border-orange-800/30 bg-[linear-gradient(135deg,rgba(234,88,12,0.12),rgba(194,65,12,0.05))]">
                    <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] text-orange-50">
                            <ShieldAlert className="size-7" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">Acceso restringido</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Solo los usuarios administradores pueden gestionar empleados.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-800/30 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(30,64,175,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-800 dark:text-blue-100">
                            <Users className="size-3.5" />
                            Personal
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Empleados
                        </h1>
                    </div>
                    <Button className="h-12 gap-2 bg-sky-700 hover:bg-sky-800" onClick={openCreateDialog}>
                        <UserPlus className="size-5" />
                        Nuevo empleado
                    </Button>
                </div>
            </div>

            <div className="mb-8 mt-5 grid gap-4 md:grid-cols-3">
                <Card className="rounded-[1.5rem] border-blue-800/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(30,64,175,0.04))] shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium uppercase tracking-wider text-blue-800 dark:text-blue-100">Total usuarios</p>
                        <p className="mt-2 text-4xl font-bold text-blue-950 dark:text-blue-100">{employees.length}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium uppercase tracking-wider text-emerald-800 dark:text-emerald-100">Administradores</p>
                        <p className="mt-2 text-4xl font-bold text-emerald-900 dark:text-emerald-100">
                            {employees.filter((employee) => employee.role === "ADMIN").length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-rose-900/20 bg-[linear-gradient(135deg,rgba(225,29,72,0.14),rgba(159,18,57,0.04))] shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-sm font-medium uppercase tracking-wider text-rose-800 dark:text-rose-100">Staff</p>
                        <p className="mt-2 text-4xl font-bold text-rose-900 dark:text-rose-100">
                            {employees.filter((employee) => employee.role === "STAFF").length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="mb-6 flex flex-wrap gap-3 text-sm">
                <Badge variant="outline" className="border-emerald-800/30 bg-emerald-950/8 text-emerald-800 dark:text-emerald-100">
                    Activos: {activeEmployees}
                </Badge>
                <Badge variant="outline" className="border-rose-900/25 bg-rose-950/8 text-rose-800 dark:text-rose-100">
                    Desactivados: {inactiveEmployees}
                </Badge>
            </div>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/92 shadow-sm">
                <CardHeader>
                    <CardTitle>Listado de empleados</CardTitle>
                    <CardDescription>
                        Los usuarios desactivados no pueden iniciar sesión y dejan de aparecer para ventas o caja.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex min-h-56 items-center justify-center">
                            <Loader2 className="size-8 animate-spin text-blue-700" />
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                            Todavía no hay empleados cargados.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Contraseña</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Creado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell>
                                            <div className="font-semibold">{employee.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    employee.role === "ADMIN"
                                                        ? "border-blue-800/25 bg-blue-950/8 text-blue-800 dark:text-blue-100"
                                                        : "border-slate-200 bg-slate-50 text-slate-700"
                                                }
                                            >
                                                {employee.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 font-mono">
                                                <KeyRound className="size-4 text-muted-foreground" />
                                                {employee.pin}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    employee.active
                                                        ? "border-emerald-800/25 bg-emerald-950/8 text-emerald-800 dark:text-emerald-100"
                                                        : "border-rose-900/25 bg-rose-950/8 text-rose-800 dark:text-rose-100"
                                                }
                                            >
                                                {employee.active ? "Activo" : "Desactivado"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(employee.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => openEditDialog(employee)}
                                                >
                                                    <Pencil className="size-4" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => handleToggleStatus(employee)}
                                                    disabled={statusUpdatingId === employee.id}
                                                >
                                                    {statusUpdatingId === employee.id ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : employee.active ? (
                                                        <UserX className="size-4" />
                                                    ) : (
                                                        <UserCheck className="size-4" />
                                                    )}
                                                    {employee.active ? "Desactivar" : "Activar"}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2 border-rose-900/20 text-rose-700 hover:bg-rose-950/6 hover:text-rose-800"
                                                    onClick={() => setEmployeePendingDelete(employee)}
                                                >
                                                    <Trash2 className="size-4" />
                                                    Eliminar
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        setEditingEmployee(null);
                        setForm(EMPTY_FORM);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingEmployee ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
                        <DialogDescription>
                            Definí nombre, contraseña y el rol con el que este usuario va a entrar al sistema.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="employee-name">Nombre</Label>
                            <Input
                                id="employee-name"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                placeholder="Ej: Micaela"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="employee-pin">Contraseña</Label>
                            <Input
                                id="employee-pin"
                                value={form.pin}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, pin: event.target.value }))
                                }
                                placeholder="Ej: ropa2026"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol</Label>
                            <Select
                                value={form.role}
                                onValueChange={(value: SessionRole) =>
                                    setForm((current) => ({ ...current, role: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="STAFF">Staff</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button className="bg-sky-700 hover:bg-sky-800" onClick={handleSaveEmployee} disabled={isSaving}>
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                            {editingEmployee ? "Guardar cambios" : "Crear empleado"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(employeePendingDelete)}
                onOpenChange={(open) => !open && setEmployeePendingDelete(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar empleado</DialogTitle>
                        <DialogDescription>
                            Esta acción borra el usuario del sistema. Si solo querés bloquear su acceso, conviene desactivarlo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-rose-900/20 bg-rose-950/8 p-4 text-sm text-rose-900 dark:text-rose-100">
                        Se eliminará a <span className="font-semibold">{employeePendingDelete?.name}</span>.
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmployeePendingDelete(null)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-rose-700 hover:bg-rose-800"
                            onClick={handleDeleteEmployee}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
