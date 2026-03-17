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
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (employees.length === 0) {
        return (
            <div className="p-6 lg:p-10">
                <Card className="mx-auto mt-12 max-w-xl border-amber-200 bg-amber-50">
                    <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
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
        <div className="p-6 lg:p-10">
            <div className="mb-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        Personal
                    </p>
                    <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold tracking-tight">
                        <Clock3 className="size-8 text-emerald-700" />
                        Asistencia
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Registrá entrada y salida del equipo desde un único punto de fichaje.
                    </p>
                </div>
            </div>

            <Card className="mb-8 border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <CalendarClock className="size-5 text-emerald-700" />
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
                            className="h-12 flex-1 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            disabled={isSubmitting || isEmployeeLoading || !dashboard?.activeShift}
                            onClick={handleCheckOut}
                        >
                            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
                            Marcar salida
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
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
                                                ? "bg-emerald-50/80 hover:bg-emerald-100/70"
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
