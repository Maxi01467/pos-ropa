"use client";

import { useCallback, useEffect, useState } from "react";
import {
    checkInUser,
    getAttendanceBoard,
    checkOutUser,
    getAttendanceDashboard,
    getAttendanceEmployees,
} from "@/app/actions/attendance-actions";
import {
    CalendarClock,
    Clock3,
    Loader2,
    LogIn,
    LogOut,
    Users,
    CircleDot,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
type AttendanceEmployee = {
    id: string;
    name: string;
    role: string;
};

type AttendanceShift = {
    id: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | null;
    notes: string | null;
};

type AttendanceDashboard = {
    user: {
        id: string;
        name: string;
        role: string;
    };
    activeShift: AttendanceShift | null;
    todayShifts: AttendanceShift[];
    todayWorkedHours: number;
};

type AttendanceBoard = {
    cashSession: {
        id: string;
        status: string;
        openingDate: string;
        closingDate: string | null;
    } | null;
    shifts: Array<{
        id: string;
        userId: string;
        userName: string;
        checkIn: string;
        checkOut: string | null;
        totalHours: number | null;
        status: "ACTIVE" | "FINISHED";
    }>;
};

function formatDateTime(date: string) {
    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}

function formatHours(hours: number) {
    return `${hours.toFixed(2)} h`;
}

export default function AsistenciaPage() {
    const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);
    const [board, setBoard] = useState<AttendanceBoard | null>(null);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadEmployees = useCallback(async () => {
        const data = await getAttendanceEmployees();
        setEmployees(data);
        setSelectedEmployeeId((currentId) => {
            if (currentId && data.some((employee) => employee.id === currentId)) {
                return currentId;
            }

            return data[0]?.id ?? "";
        });
    }, []);

    const loadBoard = useCallback(async () => {
        const data = await getAttendanceBoard();
        setBoard(data);
    }, []);

    const loadDashboard = useCallback(async (employeeId: string) => {
        if (!employeeId) {
            setDashboard(null);
            return;
        }

        setIsEmployeeLoading(true);
        try {
            const data = await getAttendanceDashboard(employeeId);
            setDashboard(data);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo cargar la asistencia";
            toast.error(message);
        } finally {
            setIsEmployeeLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsBootstrapping(true);
            try {
                await Promise.all([
                    loadEmployees(),
                    loadBoard(),
                ]);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "No se pudo cargar el personal";
                toast.error(message);
            } finally {
                setIsBootstrapping(false);
            }
        };

        loadInitialData();
    }, [loadBoard, loadEmployees]);

    useEffect(() => {
        if (!selectedEmployeeId) return;
        loadDashboard(selectedEmployeeId);
    }, [loadDashboard, selectedEmployeeId]);

    const handleCheckIn = async () => {
        if (!selectedEmployeeId) {
            return toast.error("Seleccioná un empleado");
        }

        setIsSubmitting(true);
        try {
            await checkInUser(selectedEmployeeId);
            toast.success("Entrada registrada");
            await Promise.all([
                loadDashboard(selectedEmployeeId),
                loadBoard(),
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo registrar la entrada";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCheckOut = async () => {
        if (!selectedEmployeeId) {
            return toast.error("Seleccioná un empleado");
        }

        setIsSubmitting(true);
        try {
            await checkOutUser(selectedEmployeeId);
            toast.success("Salida registrada");
            await Promise.all([
                loadDashboard(selectedEmployeeId),
                loadBoard(),
            ]);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo registrar la salida";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isBootstrapping) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#065f46_100%)] p-3 text-emerald-50">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando asistencia</p>
                            <p className="text-sm text-muted-foreground">Estamos preparando el tablero del turno.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (employees.length === 0) {
        return (
            <div className="p-4 sm:p-5 lg:p-6">
                <Card className="mx-auto mt-12 max-w-xl border-orange-800/30 bg-[linear-gradient(135deg,rgba(234,88,12,0.12),rgba(194,65,12,0.05))]">
                    <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] text-orange-50">
                            <Users className="size-7" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">No hay personal disponible</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Necesitás al menos un empleado activo con rol STAFF para marcar asistencia.
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
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/30 bg-[linear-gradient(135deg,rgba(5,150,105,0.18),rgba(6,95,70,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800 dark:text-emerald-100">
                            <Clock3 className="size-3.5" />
                            Asistencia
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Fichaje del equipo
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-[1.1rem] border border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/80 dark:text-emerald-100/80">Activos</p>
                            <p className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-100">{board?.shifts.filter((shift) => shift.status === "ACTIVE").length ?? 0}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-blue-800/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(30,64,175,0.04))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-800/80 dark:text-blue-100/80">Fichajes</p>
                            <p className="mt-1 text-xl font-semibold text-blue-950 dark:text-blue-100">{board?.shifts.length ?? 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="mb-8 mt-5 rounded-[1.75rem] border-border/60 bg-card/92 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2.5 text-xl">
                        <div className="flex size-8 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, #10b981 0%, #6ee7b7 100%)" }}>
                            <CalendarClock className="size-4" />
                        </div>
                        Marcación rápida
                    </CardTitle>
                    <CardDescription>
                        Un flujo simple para el personal: entrar al turno al llegar y salir al terminar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Empleado</p>
                        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                            <SelectTrigger className="h-12 w-full text-base">
                                <SelectValue placeholder="Seleccioná un empleado" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map((employee) => (
                                    <SelectItem key={employee.id} value={employee.id}>
                                        {employee.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>



                    <div className="flex flex-col gap-4 sm:flex-row">
                        <Button
                            className="h-12 flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                            disabled={isSubmitting || isEmployeeLoading || Boolean(dashboard?.activeShift)}
                            onClick={handleCheckIn}
                        >
                            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
                            Marcar entrada
                        </Button>
                        <Button
                            variant="outline"
                            className="h-12 flex-1 gap-2 border-rose-900/20 text-rose-600 hover:bg-rose-950/6 hover:text-rose-700"
                            disabled={isSubmitting || isEmployeeLoading || !dashboard?.activeShift}
                            onClick={handleCheckOut}
                        >
                            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
                            Marcar salida
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/92 shadow-sm">
                <CardHeader>
                    <CardTitle>Tablero general de turnos</CardTitle>
                </CardHeader>
                <CardContent>


                    {board && board.shifts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Entrada</TableHead>
                                    <TableHead>Salida</TableHead>
                                    <TableHead>Horas</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {board.shifts.map((shift) => (
                                    <TableRow
                                        key={shift.id}
                                        className={
                                            shift.status === "ACTIVE"
                                                ? "bg-emerald-950/6 hover:bg-emerald-950/10"
                                                : "bg-slate-50/60 hover:bg-slate-100/80"
                                        }
                                    >
                                        <TableCell className="font-semibold">
                                            {shift.userName}
                                        </TableCell>
                                        <TableCell>{formatDateTime(shift.checkIn)}</TableCell>
                                        <TableCell>
                                            {shift.checkOut ? formatDateTime(shift.checkOut) : "--"}
                                        </TableCell>
                                        <TableCell>
                                            {shift.totalHours != null
                                                ? formatHours(shift.totalHours)
                                                : "En curso"}
                                        </TableCell>
                                        <TableCell>
                                            {shift.status === "ACTIVE" ? (
                                                <Badge className="gap-1.5 bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">
                                                    <CircleDot className="size-3.5 fill-current" />
                                                    Activo
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1.5 border-slate-300 bg-white px-3 py-1 text-slate-700"
                                                >
                                                    <CheckCircle2 className="size-3.5 text-slate-500" />
                                                    Finalizado
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                            {board?.cashSession
                                ? "Todavía no hay fichajes registrados desde la apertura de caja."
                                : "Abrí la caja para empezar a registrar y visualizar los turnos del equipo."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
